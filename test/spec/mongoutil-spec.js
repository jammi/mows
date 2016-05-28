'use strict';

const expect = require('chai').expect;

describe('MongoUtil lib', function() {

  const _util = require('./util')();
  const config = _util.config;

  const url = config.mongoUrl;

  const MongoUtil = require('../../lib/util/mongodb');

  const testInterface = function(it) {
    [
      'ObjectId',
      'close', 'insert', 'update', 'set', 'find', 'remove',
      'findOne',
      'updateById', 'setById', 'findById', 'removeById'
    ].forEach(fn => {
      expect(it[fn]).to.be.a('function');
    });
  };

  it('is a function', done => {
    expect(MongoUtil).to.be.a('function');
    done();
  });

  it('inits correct interface by string', done => {
    MongoUtil(url, 'testcoll')
      .then(colls => {
        expect(colls).to.have.length(1);
        testInterface(colls[0]);
        colls[0].close();
        done();
      })
      .catch(done);
  });

  it('inits correct interface by arr', done => {
    MongoUtil(url, ['testcoll'])
      .then(colls => {
        expect(colls).to.have.length(1);
        testInterface(colls[0]);
        colls[0].close();
        done();
      })
      .catch(done);
  });

  it('inits multiple correct interfaces by arr', done => {
    MongoUtil(url, ['testcoll0', 'testcoll1'])
      .then(colls => {
        expect(colls).to.have.length(2);
        testInterface(colls[0]);
        testInterface(colls[1]);
        colls[0].close();
        colls[1].close();
        done();
      })
      .catch(done);
  });

  it('ObjectId works correctly', done => {
    MongoUtil(url, 'testcoll')
      .then(_args => {
        const testcoll = _args[0];
        const objId = testcoll.ObjectId('abcdefghijkl');
        expect(objId.toString()).to.equal('6162636465666768696a6b6c');
        testcoll.close();
        done();
      })
      .catch(done);
  });

  it('insert works correctly', done => {
    MongoUtil(url, 'testcoll')
      .then(_args => {
        const tc = _args[0];
        const co = tc.coll;
        tc.insert({'foo': 'bar', 'one': 1})
          .then(ids => {
            expect(ids).to.have.length(1);
            const id = tc.ObjectId(ids[0]);
            co.findOne({'_id': id}, {}, (err, doc) => {
              if (err) {
                done(err);
              }
              expect(doc.foo).to.equal('bar');
              expect(doc.one).to.equal(1);
              co.remove({'_id': id}, {multi: true});
              tc.close();
              done();
            });
          })
          .catch(done);
      })
      .catch(done);
  });

  it('insertOne works correctly', done => {
    MongoUtil(url, 'testcoll')
      .then(_args => {
        const tc = _args[0];
        const co = tc.coll;
        tc.insertOne({'foo': 'bar', 'one': 1})
          .then(id => {
            co.findOne({'_id': id}, {}, (err, doc) => {
              if (err) {
                done(err);
              }
              expect(doc.foo).to.equal('bar');
              expect(doc.one).to.equal(1);
              co.remove({'_id': id}, {multi: true});
              tc.close();
              done();
            });
          })
          .catch(done);
      })
      .catch(done);
  });

  it('find works correctly', done => {
    MongoUtil(url, 'testcoll')
      .then(_args => {
        const tc = _args[0];
        tc.insert({'foo': 'bar', 'one': 1, 'i': 1})
          .then(() => {
            tc.insert({'foo': 'bar', 'two': 2, 'i': 2})
              .then(() => {
                tc.find({'foo': 'bar'}, {sort: [['i', 'asc']]})
                  .then(docs => {
                    expect(docs).to.have.length(2);
                    expect(docs[0].foo).to.equal('bar');
                    expect(docs[0].foo).to.equal(docs[1].foo);
                    expect(docs[0].one).to.equal(1);
                    expect(docs[1].two).to.equal(2);
                    tc.coll.remove({}, {multi: true});
                    tc.close();
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

  it('findOne works correctly', done => {
    MongoUtil(url, 'testcoll')
      .then(_args => {
        const tc = _args[0];
        tc.insert({'foo': 'bar', 'one': 1, 'i': 0})
          .then(_args0 => {
            const id = _args0[0];
            tc.findOne({_id: id})
              .then(doc => {
                expect(doc.foo).to.equal('bar');
                expect(doc.one).to.equal(1);
                expect(doc.i).to.equal(0);
                tc.coll.remove({}, {multi: true});
                tc.close();
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('findById works correctly #1', done => {
    MongoUtil(url, 'testcoll')
      .then(_args => {
        const tc = _args[0];
        tc.insert({'foo': 'bar', 'one': 1, 'i': 0})
          .then(_args0 => {
            const id = _args0[0];
            tc.findById(id)
              .then(doc => {
                expect(doc.foo).to.equal('bar');
                expect(doc.one).to.equal(1);
                expect(doc.i).to.equal(0);
                tc.coll.remove({}, {multi: true});
                tc.close();
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('findById works correctly #2', done => {
    MongoUtil(url, 'testcoll')
      .then(_args => {
        const tc = _args[0];
        tc.insert({'foo': 'bar', 'one': 1, 'i': 0})
          .then(id => {
            tc.findById(id.toString())
              .then(doc => {
                expect(doc.foo).to.equal('bar');
                expect(doc.one).to.equal(1);
                expect(doc.i).to.equal(0);
                tc.coll.remove({}, {multi: true});
                tc.close();
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('update works correctly', done => {
    MongoUtil(url, 'testcoll')
      .then(_args => {
        const tc = _args[0];
        tc.insert({'foo': 'bar', 'one': 1})
          .then(() => {
            tc.update({'foo': 'bar'}, {'foo': 'baz', 'two': 2})
              .then(() => {
                tc.find({'foo': 'baz'})
                  .then(docs => {
                    expect(docs).to.have.length(1);
                    const doc = docs[0];
                    expect(doc.two).to.equal(2);
                    tc.coll.remove({}, {multi: true});
                    tc.close();
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

  it('remove works correctly', done => {
    MongoUtil(url, 'testcoll')
      .then(_args => {
        const tc = _args[0];
        tc.insert({'foo': 'bar', 'one': 1})
          .then(() => {
            tc.remove({'foo': 'bar'}, {'foo': 'baz', 'two': 2})
              .then(() => {
                tc.find({})
                  .then(docs => {
                    expect(docs).to.have.length(0);
                    tc.close();
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
