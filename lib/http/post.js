'use strict';

module.exports = (auth, sync) => {

  const handler = function(ctx) {
    return new Promise(function(resolve, reject) {
      try {
        const req = ctx.request;
        const body = req.body;
        const [keyIn, valuesIn, messagesIn] = body;
        auth(keyIn)
          .then(([key, session]) => {
            if (messagesIn && messagesIn.length) {
              console.log(messagesIn);
            }
            ctx.type = 'json';
            sync(session, valuesIn)
              .then(([values, status]) => {
                ctx.status = 200;
                ctx.body = [key, values, [{syncStatus: status}]];
                resolve(ctx);
              })
              .catch(reject);
          })
          .catch((err) => {
            const [status, error] = err;
            if (status === false) {
              console.error('session fail:', err);
              ctx.status = 401;
              ctx.body = [`${error.code}:2:`, {}, [error]];
              resolve(ctx);
            }
            else {
              reject(new Error('Unknown session failure status: ', status, error));
            }
          });
      }
      catch (err) {
        reject(err);
      }
    });
  };

  return {handler};

};

