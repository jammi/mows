
const Router = require('koa-router');

// const Gearman = require('../util/gearman');
const Session = require('../session');
const Values = require('../values');
const Post = require('./post');

// const Broker = (config) => {
//   // const gearman = Gearman(config);

//   return function(ctx) {
//     return new Promise(function(resolve, reject) {
//       const req = ctx.request;
//       const ident = {
//         charset: req.charset,
//         cookies: req.cookies,
//         host: req.hostname,
//         httpHeaders: req.header,
//         https: req.secure,
//         ip: req.ip,
//         method: req.method,
//         origin: req.origin,
//         query: req.query,
//         querystring: req.querystring,
//         type: req.type,
//         uri: req.path,
//         url: req.originalUrl,
//       };
//       return gearman
//         .client('httpRespondTo?', ident)
//         .then()
//         .catch(err => {
//           console.error('Unable to check gearman responder: ', err);
//           reject(err);
//         });
//     });
//   };
// };

module.exports = config => {
  let _auth;
  return Session(config)
    .then(({auth}) => {
      _auth = auth;
      return Values(config);
    })
    .then(({sync}) => {
      return Router()
        .post(['/x', '/hello'], Post(_auth, sync).handler);
        // .all('/(.*)', Broker(config));
    })
    .catch(err => {console.error('Unable to start Broker:', err);});
};
