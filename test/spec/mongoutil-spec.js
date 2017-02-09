
const expect = require('chai').expect;

describe('MongoDB promisified utility', function() {

  const _util = require('./util')();
  const config = _util.config;

  const url = config.mongoUrl;

  const Mongo = require('../../lib/util/mongodb');

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

  it('is a function', function(done) {
    expect(Mongo).to.be.a('function');
    done();
  });

  it('inits correct interface by string', function(done) {
    Mongo(url, 'testcoll')
      .then(colls => {
        expect(colls).to.have.length(1);
        testInterface(colls[0]);
        return colls[0].close();
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });

  it('inits correct interface by arr', function(done) {
    Mongo(url, ['testcoll'])
      .then(colls => {
        expect(colls).to.have.length(1);
        testInterface(colls[0]);
        return colls[0].close();
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });

  it('inits multiple correct interfaces by arr', function(done) {
    Mongo(url, ['testcoll0', 'testcoll1'])
      .then(colls => {
        expect(colls).to.have.length(2);
        testInterface(colls[0]);
        testInterface(colls[1]);
        return Promise.all(colls.map(coll => {return coll.close();}));
      }, done)
      .then(arr => {
        expect(arr).to.have.length(2);
      }, done)
      .then(done, done);
  });

  it('ObjectId works correctly', function(done) {
    Mongo(url, 'testcoll')
      .then(_args => {
        const testcoll = _args[0];
        const objId = testcoll.ObjectId('abcdefghijkl');
        expect(objId.toString()).to.equal('6162636465666768696a6b6c');
        return testcoll.close();
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });

  it('insert works correctly', function(done) {
    let tc;
    let co;
    Mongo(url, 'testcoll')
      .then(_args => {
        tc = _args[0];
        co = tc.coll;
        return tc.insert({'foo': 'bar', 'one': 1});
      }, done)
      .then(ids => {
        expect(ids).to.have.length(1);
        const id = tc.ObjectId(ids[0]);
        return co.findOne({'_id': id}, {}, (err, doc) => {
          if (err) {
            done(err);
          }
          expect(doc.foo).to.equal('bar');
          expect(doc.one).to.equal(1);
          co.remove({'_id': id}, {multi: true});
          return tc.close();
        });
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });

  it('insertOne works correctly', function(done) {
    let tc;
    let co;
    Mongo(url, 'testcoll')
      .then(_args => {
        tc = _args[0];
        co = tc.coll;
        return tc.insertOne({'foo': 'bar', 'one': 1});
      }, done)
      .then(id => {
        co.findOne({'_id': id}, {}, (err, doc) => {
          if (err) {
            done(err);
          }
          expect(doc.foo).to.equal('bar');
          expect(doc.one).to.equal(1);
          co.remove({'_id': id}, {multi: true});
          return tc.close();
        });
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });

  it('find works correctly', function(done) {
    let tc;
    Mongo(url, 'testcoll')
      .then(_args => {
        tc = _args[0];
        return tc.insert({'foo': 'bar', 'one': 1, 'i': 1});
      }, done)
      .then(() => {
        return tc.insert({'foo': 'bar', 'two': 2, 'i': 2});
      }, done)
      .then(() => {
        return tc.find({'foo': 'bar'}, {sort: [['i', 'asc']]});
      }, done)
      .then(docs => {
        expect(docs).to.have.length(2);
        expect(docs[0].foo).to.equal('bar');
        expect(docs[0].foo).to.equal(docs[1].foo);
        expect(docs[0].one).to.equal(1);
        expect(docs[1].two).to.equal(2);
        tc.coll.remove({}, {multi: true});
        return tc.close();
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });

  it('findOne works correctly', function(done) {
    let tc;
    Mongo(url, 'testcoll')
      .then(_args => {
        tc = _args[0];
        return tc.insert({'foo': 'bar', 'one': 1, 'i': 0});
      }, done)
      .then(([id]) => {
        return tc.findOne({_id: id});
      }, done)
      .then(doc => {
        expect(doc.foo).to.equal('bar');
        expect(doc.one).to.equal(1);
        expect(doc.i).to.equal(0);
        tc.coll.remove({}, {multi: true});
        return tc.close();
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });

  it('findById works correctly #1', function(done) {
    let tc;
    Mongo(url, 'testcoll')
      .then(_args => {
        tc = _args[0];
        return tc.insert({'foo': 'bar', 'one': 1, 'i': 0});
      }, done)
      .then(([id]) => {
        return tc.findById(id);
      }, done)
      .then(doc => {
        expect(doc.foo).to.equal('bar');
        expect(doc.one).to.equal(1);
        expect(doc.i).to.equal(0);
        tc.coll.remove({}, {multi: true});
        return tc.close();
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });

  it('findById works correctly #2', function(done) {
    let tc;
    Mongo(url, 'testcoll')
      .then(_args => {
        tc = _args[0];
        return tc.insert({'foo': 'bar', 'one': 1, 'i': 0});
      }, done)
      .then(id => {
        return tc.findById(id.toString());
      }, done)
      .then(doc => {
        expect(doc.foo).to.equal('bar');
        expect(doc.one).to.equal(1);
        expect(doc.i).to.equal(0);
        tc.coll.remove({}, {multi: true});
        return tc.close();
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });

  it('update works correctly', function(done) {
    let tc;
    Mongo(url, 'testcoll')
      .then(_args => {
        tc = _args[0];
        return tc.insert({'foo': 'bar', 'one': 1});
      }, done)
      .then(() => {
        return tc.update({'foo': 'bar'}, {'foo': 'baz', 'two': 2});
      }, done)
      .then(() => {
        return tc.find({'foo': 'baz'});
      }, done)
      .then(docs => {
        expect(docs).to.have.length(1);
        const doc = docs[0];
        expect(doc.two).to.equal(2);
        tc.coll.remove({}, {multi: true});
        return tc.close();
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });

  it('remove works correctly', function(done) {
    let tc;
    Mongo(url, 'testcoll')
      .then(_args => {
        tc = _args[0];
        return tc.insert({'foo': 'bar', 'one': 1});
      }, done)
      .then(() => {
        return tc.remove({'foo': 'bar'}, {'foo': 'baz', 'two': 2});
      }, done)
      .then(() => {
        return tc.find({});
      }, done)
      .then(docs => {
        expect(docs).to.have.length(0);
        return tc.close();
      }, done)
      .then(() => {}, done)
      .then(done, done);
  });
});
