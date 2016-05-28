'use strict';

describe('Values api sync out', function() {

  const {expect, config, Session, setSession} = require('./util')();

  // shared references for tests after this
  let sync = null;
  let session = null;
  let values = null;
  let sesId = null;

  const LibValues = require('../../lib/values');
  const MongoLib = require('../../lib/util/mongodb');

  const authKey = () => {
    return `0:2:${new Date().getTime().toString(36)}`;
  };

  beforeEach((done) => {
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then(([sesDb, valDb]) => {
        let c = 2;
        const from2 = () => {
          c -= 1;
          if (c === 0) {
            Session(config)
              .then((ses) => {
                session = ses; // sets reference to be describe-wide
                setSession(ses);
                LibValues(config)
                  .then((api) => {
                    sync = api.sync;
                    session
                      .auth(authKey())
                      .then(([key, ses1]) => {
                        sesId = ses1.id;
                        values = api.Values(ses1.id);
                        done();
                      })
                      .catch(done);
                  })
                  .catch(done);
              })
              .catch(done);
          }
        };
        valDb.remove({}).then(from2);
        sesDb.remove({}).then(from2);
      })
      .catch(done);
  });

  afterEach((done) => {
    if (session) {
      session.close();
      setSession(null);
      session = null;
      done();
    }
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
        sync({id: sesId}, {})
          .then(([syncData, status]) => {
            expect(syncData).to.have.key('new');
            expect(syncData).to.not.contain.keys(['set', 'del']);
            expect(syncData.new).to.deep.equal([['test', testData()]]);
            done();
          })
          .catch(done);
      })
      .catch(done);
  });

  it('set value', function(done) {
    values
      .create('test', 'initial')
      .then(() => {
        sync({id: sesId}, {})
          .then(() => {
            values
              .set('test', testData())
              .then(() => {
                sync({id: sesId}, {})
                  .then(([syncData, status]) => {
                    expect(syncData).to.have.key(['set']);
                    expect(syncData).to.not.contain.keys(['new', 'del']);
                    expect(syncData.set).to.deep.equal([['test', testData()]]);
                    done();
                  })
                  .catch(done);
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('create and set the same value', function(done) {
    values
      .create('test', 'initial')
      .then(() => {
        values
          .set('test', testData())
          .then(() => {
            sync({id: sesId}, {})
              .then(([syncData, status]) => {
                expect(syncData).to.have.key('new');
                expect(syncData).to.not.contain.keys(['set', 'del']);
                expect(syncData.new).to.deep.equal([['test', testData()]]);
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('create and del the same value', function(done) {
    values
      .create('test', 'initial')
      .then(() => {
        values
          .del('test')
          .then(() => {
            sync({id: sesId}, {})
              .then(([syncData, status]) => {
                expect(syncData).to.have.key('del');
                expect(syncData).to.not.contain.keys(['new', 'set']);
                expect(syncData.del).to.deep.equal(['test']);
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });
});
