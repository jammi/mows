'use strict';

const crypto = require('crypto');
const MongoUtil = require('./util/mongodb');
const randomstring = require('randomstring');

module.exports = config => {

  return new Promise((expResolve, expReject) => {
    const xport = {};
    MongoUtil(config.mongoUrl, ['sessions', 'values'])
      .then(([sesDb, valDb]) => {
        const digest = (() => {
          return (key, seed) => {
            seed = seed ? seed : '';
            return crypto.createHash('sha1')
              .update(seed)
              .update(key)
              .digest('hex');
          };
        })();
        const newKey = len => {
          len = len ? len : config.keyLength;
          return randomstring.generate(len);
        };
        const now = () => {
          return new Date().getTime();
        };
        const expiration = seconds => {
          seconds = seconds ? seconds : config.timeout;
          return Math.floor(now() + seconds * 1000);
        };

        const formatKey = (seq, key) => {
          return `${seq.toString(36)}:2:${key}`;
        };

        const createSession = seed => {
          seed = seed ? seed : randomstring.generate(24);
          return new Promise((resolve, reject) => {
            const clientKey = newKey();
            const key = digest(clientKey, seed);
            const session = {
              key: key,
              seq: 0,
              expires: expiration(config.timeoutFirst),
              // id: @_id.toString()
              values: {},
              valueSync: {'new': [], 'set': [], 'del': []},
            };
            return sesDb
              .insert(session)
              .then(() => {
                session.id = session._id.toString();
                resolve([formatKey(session.seq, clientKey), session]);
              })
              .catch(reject);
          });
        };

        const validateSession = oldKey => {
          return new Promise((resolve, reject) => {
            return sesDb
              .find({key: oldKey})
              .then(sessions => {
                if (sessions.length === 1) {
                  const session = sessions[0];
                  const clientKey = newKey();
                  const key = digest(clientKey, oldKey);
                  return [key, clientKey, session, {
                    $inc: {seq: 1},
                    $set: {key, expires: expiration()},
                  }];
                }
                else {
                  reject([false, {error: 'Invalid Session Key', code: -1}]);
                }
              })
              .then(([key, clientKey, session, upData]) => {
                sesDb
                  .updateById(session._id, upData)
                  .then(() => {
                    session.id = session._id.toString();
                    session.seq += 1;
                    session.key = key;
                    resolve([formatKey(session.seq, clientKey), session]);
                  })
                  .catch(reject);
              })
              .catch(reject);
          });
        };

        const auth = keyRaw => {
          return new Promise((resolve, reject) => {
            const splitKey = keyRaw.split(':');
            if (splitKey.length !== 3) {
              reject([false, {error: 'Invalid Key Format', code: -3}]);
            }
            else {
              const [seq, ver, key] = splitKey;
              if (!seq.match(/([a-z0-9]+)/)) {
                reject([false, {error: 'Invalid Sequence Format', code: -4}]);
              }
              else if (ver !== '1' && ver !== '2') {
                reject([false, {error: 'Unsupported Version', code: -2}]);
              }
              else if (seq === '0') {
                createSession(key).then(resolve, reject);
              }
              else {
                validateSession(key).then(resolve, reject);
              }
            }
          });
        };

        const log = (method, msg) => {
          console.log(
            `${Math.floor(now() * 1000).toString(36)} ` +
            `\uD83D\uDC7B  MOWS Session#${method}: ${msg}`);
        };

        let isStopped = false;

        const close = () => {
          return new Promise((reject, resolve) => {
            let count = 2;
            const countDown = () => {
              count--;
              if (!count) {
                resolve();
              }
            };
            if (!isStopped) {
              isStopped = true;
              try {
                valDb.close().then(countDown).catch(reject);
                sesDb.close().then(countDown).catch(reject);
              }
              catch (e) {
                reject(e);
              }
            }
            else {
              resolve();
            }
          });
        };

        const sessionCleaner = () => {
          if (!isStopped) {
            const t = now();
            sesDb
              .find({timeout: {$lt: t}})
              .then(sessions => {
                if (sessions.length !== 0) {
                  sessions.forEach(session => {
                    valDb.remove({sid: session._id}, {multi: true});
                    sesDb.removeById(session._id);
                  });
                  const amount = sessions.length;
                  log('sessionCleaner', `expired ${amount} sessions`);
                }
                if (!isStopped) {
                  let nextClean = 1000 - (now() - t);
                  if (nextClean < 100) {
                    nextClean = 100;
                  }
                  setTimeout(sessionCleaner, nextClean);
                }
              });
          }
        };

        if (!isStopped) {
          setTimeout(sessionCleaner, config.timeoutFirst * 1000);
        }

        xport.auth = auth;
        xport.close = close;

        expResolve(xport);
      })
      .catch(expReject);
  });
};
