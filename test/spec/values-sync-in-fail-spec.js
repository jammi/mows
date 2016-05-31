'use strict';

describe('Values sync in should fail', function() {

  const {expect, config, Session, setSession} = require('./util')();

  // shared references for tests after this
  let session = null;

  const _Values = require('../../lib/values');
  const Mongo = require('../../lib/util/mongodb');

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

  const authKey = () => {
    return `0:2:${new Date().getTime().toString(36)}`;
  };

  const findValue = (sid, id) => {
    return Mongo(config.mongoUrl, 'values')
      .then(([valDb]) => {
        return valDb.findOne({sid: valDb.ObjectId(sid), id});
      });
  };

  it('module is a function', function(done) {
    expect(_Values).to.be.a('function');
    done();
  });

  it('inited module has the correct methods', function(done) {
    _Values(config)
      .then(({Values, sync}) => {
        expect(Values).to.be.a('function');
        expect(sync).to.be.a('function');
      }, done)
      .then(done, done);
  });

  it('new values with duplicate ids #1', function(done) {
    let _ses;
    let _sync;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        _ses = ses;
        return _sync(ses, {
          'new': [
            ['test', 'testData'],
            ['test', 'otherData'],
          ],
        });
      }, done)
      .then(([syncData, status]) => {
        expect(status.fails).to.equal(1);
        expect(status.ok.new).to.have.length(1);
        expect(status.ok.new[0]).to.equal('test');
        expect(Object.keys(status.fail.new)).to.have.length(1);
        expect(status.fail.new.test.code).to.equal(-17);
        return findValue(_ses.id, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal('testData');
      }, done)
      .then(done, done);
  });

  it('new values with duplicate ids #2', function(done) {
    let _sync;
    let _ses;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        _ses = ses;
        return _sync(ses, {'new': [['test', 'testData']]});
      }, done)
      .then(() => {
        return _sync(_ses, {'new': [['test', 'otherData']]});
      }, done)
      .then(([syncData, status]) => {
        expect(status.fails).to.equal(1);
        expect(Object.keys(status.fail.new)).to.have.length(1);
        expect(status.fail.new.test.code).to.equal(-4);
        return findValue(_ses.id, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal('testData');
      }, done)
      .then(done, done);
  });

  it('set values with duplicate ids', function(done) {
    let _sync;
    let _ses;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        _ses = ses;
        return _sync(ses, {'new': [['test', 'testData']]});
      }, done)
      .then(() => {
        return _sync(_ses, {'set': [
          ['test', 'otherData'],
          ['test', 'otherData2'],
        ]});
      }, done)
      .then(([syncData, status]) => {
        expect(status.fails).to.equal(1);
        expect(Object.keys(status.fail.set)).to.have.length(1);
        expect(status.fail.set.test.code).to.equal(-18);
        return findValue(_ses.id, 'test');
      }, done)
      .then((doc) => {
        expect(doc.data).to.equal('otherData');
      }, done)
      .then(done, done);
  });

  it('del values with duplicate ids', function(done) {
    let _sync;
    let _ses;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        _ses = ses;
        return _sync(ses, {'new': [['test', 'testData']]});
      }, done)
      .then(() => {
        return _sync(_ses, {'del': ['test', 'test']});
      }, done)
      .then(([syncData, status]) => {
        expect(status.fails).to.equal(1);
        expect(Object.keys(status.fail.del)).to.have.length(1);
        expect(status.fail.del.test.code).to.equal(-19);
        return findValue(_ses.id, 'test');
      }, done)
      .then((doc) => {
        expect(doc).to.equal(null);
      }, done)
      .then(done, done);
  });
});
