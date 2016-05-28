'use strict';

describe('Values sync in should fail', function() {

  const {expect, config, Session, setSession} = require('./util')();

  // shared references for tests after this
  let session = null;

  const LibValues = require('../../lib/values');
  const MongoLib = require('../../lib/util/mongodb');

  beforeEach((done) => {
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then(([sesDb, valDb]) => {
        let c = 3;
        const from3 = () => {
          c -= 1;
          if (c === 0) {
            done();
          }
        };
        valDb.remove({}).then(from3);
        sesDb.remove({}).then(from3);
        Session(config)
          .then((ses) => {
            session = ses; // sets reference to be describe-wide
            setSession(ses);
          })
          .then(from3)
          .catch(done);
      })
      .catch(done);
  });

  afterEach(() => {
    if (session) {
      session.close();
      setSession(null);
      session = null;
    }
  });

  const authKey = () => {
    return `0:2:${new Date().getTime().toString(36)}`;
  };

  const findValue = (sid, id) => {
    return new Promise((resolve, reject) => {
      MongoLib(config.mongoUrl, 'values')
        .then(([valDb]) => {
          valDb
            .findOne({sid: valDb.ObjectId(sid), id})
            .then(resolve, reject)
            .catch(reject);
        })
        .catch(reject);
    });
  };

  it('module is a function', function(done) {
    expect(LibValues).to.be.a('function');
    done();
  });

  it('inited module has the correct methods', function(done) {
    LibValues(config).then(({Values, sync}) => {
      expect(Values).to.be.a('function');
      expect(sync).to.be.a('function');
      done();
    })
    .catch(done);
  });

  it('new values with duplicate ids #1', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          sync(ses, {
            'new': [
              ['test', 'testData'],
              ['test', 'otherData'],
            ],
          })
          .then(([syncData, status]) => {
            expect(status.fails).to.equal(1);
            expect(status.ok.new).to.have.length(1);
            expect(status.ok.new[0]).to.equal('test');
            expect(Object.keys(status.fail.new)).to.have.length(1);
            expect(status.fail.new.test.code).to.equal(-17);
            findValue(ses.id, 'test')
              .then((doc) => {
                expect(doc.data).to.equal('testData');
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

  it('new values with duplicate ids #2', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          sync(ses, {'new': [['test', 'testData']]})
            .then(() => {
              sync(ses, {'new': [['test', 'otherData']]})
                .then(([syncData, status]) => {
                  expect(status.fails).to.equal(1);
                  expect(Object.keys(status.fail.new)).to.have.length(1);
                  expect(status.fail.new.test.code).to.equal(-4);
                  findValue(ses.id, 'test')
                    .then((doc) => {
                      expect(doc.data).to.equal('testData');
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
  });

  it('set values with duplicate ids', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          sync(ses, {'new': [['test', 'testData']]})
            .then(() => {
              sync(ses, {'set': [
                ['test', 'otherData'],
                ['test', 'otherData2'],
              ]})
                .then(([syncData, status]) => {
                  expect(status.fails).to.equal(1);
                  expect(Object.keys(status.fail.set)).to.have.length(1);
                  expect(status.fail.set.test.code).to.equal(-18);
                  findValue(ses.id, 'test')
                    .then((doc) => {
                      expect(doc.data).to.equal('otherData');
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
  });

  it('del values with duplicate ids', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          sync(ses, {'new': [['test', 'testData']]})
            .then(() => {
              sync(ses, {'del': ['test', 'test']})
                .then(([syncData, status]) => {
                  expect(status.fails).to.equal(1);
                  expect(Object.keys(status.fail.del)).to.have.length(1);
                  expect(status.fail.del.test.code).to.equal(-19);
                  findValue(ses.id, 'test')
                    .then((doc) => {
                      expect(doc).to.equal(null);
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
  });
});
