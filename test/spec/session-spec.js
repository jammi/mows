
describe('Session', function() {

  const {
    expect, config, Session, validateKey, setSession,
    expectFail, dontExpectFail, vars
  } = require('./util')();

  const Mongo = require('../../lib/util/mongodb');

  // shared references for tests after this
  let session = null;

  beforeEach(done => {
    Mongo(config.mongoUrl, ['sessions', 'values'])
      .then(dbs => {
        return Promise.all(dbs.map(db => {
          return db.remove({});
        }));
      }, done)
      .then(() => {
        return Session(config);
      }, done)
      .then(ses => {
        setSession(ses);
        session = ses; // sets reference to be describe-wide
      }, done)
      .then(done, done);
  });

  afterEach((done) => {
    session
      .close()
      .then(() => {
        session = null;
        setSession(null);
      }, done)
      .then(done, done);
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
    new Array(500).fill(session.auth)
      .reduce((p, auth, i) => {
        return p
          .then(() => {
            return auth(vars.key);
          }, done)
          .then(validateKey(vars, i.toString(36), () => {}), done);
      }, Promise.resolve())
      .then(done, done);
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
