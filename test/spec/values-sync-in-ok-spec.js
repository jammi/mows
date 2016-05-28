'use strict';

describe('Values sync in should succeed', function() {

  const {expect, config, Session, setSession} = require('./util')();

  const LibValues = require('../../lib/values');
  const MongoLib = require('../../lib/util/mongodb');

  // shared references for tests after this
  let session = null;

  beforeEach((done) => {
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then(([sesDb, valDb]) => {
        valDb.remove({});
        sesDb.remove({});
        Session(config)
          .then((ses) => {
            session = ses; // sets reference to be describe-wide
            setSession(ses);
            done();
          })
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

  it('sync no value events', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          sync(ses, {})
            .then(([syncData, status]) => {
              expect(syncData).to.deep.equal({});
              expect(status).to.be.an('object');
              expect(status).to.have.key('fails');
              expect(status.fails).to.equal(0);
              expect(status).to.not.have.key('ok');
              expect(status).to.not.have.key('fail');
              done();
            })
            .catch(done);
        })
        .catch(done);
    })
    .catch(done);
  });

  it('sync one "new" value event', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          const createdAfter = new Date().getTime();
          sync(ses, {
            'new': [
              ['test', 'testData'],
            ]
          })
          .then(([syncData, status]) => {
            expect(syncData).to.deep.equal({});
            expect(status.fails).to.equal(0);
            expect(status.ok.new).to.have.length(1);
            expect(status.ok.new[0]).to.equal('test');
            findValue(ses.id, 'test')
              .then((doc) => {
                const createdBefore = new Date().getTime();
                expect(doc.data).to.equal('testData');
                expect(doc.created).to.be.at.least(createdAfter);
                expect(doc.created).to.be.at.most(createdBefore);
                expect(doc.updated).to.be.at.least(createdAfter);
                expect(doc.updated).to.be.at.most(createdBefore);
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

  it('sync many "new" value events', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          sync(ses, {
            'new': [
              ['test0', 'testData'],
              ['test1', ['testData', 2, null, true]],
              ['test2', true],
              ['test3', false],
              ['test4', null],
              ['test5', {key: 'value', foo: 'bar'}],
              ['test6', 1234567890],
              ['test7', 0.12345678],
            ],
          })
          .then(([syncData, status]) => {
            expect(syncData).to.deep.equal({});
            expect(status.fails).to.equal(0);
            expect(status.ok.new).to.have.length(8);
            ['test0', 'test1', 'test2', 'test3', 'test4', 'test5', 'test6', 'test7'].forEach((id) => {
              expect(status.ok.new).to.contain(id);
            });
            done();
          })
          .catch(done);
        })
        .catch(done);
    })
    .catch(done);
  });

  it('sync one "set" value event', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          sync(ses, {
            'new': [
              ['test', 'initial value']
            ]
          })
          .then(([syncData, status]) => {
            const createdBefore = new Date().getTime();
            sync(ses, {
              'set': [
                ['test', 'changed value']
              ]
            })
            .then(([syncData, status]) => {
              expect(syncData).to.deep.equal({});
              expect(status.fails).to.equal(0);
              expect(status.ok.set).to.have.length(1);
              expect(status.ok.set[0]).to.equal('test');
            })
            .then(() => {
              findValue(ses.id, 'test')
                .then((doc) => {
                  const modifiedBefore = new Date().getTime();
                  expect(doc.data).to.equal('changed value');
                  expect(doc.updated).to.be.at.least(createdBefore);
                  expect(doc.updated).to.be.at.most(modifiedBefore);
                  done();
                })
                .catch(done);
            })
            .catch(done);
          })
          .catch(done);
        })
        .catch(done);
    })
    .catch(done);
  });

  it('sync many "set" value events', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          sync(ses, {
            'new': [
              ['test0', 'initial data'],
              ['test1', ['initial data', 2, null, true]],
              ['test2', true],
              ['test3', false],
              ['test4', null],
              ['test5', {key: 'value1', foo: 'bar1'}],
              ['test6', 1234567890],
              ['test7', 0.12345678],
            ],
          })
          .then(([syncData0, status0]) => {
            const createdBefore = new Date().getTime();
            sync(ses, {
              'set': [
                ['test0', 'changed data'],
                ['test1', ['changed data', 3, 'not null', false]],
                ['test2', false],
                ['test3', true],
                ['test4', 'not null'],
                ['test5', {key: 'value2', foo: 'bar2'}],
                ['test6', 9876543210],
                ['test7', 9.87654321],
              ],
            })
            .then(([syncData, status]) => {
              expect(syncData).to.deep.equal({});
              expect(status.fails).to.equal(0);
              expect(status.ok.set).to.have.length(8);
              const modifiedBefore = new Date().getTime();
              let asyncs = 0;
              const asyncPlus = () => {
                asyncs += 1;
              };
              const asyncMinus = () => {
                asyncs -= 1;
                if (asyncs === 0) {
                  done();
                }
              };
              const verifyData = {
                'test0': 'changed data',
                'test1': ['changed data', 3, 'not null', false],
                'test2': false,
                'test3': true,
                'test4': 'not null',
                'test5': {key: 'value2', foo: 'bar2'},
                'test6': 9876543210,
                'test7': 9.87654321,
              };
              ['test0', 'test1', 'test2', 'test3', 'test4', 'test5', 'test6', 'test7'].forEach((id) => {
                expect(status.ok.set).to.contain(id);
                asyncPlus();
                findValue(ses.id, id)
                  .then((doc) => {
                    expect(doc.data).to.deep.equal(verifyData[id]);
                    expect(doc.updated).to.be.at.least(createdBefore);
                    expect(doc.updated).to.be.at.most(modifiedBefore);
                    asyncMinus();
                  })
                  .catch(done);
              });
            })
            .catch(done);
          })
          .catch(done);
        })
        .catch(done);
    })
    .catch(done);
  });

  it('sync one "del" value event', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          sync(ses, {
            'new': [
              ['test', 'initial value']
            ]
          })
          .then(([syncData0, status0]) => {
            const createdBefore = new Date().getTime();
            sync(ses, {'del': ['test']})
            .then(([syncData, status]) => {
              expect(syncData).to.deep.equal({});
              expect(status.fails).to.equal(0);
              expect(status.ok.del).to.have.length(1);
              expect(status.ok.del[0]).to.equal('test');
            })
            .then(() => {
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
    })
    .catch(done);
  });

  it('sync many "del" value events', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          sync(ses, {
            'new': [
              ['test0', 'initial data'],
              ['test1', ['initial data', 2, null, true]],
              ['test2', true],
              ['test3', false],
              ['test4', null],
              ['test5', {key: 'value1', foo: 'bar1'}],
              ['test6', 1234567890],
              ['test7', 0.12345678],
            ],
          })
          .then(([syncData, status]) => {
            expect(syncData).to.deep.equal({});
            const createdBefore = new Date().getTime();
            sync(ses, {
              'del': [
                'test0', 'test1', 'test2', 'test3',
                'test4', 'test5', 'test6', 'test7',
              ],
            })
            .then(([syncData, status]) => {
              expect(syncData).to.deep.equal({});
              expect(status.fails).to.equal(0);
              expect(status.ok.del).to.have.length(8);
              let asyncs = 0;
              const asyncPlus = () => {
                asyncs += 1;
              };
              const asyncMinus = () => {
                asyncs -= 1;
                if (asyncs === 0) {
                  done();
                }
              };
              ['test0', 'test1', 'test2', 'test3', 'test4', 'test5', 'test6', 'test7'].forEach((id) => {
                expect(status.ok.del).to.contain(id);
                asyncPlus();
                findValue(ses.id, id)
                  .then((doc) => {
                    expect(doc).to.equal(null);
                    asyncMinus();
                  })
                  .catch(done);
              });
            })
            .catch(done);
          })
          .catch(done);
        })
        .catch(done);
    })
    .catch(done);
  });

  it('sync one "new" successed by one "set" value event for the same id', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          const createdAfter = new Date().getTime();
          sync(ses, {
            'new': [
              ['test', 'initial value'],
            ],
            'set': [
              ['test', 'changed value'],
            ]
          })
          .then(([syncData, status]) => {
            expect(syncData).to.deep.equal({});
            expect(status.fails).to.equal(0);
            expect(status.ok.new).to.have.length(1);
            expect(status.ok.new[0]).to.equal('test');
            expect(status.ok.set).to.have.length(1);
            expect(status.ok.set[0]).to.equal('test');
            findValue(ses.id, 'test')
              .then((doc) => {
                const modifiedBefore = new Date().getTime();
                expect(doc.data).to.equal('changed value');
                expect(doc.created).to.be.at.least(createdAfter);
                expect(doc.created).to.be.at.most(modifiedBefore);
                expect(doc.updated).to.be.at.least(createdAfter);
                expect(doc.updated).to.be.at.most(modifiedBefore);
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

  it('sync many "new" successed by many "set" value events for the same ids', function(done) {
    LibValues(config).then(({Values, sync}) => {
      session
        .auth(authKey())
        .then(([key, ses]) => {
          const createdAfter = new Date().getTime();
          sync(ses, {
            'new': [
              ['test0', 'initial data'],
              ['test1', ['initial data', 2, null, true]],
              ['test2', true],
              ['test3', false],
              ['test4', null],
              ['test5', {key: 'value1', foo: 'bar1'}],
              ['test6', 1234567890],
              ['test7', 0.12345678],
            ],
            'set': [
              ['test0', 'changed data'],
              ['test1', ['changed data', 3, 'not null', false]],
              ['test2', false],
              ['test3', true],
              ['test4', 'not null'],
              ['test5', {key: 'value2', foo: 'bar2'}],
              ['test6', 9876543210],
              ['test7', 9.87654321],
            ],
          })
          .then(([syncData, status]) => {
            const modifiedBefore = new Date().getTime();
            expect(syncData).to.deep.equal({});
            expect(status.fails).to.equal(0);
            expect(status.ok.new).to.have.length(8);
            expect(status.ok.set).to.have.length(8);
            let asyncs = 0;
            const asyncPlus = () => {
              asyncs += 1;
            };
            const asyncMinus = () => {
              asyncs -= 1;
              if (asyncs === 0) {
                done();
              }
            };
            const verifyData = {
              'test0': 'changed data',
              'test1': ['changed data', 3, 'not null', false],
              'test2': false,
              'test3': true,
              'test4': 'not null',
              'test5': {key: 'value2', foo: 'bar2'},
              'test6': 9876543210,
              'test7': 9.87654321,
            };
            ['test0', 'test1', 'test2', 'test3', 'test4', 'test5', 'test6', 'test7'].forEach((id) => {
              expect(status.ok.new).to.contain(id);
              expect(status.ok.set).to.contain(id);
              asyncPlus();
              findValue(ses.id, id)
                .then((doc) => {
                  expect(doc.data).to.deep.equal(verifyData[id]);
                  expect(doc.created).to.be.at.least(createdAfter);
                  expect(doc.created).to.be.at.most(modifiedBefore);
                  expect(doc.updated).to.be.at.least(createdAfter);
                  expect(doc.updated).to.be.at.most(modifiedBefore);
                  asyncMinus();
                })
                .catch(done);
            });
          })
          .catch(done);
        })
        .catch(done);
    })
    .catch(done);
  });

});
