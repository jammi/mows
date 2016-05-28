'use strict';

const Router = require('koa-router');

const GearmanUtil = require('../util/gearman');
const Session = require('../session');
const Values = require('../values');
const Post = require('./post');

const Broker = (config) => {
  const gearman = GearmanUtil(config);
  const checkResponders = (ident, http, resolve) => {
    return ({responders}) => {
      const req = http.request;
      // const res = http.response;
      let respondersLeft = responders.length;
      if (respondersLeft === 0) {
        next();
      }
      else {
        const reqData = ident;
        reqData.body = req.body;
        reqData.files = req.files;
        responders.forEach(responderId => {
          gearman.client(responderId, reqData)
            .then(({handled, status, body}) => {
              respondersLeft -= 1;
              if (handled) {
                http.type = 'json';
                if (status) {
                  http.status = parseInt(status.toString(), 10);
                }
                else {
                  http.status = 200;
                }
                http.body = body;
              }
              else if (respondersLeft === 0) {
                resolve();
              }
            })
            .catch(err => {
              console.error('Unable to run gearman client call: ', err);
              resolve(err);
            });
        });
      }
    };
  };

  return function(ctx) {
    return new Promise(function(resolve, reject) {
      const req = ctx.request;
      const ident = {
        charset: req.charset,
        cookies: req.cookies,
        host: req.hostname,
        httpHeaders: req.header,
        https: req.secure,
        ip: req.ip,
        method: req.method,
        origin: req.origin,
        query: req.query,
        querystring: req.querystring,
        type: req.type,
        uri: req.path,
        url: req.originalUrl,
      };
      return gearman
        .client('httpRespondTo?', ident)
        .then(checkResponders(ident, ctx, resolve))
        .catch(err => {
          console.error('Unable to check gearman responder: ', err);
          reject(err);
        });
    });
  };
};

module.exports = config => {
  return Session(config)
    .then(({auth}) => {
      return Values(config)
        .then(({sync}) => {
          return Router()
            .post(['/x', '/hello'], Post(auth, sync).handler)
            .all('/(.*)', Broker(config));
        })
        .catch(err => {console.error('Unable to start Values:', err);});
    })
    .catch(err => {console.error('Unable to start Session:', err);});
};
