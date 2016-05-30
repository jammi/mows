'use strict';

const http = require('http');

const expect = require('chai').expect;

const Gearman = require('../../lib/util/gearman');

const _conf = require('../config')();
const config = _conf.config;
const servers = config.gearmanServers;

describe.skip('Gearman HTTP worker test', function() {

  let gearman;

  beforeEach((done) => {
    gearman = Gearman(servers);
    done();
  });

  it('GET /test123.html returns HTML', function(done) {
    gearman
      .worker('GET/test123.html:http', (req, res, next) => {
        res.type = 'html';
        res.status = 200;
        res.body = `<!DOCTYPE html>
<html>
  <head>
    <title>Test 123</title>
  </head>
  <body>
    <h3>Test 123</h3>
    <p>This is just a test, served by a gearman worker.</p>
  </body>
</html>`;
      })
      .then(worker => {
        http
          .request({
            port: config.httpBase,
            host: '127.0.0.1',
            method: 'GET',
            path: '/test123.html'
          }, res => {
            const html = res.body;
            expect(html).to.contain('<title>Test 123</title>');
            expect(html).to.contain('This is just a test, served by a gearman worker.');
            worker.close();
            done();
          });
      })
      .catch(done);
  });
});

