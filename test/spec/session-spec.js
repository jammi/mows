'use strict';

describe('Session', function() {

  const util = require('./util')();
  const expect = util.expect;
  const config = util.config;
  const Session = util.Session;
  const validateKey = util.validateKey;
  const setSession = util.setSession;
  const expectFail = util.expectFail;
  const dontExpectFail = util.dontExpectFail;
  const vars = util.vars;

  const MongoLib = require('../../src/mongodb-util');

  // shared references for tests after this
  let session = null;

  beforeEach(done => {
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then(_dbs => {
        const sesDb = _dbs[0];
        const valDb = _dbs[1];
        let c = 3;
        const from3 = () => {
          c -= 1;
          if (c === 0) {
            done();
          }
        };
        valDb.remove({}).then(from3).catch(done);
        sesDb.remove({}).then(from3).catch(done);
        Session(config)
          .then(ses => {
            session = ses; // sets reference to be describe-wide
            setSession(ses);
          })
          .then(from3)
          .catch(done);
      });
  });

  afterEach(done => {
    session.close().then(done).catch(done);
    setSession(null);
    session = null;
  });

  it('module is a function', done => {
    expect(Session).to.be.a('function');
    done();
  });

  it('inited module has the correct methods', done => {
    expect(session.auth).to.be.a('function');
    expect(session.close).to.be.a('function');
    done();
  });

  it('handles a new session', done => {
    vars.key = '0:2:abcdefghi';
    session.auth(vars.key)
      .then(validateKey(vars, '0', done))
      .catch(done);
  });

  it('handles another new session', done => {
    vars.key = '0:2:jklmnopqrs';
    session
      .auth(vars.key)
      .then(validateKey(vars, '0', done))
      .catch(done);
  });

  it('handles the session for 500 iterations', done => {
    vars.key = '0:2:klmnopqrst';
    let c = 500;
    const from500 = e => {
      c -= 1;
      if (e) {done(e);}
      else if (c === 0) {
        MongoLib(config.mongoUrl, 'sessions')
          .then(_dbs => {
            const sesDb = _dbs[0];
            sesDb.find({})
              .then(docs => {
                expect(docs).to.have.length(1);
                done();
              })
              .catch(done);
          })
          .catch(done);
      }
      else {
        session.auth(vars.key)
          .then(validateKey(vars, (500 - c).toString(36), from500))
          .catch(done);
      }
    };
    session.auth(vars.key)
      .then(validateKey(vars, '0', from500))
      .catch(done);
  });

  it('fails with an invalid auth format #1', done => {
    session.auth('abcdefghi')
      .then(dontExpectFail)
      .catch(expectFail([false, {error: 'Invalid Key Format', code: -3}], done));
  });

  it('fails with an invalid auth format #2', done => {
    session.auth('0:bcdefghi')
      .then(dontExpectFail)
      .catch(expectFail([false, {error: 'Invalid Key Format', code: -3}], done));
  });

  it('fails with an invalid auth format #3', done => {
    session.auth('0:bc:de:fghi')
      .then(dontExpectFail)
      .catch(expectFail([false, {error: 'Invalid Key Format', code: -3}], done));
  });

  it('fails with an invalid version format #1', done => {
    session.auth('a:-:defghi')
      .then(dontExpectFail)
      .catch(expectFail([false, {error: 'Unsupported Version', code: -2}], done));
  });

  it('fails with an invalid version format #2', done => {
    session.auth('a:0:defghi')
      .then(dontExpectFail)
      .catch(expectFail([false, {error: 'Unsupported Version', code: -2}], done));
  });

  it('fails with an invalid version format #3', done => {
    session.auth('a:3:defghi')
      .then(dontExpectFail)
      .catch(expectFail([false, {error: 'Unsupported Version', code: -2}], done));
  });

  it('fails with an invalid key', done => {
    session.auth('a:2:defghi')
      .then(dontExpectFail)
      .catch(expectFail([false, {error: 'Invalid Session Key', code: -1}], done));
  });
});
