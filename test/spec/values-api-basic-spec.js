'use strict';

describe('Values api basics work', function() {

  const {expect, config, Session, setSession} = require('./util')();

  // shared references for tests after this
  let session = null;
  let values = null;
  let sesId = null;

  const LibValues = require('../../src/values');
  const MongoLib = require('../../src/mongodb-util');

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
                  .then(({Values, sync}) => {
                    session
                      .auth(authKey())
                      .then(([key, ses1]) => {
                        sesId = ses1.id;
                        values = Values(ses1.id);
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
      });
  });

  afterEach(() => {
    if (session) {
      session.close();
      setSession(null);
      session = null;
    }
  });

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

  const verifySyncHasValue = (sid, id, types) => {
    if (typeof types === 'string') {
      types = [types];
    }
    return new Promise((resolve, reject) => {
      MongoLib(config.mongoUrl, 'sessions')
        .then(([sesDb]) => {
          sesDb
            .findById(sid)
            .then((sesObj) => {
              expect(sesObj).to.contain.keys(['valueSync', 'values']);
              expect(sesObj.valueSync).to.be.an('object');
              expect(sesObj.values).to.be.an('object');
              const valueSync = sesObj.valueSync;
              const valueMap = sesObj.values;
              let valueId;
              expect(valueSync).to.have.keys(['new', 'set', 'del']);
              expect(valueSync.new).to.to.be.an('array');
              expect(valueSync.set).to.to.be.an('array');
              expect(valueSync.del).to.to.be.an('array');
              if (!types.includes('del')) {
                expect(valueMap).to.have.key(id);
                expect(valueMap[id]).to.be.an('object');
                valueId = valueMap[id];
              }
              if (types.includes('new')) {
                expect(valueSync.new).to.have.length(1);
                expect(valueSync.new[0]).to.equal(id);
              }
              else {
                expect(valueSync.new).to.have.length(0);
              }
              if (types.includes('set')) {
                expect(valueSync.set).to.have.length(1);
                expect(valueSync.set[0]).to.equal(id);
              }
              else {
                expect(valueSync.set).to.have.length(0);
              }
              if (types.includes('del')) {
                expect(valueSync.del).to.have.length(1);
                expect(valueSync.del[0]).to.equal(id);
              }
              else {
                expect(valueSync.del).to.have.length(0);
              }
              findValue(sid, id)
                .then((doc) => {
                  if (types.includes('del')) {
                    expect(doc).to.equal(null);
                  }
                  else {
                    expect(doc).to.be.an('object');
                    expect(doc._id).to.deep.equal(valueId);
                  }
                  resolve([sesObj, doc]);
                })
                .catch(reject);
            })
            .catch(reject);
        })
        .catch(reject);
    });
  };

  it('create value with data:null', function(done) {
    values
      .create('test', null)
      .then(() => {
        findValue(sesId, 'test')
          .then((doc) => {
            verifySyncHasValue(sesId, 'test', 'new')
              .then(([sesObj, valObj]) => {
                expect(valObj.data).to.equal(null);
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('create value with data:true', function(done) {
    values
      .create('test', true)
      .then(() => {
        findValue(sesId, 'test')
          .then((doc) => {
            verifySyncHasValue(sesId, 'test', 'new')
              .then(([sesObj, valObj]) => {
                expect(valObj.data).to.equal(true);
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('create value with data:false', function(done) {
    values
      .create('test', false)
      .then(() => {
        findValue(sesId, 'test')
          .then((doc) => {
            verifySyncHasValue(sesId, 'test', 'new')
              .then(([sesObj, valObj]) => {
                expect(valObj.data).to.equal(false);
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('create value with data:"string"', function(done) {
    values
      .create('test', 'string')
      .then(() => {
        findValue(sesId, 'test')
          .then((doc) => {
            verifySyncHasValue(sesId, 'test', 'new')
              .then(([sesObj, valObj]) => {
                expect(valObj.data).to.equal('string');
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('create value with data:123456789', function(done) {
    values
      .create('test', 123456789)
      .then(() => {
        findValue(sesId, 'test')
          .then((doc) => {
            verifySyncHasValue(sesId, 'test', 'new')
              .then(([sesObj, valObj]) => {
                expect(valObj.data).to.equal(123456789);
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('create value with data:9.87654321', function(done) {
    values
      .create('test', 9.87654321)
      .then(() => {
        findValue(sesId, 'test')
          .then((doc) => {
            verifySyncHasValue(sesId, 'test', 'new')
              .then(([sesObj, valObj]) => {
                expect(valObj.data).to.equal(9.87654321);
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('create value with data:[1,"2",[true,null,false],{foo:"bar",one:1,two:"2"}]', function(done) {
    values
      .create('test', [1, '2', [true, null, false], {foo: 'bar', one: 1, two: '2'}])
      .then(() => {
        findValue(sesId, 'test')
          .then((doc) => {
            verifySyncHasValue(sesId, 'test', 'new')
              .then(([sesObj, valObj]) => {
                expect(valObj.data).to.deep.equal(
                  [1, '2', [true, null, false], {foo: 'bar', one: 1, two: '2'}]
                );
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('create value with data:{one:1, two:"two", "true": true, "false": false, "null": null, ' +
     'obj: {foo: "bar", arr: [1,"2","three",false]}, arr: [1,2,3,"four",true]}', function(done) {
    values
      .create('test', {
        one: 1, two: 'two', 'true': true, 'false': false, 'null': null, obj: {
          foo: 'bar', arr: [1, '2', 'three', false]
        }, arr: [1, 2, 3, 'four', true]
      })
      .then(() => {
        findValue(sesId, 'test')
          .then((doc) => {
            verifySyncHasValue(sesId, 'test', 'new')
              .then(([sesObj, valObj]) => {
                expect(valObj.data).to.deep.equal({
                  one: 1, two: 'two', 'true': true, 'false': false, 'null': null, obj: {
                    foo: 'bar', arr: [1, '2', 'three', false]
                  }, arr: [1, 2, 3, 'four', true]
                });
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('set value', function(done) {
    values
      .create('test', 'initial')
      .then(() => {
        values
          .set('test', 'changed')
          .then(() => {
            findValue(sesId, 'test')
              .then((doc) => {
                verifySyncHasValue(sesId, 'test', ['new', 'set'])
                  .then(([sesObj, valObj]) => {
                    expect(valObj.data).to.equal('changed');
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

  it('del value', function (done) {
    values
      .create('test', 'initial')
      .then(() => {
        values
          .del('test')
          .then(() => {
            findValue(sesId, 'test')
              .then((doc) => {
                verifySyncHasValue(sesId, 'test', ['del'])
                  .then(([sesObj, valObj]) => {
                    expect(valObj).to.equal(null);
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

  it('get value', function (done) {
    values
      .create('test', 'initial')
      .then(() => {
        values
          .get('test')
          .then((data) => {
            expect(data).to.equal('initial');
            done();
          })
          .catch(done);
      })
      .catch(done);
  });
});
