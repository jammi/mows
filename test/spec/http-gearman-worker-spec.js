'use strict';

const http = require('http');

const expect = require('chai').expect;

const Gearman = require('../../lib/util/gearman');

const _conf = require('../config')();
const config = _conf.config;
const gearmanServers = config.gearmanServers;

describe.skip('HTTP client gearman post session handshake tests', function() {

  const gearmanHttpWorkerTest = (doneIn, respId, requestBody,
      customRequestOptions, gmToHandler, gmResHandler, httpResHandler
    ) => {

    const requestOptions = {
      hostname: '127.0.0.1',
      port: 9080,
      path: '/',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(requestBody, 'utf8'),
      },
    };

    if (customRequestOptions) {
      for (const key in customRequestOptions) {
        const value = customRequestOptions[key];
        if (key !== 'headers') {
          requestOptions[key] = value;
        }
      }
      if (customRequestOptions.headers) {
        for (const key in customRequestOptions.headers) {
          const value = customRequestOptions.headers[key];
          requestOptions.headers[key] = value;
        }
      }
    }

    const gearman = Gearman({gearmanServers: gearmanServers});

    const workers = {
      'httpRespondTo?': (gm, data) => {
        gmToHandler(data);
        gm.send({responders: [respId]});
      },
    };

    workers[respId] = (gm, data) => {
      const resp = gmResHandler(data);
      const response = {
        handled: resp.handled ? resp.handled : true,
        status: resp.status ? resp.status : 200,
        body: resp.body ? resp.body : '',
      };
      response.headers = {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(response.body, 'utf8'),
      };
      if (resp.headers) {
        for (const key in resp.headers) {
          const value = resp.headers[key];
          response.headers[key] = value;
        }
      }
      gm.send(response);
    };

    const worker = gearman.worker(workers);

    const done = err => {
      worker.close();
      doneIn(err);
    };

    const req = http.request(requestOptions, res => {
      res.setEncoding('utf8');
      res.on('data', rawData => {
        console.log('rawData:', rawData);
        httpResHandler(JSON.parse(rawData, 'utf8'));
        gearman.removeFromWorker(worker, ['httpRespondTo?', respId]);
        done();
      });
      res.on('error', err => {
        done(err);
      });
    });

    req.write(requestBody);

    req.on('error', err => {
      done(err);
    });
    req.end();
  };

  it('Init worker, then make a http call for it', function(done) {

    const reqBody = '{"test":123}';
    const httpOptions = {
      path: '/test123?foobar=something',
      method: 'POST',
      headers: {
        'Cookie': 'test=foobar',
      },
    };
    const gmReqHeaderTest = data => {
      expect(data.ip).to.equal('127.0.0.1');
      expect(data.uri).to.equal('/test123');
      expect(data.host).to.equal('test');
      expect(data.query).to.eql({foobar: 'something'});
      expect(data.https).to.equal(false);
      expect(data.method).to.equal('POST');
      console.dir(data.cookies);
      expect(data.cookies).to.eql({test: 'foobar'});
    };
    const gmReqBodyTest = data => {
      console.log(data);
      expect(data.body).to.be.an('object');
      expect(data.body).to.eql({test: 123});
      return {
        handled: true,
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: '{"luke": "I\'m your father!"}',
      };
    };
    const httpRespTest = data => {
      expect(data).to.eql({luke: 'I\'m your father!'});
    };

    gearmanHttpWorkerTest(
      done, 'testResponder', reqBody, httpOptions,
      gmReqHeaderTest, gmReqBodyTest, httpRespTest
    );
  });
});

