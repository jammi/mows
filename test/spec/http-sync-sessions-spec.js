'use strict';

describe('HTTP client post session handshake tests', function() {

  const {expect, config} = require('./util')();
  const HttpClient = require('../../lib/http/client');

  const ClientValues = require('../../lib/http/client-values');

  const MongoLib = require('../../lib/util/mongodb');

  const nginxConfig = {
    host: 'localhost',
    port: 9080,
    path: '/',
  };

  const clientDefaults = () => {
    return {
      anyListeners: {'new': [], set: [], del: []},
      initValues: []
    };
  };

  const checkHandshake = (values, messages) => {
    expect(values).to.deep.equal({});
    expect(messages).to.be.an('array');
    expect(messages).to.have.length(1);
    expect(messages[0]).to.have.key('syncStatus');
    const status = messages[0].syncStatus;
    expect(status.fails).to.equal(0);
  };

  beforeEach((done) => {
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then(([sesDb, valDb]) => {
        let c = 2;
        const from2 = () => {
          c -= 1;
          if (c === 0) {
            done();
          }
        };
        valDb.remove({}).then(from2);
        sesDb.remove({}).then(from2);
      })
      .catch(done);
  });

  it('should handshake the session through nginx', function(done) {

    const initValues = ClientValues(clientDefaults());

    HttpClient(nginxConfig, initValues)
      .sync()
      .then(([values, messages, session]) => {
        checkHandshake(values, messages, session);
        done();
      })
      .catch(done);
  });

  it('should handshake the session through koa #1', function(done) {

    const initValues = ClientValues(clientDefaults());

    HttpClient({
      host: 'localhost',
      port: 9400,
      path: '/',
    }, initValues)
      .sync()
      .then(([values, messages, session]) => {
        checkHandshake(values, messages, session);
        done();
      })
      .catch(done);
  });

  it('should handshake the session through koa #2', function(done) {

    const initValues = ClientValues(clientDefaults());

    HttpClient({
      host: 'localhost',
      port: 9401,
      path: '/',
    }, initValues)
      .sync()
      .then(([values, messages, session]) => {
        checkHandshake(values, messages, session);
        done();
      })
      .catch(done);
  });

  it('should handshake the session through koa #3', function(done) {

    const initValues = ClientValues(clientDefaults());

    HttpClient({
      host: 'localhost',
      port: 9402,
      path: '/',
    }, initValues)
      .sync()
      .then(([values, messages, session]) => {
        checkHandshake(values, messages, session);
        done();
      })
      .catch(done);
  });

  it('should handshake the session through koa #4', function(done) {

    const initValues = ClientValues(clientDefaults());

    HttpClient({
      host: 'localhost',
      port: 9403,
      path: '/',
    }, initValues)
      .sync()
      .then(([values, messages, session]) => {
        checkHandshake(values, messages, session);
        done();
      })
      .catch(done);
  });

  it('should handshake 250 simultaneous sessions through nginx', function(done) {

    let cbs = 250;
    const cbMinus = () => {
      cbs -= 1;
      if (cbs === 0) {
        done();
      }
    };

    for (let i = 0; i < 250; i++) {
      setImmediate(() => {
        const initValues = ClientValues(clientDefaults());
        HttpClient(nginxConfig, initValues)
          .sync()
          .then(([values, messages, session]) => {
            expect(values).to.deep.equal({});
            expect(messages).to.be.an('array');
            expect(messages).to.have.length(1);
            expect(messages[0]).to.have.key('syncStatus');
            const status = messages[0].syncStatus;
            expect(status.fails).to.equal(0);
            expect(session.seq).to.equal(1);
            cbMinus();
          })
          .catch(done);
      });
    }
  });

  for (let koaNum = 0; koaNum < 16; koaNum++) {
    it(`should handshake 50 times 5 simultaneous sessions through koa #${koaNum + 1}`, function(done) {

      let cbs = 5;
      const cbMinus = () => {
        cbs -= 1;
        if (cbs === 0) {
          done();
        }
      };

      for (let i = 0; i < 5; i++) {
        setImmediate(() => {
          const initValues = ClientValues(clientDefaults());
          let seq = 0;
          const client = HttpClient({
            host: 'localhost',
            port: 9400 + koaNum,
            path: '/',
          }, initValues);
          const verifyClient = ([values, messages, session]) => {
            seq += 1;
            expect(values).to.deep.equal({});
            expect(messages).to.be.an('array');
            expect(messages).to.have.length(1);
            expect(messages[0]).to.have.key('syncStatus');
            const status = messages[0].syncStatus;
            expect(status.fails).to.equal(0);
            expect(session.seq).to.equal(seq);
            if (seq === 50) {
              cbMinus();
            }
            else {
              syncClient();
            }
          };
          const syncClient = () => {
            client.sync()
              .then(verifyClient)
              .catch(done);
          };
          syncClient();
        });
      }
    });
  }

  it('should handshake 5 times 5 simultaneous sessions through koa #1..16', function(done) {
    let cbs = 5 * 16;
    const cbMinus = () => {
      cbs -= 1;
      if (cbs === 0) {
        done();
      }
    };

    for (let koaNum = 0; koaNum < 16; koaNum++) {

      for (let i = 0; i < 5; i++) {
        setImmediate(() => {
          const initValues = ClientValues(clientDefaults());
          let seq = 0;
          const client = HttpClient({
            host: 'localhost',
            port: 9400 + koaNum,
            path: '/',
          }, initValues);
          const verifyClient = ([values, messages, session]) => {
            seq += 1;
            expect(values).to.deep.equal({});
            expect(messages).to.be.an('array');
            expect(messages).to.have.length(1);
            expect(messages[0]).to.have.key('syncStatus');
            const status = messages[0].syncStatus;
            expect(status.fails).to.equal(0);
            expect(session.seq).to.equal(seq);
            if (seq === 5) {
              cbMinus();
            }
            else {
              syncClient();
            }
          };
          const syncClient = () => {
            client.sync()
              .then(verifyClient)
              .catch(done);
          };
          syncClient();
        });
      }
    }
  });

  it.skip('should handshake 50 times 5 simultaneous sessions through nginx', function(done) {

    let cbs = 5;
    const cbMinus = () => {
      cbs -= 1;
      if (cbs === 0) {
        done();
      }
    };

    for (let i = 0; i < 50; i++) {
      setImmediate(() => {
        const initValues = ClientValues(clientDefaults());
        let seq = 0;
        const client = HttpClient(nginxConfig, initValues);
        const verifyClient = ([values, messages, session]) => {
          seq += 1;
          expect(values).to.deep.equal({});
          expect(messages).to.be.an('array');
          expect(messages).to.have.length(1);
          expect(messages[0]).to.have.key('syncStatus');
          const status = messages[0].syncStatus;
          expect(status.fails).to.equal(0);
          expect(session.seq).to.equal(seq);
          if (seq === 50) {
            cbMinus();
          }
          else {
            syncClient();
          }
        };
        const syncClient = () => {
          client.sync()
            .then(verifyClient)
            .catch(done);
        };
        syncClient();
      });
    }
  });

  it.skip('should handshake 5 times 50 simultaneous sessions through nginx', function(done) {

    let cbs = 50;
    const cbMinus = () => {
      cbs -= 1;
      if (cbs === 0) {
        done();
      }
    };

    for (let i = 0; i < 50; i++) {
      setImmediate(() => {
        const initValues = ClientValues(clientDefaults());
        let seq = 0;
        const client = HttpClient(nginxConfig, initValues);
        const verifyClient = ([values, messages, session]) => {
          seq += 1;
          expect(values).to.deep.equal({});
          expect(messages).to.be.an('array');
          expect(messages).to.have.length(1);
          expect(messages[0]).to.have.key('syncStatus');
          const status = messages[0].syncStatus;
          expect(status.fails).to.equal(0);
          expect(session.seq).to.equal(seq);
          if (seq === 5) {
            cbMinus();
          }
          else {
            syncClient();
          }
        };
        const syncClient = () => {
          client.sync()
            .then(verifyClient)
            .catch(done);
        };
        syncClient();
      });
    }
  });

});
