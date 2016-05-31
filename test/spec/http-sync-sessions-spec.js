'use strict';

describe('HTTP client post session handshake tests', function() {

  const {expect, config} = require('./util')();

  const Client = require('../../lib/http/client');
  const ClientValues = require('../../lib/http/client-values');
  const Mongo = require('../../lib/util/mongodb');

  const clientDefaults = () => {
    return {
      anyListeners: {'new': [], set: [], del: []},
      initValues: []
    };
  };

  const clientN = port => {
    const initValues = ClientValues(clientDefaults());
    return Client({host: 'localhost', port, path: '/'}, initValues);
  };

  const client = port => {
    return clientN(port).sync();
  };

  const arrFill = (len, fill) => {
    if (typeof fill === 'undefined') {
      fill = null;
    }
    return new Array(len).fill(fill);
  };

  const verifyClient = ([values, messages, session]) => {
    expect(values).to.deep.equal({});
    expect(messages).to.be.an('array');
    expect(messages).to.have.length(1);
    expect(messages[0]).to.have.key('syncStatus');
    expect(messages[0].syncStatus.fails).to.equal(0);
    return session;
  };

  const nTimes = (port, parallel, series, done) => {
    return Promise.all(arrFill(parallel).map(() => {
      let seq = 0;
      const verifySeq = session => {
        seq += 1;
        expect(session.seq).to.equal(seq);
      };
      const _client = clientN(port);
      return arrFill(series, _client).reduce((p, cl) => {
        return p
          .then(() => {
            return cl.sync();
          }, done)
          .then(verifyClient, done)
          .then(verifySeq, done);
      }, Promise.resolve());
    }), done)
    .then(arr => {
      expect(arr).to.have.length(parallel);
    }, done);
  };

  beforeEach(done => {
    Mongo(config.mongoUrl, ['sessions', 'values'])
      .then(dbs => {
        return Promise.all(dbs.map(db => {
          return db.remove({});
        }));
      }, done)
      .then(stat => {
        expect(stat).to.have.length(2);
      }, done)
      .then(done, done);
  });

  arrFill(16).forEach((v, koaNum) => {
    it(`should handshake the session through koa #${koaNum + 1}`, function(done) {
      client(9400 + koaNum)
        .then(verifyClient, done)
        .then(session => {
          expect(session.seq).to.equal(1);
        }, done)
        .then(done, done);
    });
  });

  arrFill(16).forEach((v, koaNum) => {
    it(`should handshake 50 times 5 simultaneous sessions through koa #${koaNum + 1}`, function(done) {
      nTimes(9400 + koaNum, 5, 50, done).then(done, done);
    });
  });

  it('should handshake 5 times 5 simultaneous sessions through koa #1..16', function(done) {
    Promise.all(arrFill(16).map((v, koaNum) => {
      return nTimes(9400 + koaNum, 5, 5, done);
    }, done))
    .then(arr => {
      expect(arr).to.have.length(16);
      return null;
    }, done)
    .then(done, done);
  });

  it('should handshake the session through nginx', function(done) {
    client(9080)
      .then(verifyClient, done)
      .then(session => {
        expect(session.seq).to.equal(1);
      }, done)
      .then(done, done);
  });

  it('should handshake 50 times 5 simultaneous sessions through nginx', function(done) {
    nTimes(9080, 5, 50, done).then(done, done);
  });

  it('should handshake 5 times 50 simultaneous sessions through nginx', function(done) {
    nTimes(9080, 50, 5, done).then(done, done);
  });

  it('should handshake 250 simultaneous sessions through nginx', function(done) {
    Promise.all(arrFill(250).map(() => {
      return client(9080)
        .then(verifyClient, done)
        .then(session => {
          expect(session.seq).to.equal(1);
        }, done);
    }), done)
    .then(arr => {
      expect(arr).to.have.length(250);
      done();
    }, done);
  });

});
