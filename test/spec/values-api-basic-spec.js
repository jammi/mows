
describe('Values api basics work', function() {

  const {expect, config, Session, setSession} = require('./util')();

  // shared references for tests after this
  let session = null;
  let values = null;
  let sesId = null;

  const LibValues = require('../../lib/values');
  const MongoLib = require('../../lib/util/mongodb');

  const authKey = () => {
    return `0:2:${new Date().getTime().toString(36)}`;
  };

  beforeEach((done) => {
    let sesDb;
    let valDb;
    let Values;
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then(dbs => {
        [sesDb, valDb] = dbs;
        return valDb.remove({});
      }, done)
      .then(() => {
        return sesDb.remove({});
      }, done)
      .then(() => {
        return Session(config);
      }, done)
      .then((ses) => {
        session = ses; // sets reference to be describe-wide
        setSession(ses);
        return LibValues(config);
      }, done)
      .then(vapi => {
        Values = vapi.Values;
        return session.auth(authKey());
      }, done)
      .then(auth => {
        const ses = auth[1];
        sesId = ses.id;
        values = Values(ses.id);
      }, done)
      .then(done, done);
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
          return valDb.findOne({sid: valDb.ObjectId(sid), id});
        }, reject)
        .then(resolve, reject);
    });
  };

  const verifySyncHasValue = (sid, id, types) => {
    if (typeof types === 'string') {
      types = [types];
    }
    return new Promise((resolve, reject) => {
      let sesObj;
      let valueId;
      MongoLib(config.mongoUrl, 'sessions')
        .then(([sesDb]) => {
          return sesDb.findById(sid);
        }, reject)
        .then(_sesObj => {
          sesObj = _sesObj;
          expect(sesObj).to.contain.keys(['valueSync', 'values']);
          expect(sesObj.valueSync).to.be.an('object');
          expect(sesObj.values).to.be.an('object');
          const valueSync = sesObj.valueSync;
          const valueMap = sesObj.values;
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
          return findValue(sid, id);
        }, reject)
        .then(doc => {
          if (types.includes('del')) {
            expect(doc).to.equal(null);
          }
          else {
            expect(doc).to.be.an('object');
            expect(doc._id).to.deep.equal(valueId);
          }
          return doc;
        }, reject)
        .then(resolve, reject);
    });
  };

  it('create value with data:null', function(done) {
    values
      .create('test', null)
      .then(() => {
        return findValue(sesId, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal(null);
        return verifySyncHasValue(sesId, 'test', 'new');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal(null);
      })
      .then(done, done);
  });

  it('create value with data:true', function(done) {
    values
      .create('test', true)
      .then(() => {
        return findValue(sesId, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal(true);
        return verifySyncHasValue(sesId, 'test', 'new');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal(true);
      })
      .then(done, done);
  });

  it('create value with data:false', function(done) {
    values
      .create('test', false)
      .then(() => {
        return findValue(sesId, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal(false);
        return verifySyncHasValue(sesId, 'test', 'new');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal(false);
      }, done)
      .then(done, done);
  });

  it('create value with data:"string"', function(done) {
    values
      .create('test', 'string')
      .then(() => {
        return findValue(sesId, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal('string');
        return verifySyncHasValue(sesId, 'test', 'new');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal('string');
      }, done)
      .then(done, done);
  });

  it('create value with data:123456789', function(done) {
    values
      .create('test', 123456789)
      .then(() => {
        return findValue(sesId, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal(123456789);
        return verifySyncHasValue(sesId, 'test', 'new');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal(123456789);
      }, done)
      .then(done, done);
  });

  it('create value with data:9.87654321', function(done) {
    values
      .create('test', 9.87654321)
      .then(() => {
        return findValue(sesId, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal(9.87654321);
        return verifySyncHasValue(sesId, 'test', 'new');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal(9.87654321);
      }, done)
      .then(done, done);
  });

  it('create value with data:[1,"2",[true,null,false],{foo:"bar",one:1,two:"2"}]', function(done) {
    values
      .create('test', [1, '2', [true, null, false], {foo: 'bar', one: 1, two: '2'}])
      .then(() => {
        return findValue(sesId, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.deep.equal(
          [1, '2', [true, null, false], {foo: 'bar', one: 1, two: '2'}]
        );
        return verifySyncHasValue(sesId, 'test', 'new');
      }, done)
      .then(doc => {
        expect(doc.data).to.deep.equal(
          [1, '2', [true, null, false], {foo: 'bar', one: 1, two: '2'}]
        );
      }, done)
      .then(done, done);
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
        return findValue(sesId, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.deep.equal({
          one: 1, two: 'two', 'true': true, 'false': false, 'null': null, obj: {
            foo: 'bar', arr: [1, '2', 'three', false]
          }, arr: [1, 2, 3, 'four', true]
        });
        return verifySyncHasValue(sesId, 'test', 'new');
      }, done)
      .then(doc => {
        expect(doc.data).to.deep.equal({
          one: 1, two: 'two', 'true': true, 'false': false, 'null': null, obj: {
            foo: 'bar', arr: [1, '2', 'three', false]
          }, arr: [1, 2, 3, 'four', true]
        });
      }, done)
      .then(done, done);
  });

  it('set value', function(done) {
    values
      .create('test', 'initial')
      .then(() => {
        return values.set('test', 'changed');
      }, done)
      .then(() => {
        return findValue(sesId, 'test');
      }, done)
      .then(doc => {
        expect(doc.data).to.equal('changed');
        return verifySyncHasValue(sesId, 'test', ['new', 'set']);
      }, done)
      .then(doc => {
        expect(doc.data).to.equal('changed');
      }, done)
      .then(done, done);
  });

  it('del value', function(done) {
    values
      .create('test', 'initial')
      .then(() => {
        return values.del('test');
      }, done)
      .then(() => {
        return findValue(sesId, 'test');
      }, done)
      .then(doc => {
        expect(doc).to.equal(null);
        return verifySyncHasValue(sesId, 'test', ['del']);
      }, done)
      .then(doc => {
        expect(doc).to.equal(null);
      }, done)
      .then(done, done);
  });

  it('get value', function(done) {
    values
      .create('test', 'initial')
      .then(() => {
        return values.get('test');
      }, done)
      .then((data) => {
        expect(data).to.equal('initial');
      }, done)
      .then(done, done);
  });
});
