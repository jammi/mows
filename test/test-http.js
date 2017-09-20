#!/usr/bin/env node
console.log('Starting Mows test server..');
const Koa = require('koa');
const Body = require('koa-bodyparser');

const Broker = require('../lib/http/broker');

const {mowsConfig} = require('./config')();

// console.log('argv:', process.argv)

const host = process.argv[2];
const port = parseInt(process.argv[3], 10);

// console.log({host, port})

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
      console.log(`Mows server listening on http://${host}:${port}`);
    });
  })
  .catch(err => {
    console.error('Unable to start broker:', err);
  });

setInterval(() => {}, Number.POSITIVE_INFINITY);
