'use strict';

describe('Values api sync out', function() {

  const {expect, config, Session} = require('./util')();

  // shared references for tests after this
  let sync = null;
  let session = null;
  let Values = null;
  let values = null;
  let sesId = null;

  const _Values = require('../../lib/values');
  const Mongo = require('../../lib/util/mongodb');

  const authKey = () => {
    return `0:2:${new Date().getTime().toString(36)}`;
  };

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
        session = ses; // sets reference to be describe-wide
        return _Values(config);
      }, done)
      .then(api => {
        sync = api.sync;
        Values = api.Values;
        return session.auth(authKey());
      }, done)
      .then(sesInfo => {
        sesId = sesInfo[1].id;
        values = Values(sesId);
      }, done)
      .then(done, done);
  });

  afterEach((done) => {
    session
      .close()
      .then(() => {
        sync = null;
        session = null;
        Values = null;
        values = null;
        sesId = null;
      }, done)
      .then(done, done);
  });

  const testData = () => {
    return {
      one: 1,
      two: 'two',
      'true': true,
      'false': false,
      'null': null,
      obj: {
        foo: 'bar',
        arr: [1, '2', 'three', false],
      },
      arr: [1, 2, 3, 'four', true],
    };
  };

  it('create value', function(done) {
    values
      .create('test', testData())
      .then(() => {
        return sync({id: sesId}, {});
      }, done)
      .then(([syncData, status]) => {
        expect(status.fails).to.equal(0);
        expect(syncData).to.have.key('new');
        expect(syncData).to.not.contain.keys(['set', 'del']);
        expect(syncData.new).to.deep.equal([['test', testData()]]);
      }, done)
      .then(done, done);
  });

  it('set value', function(done) {
    values
      .create('test', 'initial')
      .then(() => {
        return sync({id: sesId}, {});
      }, done)
      .then(() => {
        return values.set('test', testData());
      }, done)
      .then(() => {
        return sync({id: sesId}, {});
      }, done)
      .then(([syncData, status]) => {
        expect(status.fails).to.equal(0);
        expect(syncData).to.have.key(['set']);
        expect(syncData).to.not.contain.keys(['new', 'del']);
        expect(syncData.set).to.deep.equal([['test', testData()]]);
      }, done)
      .then(done, done);
  });

  it('create and set the same value', function(done) {
    values
      .create('test', 'initial')
      .then(() => {
        return values.set('test', testData());
      }, done)
      .then(() => {
        return sync({id: sesId}, {});
      }, done)
      .then(([syncData, status]) => {
        expect(status.fails).to.equal(0);
        expect(syncData).to.have.key('new');
        expect(syncData).to.not.contain.keys(['set', 'del']);
        expect(syncData.new).to.deep.equal([['test', testData()]]);
      })
      .then(done, done);
  });

  it('create and del the same value', function(done) {
    values
      .create('test', 'initial')
      .then(() => {
        return values.del('test');
      }, done)
      .then(() => {
        return sync({id: sesId}, {});
      }, done)
      .then(([syncData, status]) => {
        expect(status.fails).to.equal(0);
        expect(syncData).to.have.key('del');
        expect(syncData).to.not.contain.keys(['new', 'set']);
        expect(syncData.del).to.deep.equal(['test']);
      }, done)
      .then(done, done);
  });
});
