'use strict';

const Koa = require('koa');
const Body = require('koa-bodyparser');

const Broker = require('../src/http-broker');

module.exports = (config, mowsConfig) => {

  const apps = [];

  for (let i = 0; i < config.numHttp; i++) {
    const host = '127.0.0.1';
    const port = config.httpBase + i;
    Broker(mowsConfig)
      .then(broker => {
        const app = new Koa();
        app.proxy = true;
        app.use(Body({
          strict: true,
          onerror: (err, ctx) => {
            ctx.throw(`body parse error of ${ctx.body} ${err}; ${err.body}`, 422);
          }
        }));
        app.use(broker.middleware());
        return app;
      })
      .then(app => {
        const server = app.listen(port, host, () => {
          console.log(`Test server listening on http://${host}:${port}`);
        });
        apps.push({app, server});
      })
      .catch(err => {
        console.error('Unable to start broker:', err);
      });
  }
  return apps;
};
