'use strict';

const http = require('http');

const digest = (function() {
  const {createHash} = require('crypto');
  return function(key, seed) {
    if (!seed) {
      seed = genRandomString(40);
    }
    return createHash('sha1')
      .update(seed)
      .update(key)
      .digest('hex');
  };
})();

let clientNum = 0;

const genRandomString = require('randomstring').generate;

module.exports = function(config, values) {

  clientNum += 1;

  if (!config) {
    config = {};
  }
  if (!config.host) {
    config.host = 'localhost';
  }
  if (!config.port) {
    config.port = 8001;
  }
  if (!config.path) {
    config.path = '/';
  }
  if (!config.pollThrottle) {
    config.pollThrottle = 100;
  }
  if (!config.idlePoll) {
    config.idlePoll = 5000;
  }
  if (!config.step) {
    config.step = true;
  }
  if (!config.verbose) {
    config.verbose = false;
  }

  const session = {
    seq: 0,
    key: genRandomString(40),
    values: {},
    valueSync: {'new': [], 'set': [], 'del': []}
  };

  let willPoll = true; // initially true, to complete hello -> x quickly

  const pollSoon = function() {
    // console.log('pollSoon');
    willPoll = true;
  };

  if (!values) {
    values = require('./http-client-values')({
      anyListeners: {
        'new': [pollSoon],
        'set': [pollSoon],
        'del': [pollSoon],
      },
      initValues: [
        // ['client.hello', 'Hi, says client!']
      ],
    });
  }

  const getPath = function() {
    if (session.seq === 0) {
      return `${config.path}hello`;
    }
    else {
      return `${config.path}x`;
    }
  };

  const formatKey = function(seq, key) {
    return `${seq.toString(36)}:2:${key}`;
  };

  const valuesOut = {};

  const syncReq = function() {
    return new Promise(function(resolve, reject) {
      try {
        if (session.seq === 0) {
          values.initDefaults(session);
        }
        const data = [
          formatKey(session.seq, session.key),
          values.syncOut(session, valuesOut),
          []
        ];

        const strData = JSON.stringify(data);
        const opts = {
          hostname: config.host,
          port: config.port,
          path: getPath(),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(strData, 'utf8'),
          },
        };

        if (config.verbose) {
          console.log(`POST http://${config.host}:${config.port}${opts.path}`);
          console.log(`req: ${strData}`);
        }

        const req = http.request(opts, function(res) {
          res.setEncoding('utf8');
          res.on('data', resolve);
          res.on('error', reject);
        });
        req.write(strData);
        req.end();
        req.on('error', reject);
      }
      catch (err) {
        reject(err);
      }
    });
  };

  const incrementKey = function(key) {
    session.key = digest(key, session.key);
    session.seq += 1;
  };

  let stopClient = false;
  const stop = function() {
    stopClient = true;
  };
  const start = function() {
    stopClient = false;
  };

  const sync = function() {
    return syncReq()
      .then(function(res) {
        if (config.verbose) {
          console.log(`res: ${res}\n`);
        }
        let keyRaw;
        let messagesIn;
        let valuesIn;
        try {
          [keyRaw, valuesIn, messagesIn] = JSON.parse(res);
        }
        catch (err) {
          stop();
          const errMsg = `Invalid JSON: ${res}`;
          console.error(clientNum, session.seq, errMsg);
          throw new Error(errMsg);
        }
        const splitKey = keyRaw.split(':');
        if (splitKey.length !== 3) {
          stop();
          throw new Error('Invalid session Key');
        }
        else {
          const [seq, ver, key] = splitKey;
          if (ver !== '1' && ver !== '2') {
            stop();
            console.error(clientNum, session.seq, 'Unsupported Version');
            throw new Error('Unsupported Version');
          }
          else if (key === '' || parseInt(seq, 10) < 0) {
            stop();
            const errMsg = `Server error code: ${messagesIn[0].code}, message: ${messagesIn[0].error}`;
            console.error(clientNum, session.seq, errMsg);
            throw new Error(errMsg);
          }
          else {
            incrementKey(key);
            values.syncIn(session, valuesIn);
            if (!stopClient && !config.step) {
              setTimeout(function() {
                willPoll = false;
                sync();
              }, willPoll ? config.pollThrottle : config.idlePoll);
            }
            return [valuesIn, messagesIn, session];
          }
        }
      })
      .catch((err) => {throw err;});
  };

  return {sync, stop, start};
};
