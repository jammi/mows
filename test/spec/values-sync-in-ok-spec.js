
describe('Values sync in should succeed', function() {

  const {expect, config, Session} = require('./util')();

  const _Values = require('../../lib/values');
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
        session = ses; // sets reference to be describe-wide
      }, done)
      .then(done, done);
  });

  afterEach((done) => {
    session
      .close()
      .then(() => {
        session = null;
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

  it('sync no value events', function(done) {
    let sync;
    _Values(config)
      .then(vapi => {
        sync = vapi.sync;
        return session.auth(authKey());
      }, done)
      .then(auth => {
        return sync(auth[1], {});
      }, done)
      .then(([syncData, status]) => {
        expect(syncData).to.deep.equal({});
        expect(status).to.be.an('object');
        expect(status).to.have.key('fails');
        expect(status.fails).to.equal(0);
        expect(status).to.not.have.key('ok');
        expect(status).to.not.have.key('fail');
      }, done)
      .then(done, done);
  });

  it('sync one "new" value event', function(done) {
    let _sync;
    let _ses;
    const createdAfter = new Date().getTime();
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
          ]
        });
      }, done)
      .then(([syncData, status]) => {
        expect(syncData).to.deep.equal({});
        expect(status.fails).to.equal(0);
        expect(status.ok.new).to.have.length(1);
        expect(status.ok.new[0]).to.equal('test');
        return findValue(_ses.id, 'test');
      }, done)
      .then(doc => {
        const createdBefore = new Date().getTime();
        expect(doc.data).to.equal('testData');
        expect(doc.created).to.be.at.least(createdAfter);
        expect(doc.created).to.be.at.most(createdBefore);
        expect(doc.updated).to.be.at.least(createdAfter);
        expect(doc.updated).to.be.at.most(createdBefore);
      }, done)
      .then(done, done);
  });

  it('sync many "new" value events', function(done) {
    let _sync;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        return _sync(ses, {
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
        });
      }, done)
      .then(([syncData, status]) => {
        expect(syncData).to.deep.equal({});
        expect(status.fails).to.equal(0);
        expect(status.ok.new).to.have.length(8);
        ['test0', 'test1', 'test2', 'test3', 'test4', 'test5', 'test6', 'test7'].forEach(id => {
          expect(status.ok.new).to.contain(id);
        });
      })
      .then(done, done);
  });

  it('sync one "set" value event', function(done) {
    let _sync;
    let _ses;
    let createdBefore;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        _ses = ses;
        return _sync(ses, {
          'new': [
            ['test', 'initial value']
          ]
        });
      }, done)
      .then(() => {
        createdBefore = new Date().getTime();
        return _sync(_ses, {
          'set': [
            ['test', 'changed value']
          ]
        });
      }, done)
      .then(([syncData, status]) => {
        expect(syncData).to.deep.equal({});
        expect(status.fails).to.equal(0);
        expect(status.ok.set).to.have.length(1);
        expect(status.ok.set[0]).to.equal('test');
      }, done)
      .then(() => {
        return findValue(_ses.id, 'test');
      }, done)
      .then(doc => {
        const modifiedBefore = new Date().getTime();
        expect(doc.data).to.equal('changed value');
        expect(doc.updated).to.be.at.least(createdBefore);
        expect(doc.updated).to.be.at.most(modifiedBefore);
      })
      .then(done, done);
  });

  it('sync many "set" value events', function(done) {
    let _sync;
    let _ses;
    let createdBefore;
    let modifiedBefore;
    let verifyData;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        _ses = ses;
        return _sync(ses, {
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
        });
      }, done)
      .then(() => {
        createdBefore = new Date().getTime();
        return _sync(_ses, {
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
        });
      }, done)
      .then(([syncData, status]) => {
        expect(syncData).to.deep.equal({});
        expect(status.fails).to.equal(0);
        expect(status.ok.set).to.have.length(8);
        modifiedBefore = new Date().getTime();
        verifyData = {
          'test0': 'changed data',
          'test1': ['changed data', 3, 'not null', false],
          'test2': false,
          'test3': true,
          'test4': 'not null',
          'test5': {key: 'value2', foo: 'bar2'},
          'test6': 9876543210,
          'test7': 9.87654321,
        };
        return Promise
          .all([
            'test0', 'test1', 'test2', 'test3',
            'test4', 'test5', 'test6', 'test7']
          .map(id => {
            expect(status.ok.set).to.contain(id);
            return findValue(_ses.id, id);
          }), done)
          .then(docs => {
            docs.forEach(doc => {
              expect(doc.data).to.deep.equal(verifyData[doc.id]);
              expect(doc.updated).to.be.at.least(createdBefore);
              expect(doc.updated).to.be.at.most(modifiedBefore);
            });
          }, done);
      }, done)
      .then(done, done);

  });

  it('sync one "del" value event', function(done) {
    let _sync;
    let _ses;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        _ses = ses;
        return _sync(_ses, {
          'new': [
            ['test', 'initial value']
          ]
        });
      }, done)
      .then(() => {
        return _sync(_ses, {'del': ['test']});
      }, done)
      .then(([syncData, status]) => {
        expect(syncData).to.deep.equal({});
        expect(status.fails).to.equal(0);
        expect(status.ok.del).to.have.length(1);
        expect(status.ok.del[0]).to.equal('test');
        return findValue(_ses.id, 'test');
      }, done)
      .then(doc => {
        expect(doc).to.equal(null);
      }, done)
      .then(done, done);
  });

  it('sync many "del" value events', function(done) {
    let _sync;
    let _ses;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        _ses = ses;
        return _sync(_ses, {
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
        });
      }, done)
      .then(([syncData]) => {
        expect(syncData).to.deep.equal({});
        return _sync(_ses, {
          'del': [
            'test0', 'test1', 'test2', 'test3',
            'test4', 'test5', 'test6', 'test7',
          ],
        });
      }, done)
      .then(([syncData, status]) => {
        expect(syncData).to.deep.equal({});
        expect(status.fails).to.equal(0);
        expect(status.ok.del).to.have.length(8);
        return Promise
          .all([
            'test0', 'test1', 'test2', 'test3',
            'test4', 'test5', 'test6', 'test7']
          .map(id => {
            expect(status.ok.del).to.contain(id);
            return findValue(_ses.id, id);
          }), done)
          .then(docs => {
            docs.forEach(doc => {
              expect(doc).to.equal(null);
            });
          }, done);
      }, done)
      .then(done, done);
  });

  it('sync one "new" successed by one "set" value event for the same id', function(done) {
    let _sync;
    let _ses;
    let createdAfter;
    let modifiedBefore;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        _ses = ses;
        createdAfter = new Date().getTime();
        return _sync(ses, {
          'new': [
            ['test', 'initial value'],
          ],
          'set': [
            ['test', 'changed value'],
          ]
        });
      }, done)
      .then(([syncData, status]) => {
        expect(syncData).to.deep.equal({});
        expect(status.fails).to.equal(0);
        expect(status.ok.new).to.have.length(1);
        expect(status.ok.new[0]).to.equal('test');
        expect(status.ok.set).to.have.length(1);
        expect(status.ok.set[0]).to.equal('test');
        return findValue(_ses.id, 'test');
      }, done)
      .then(doc => {
        modifiedBefore = new Date().getTime();
        expect(doc.data).to.equal('changed value');
        expect(doc.created).to.be.at.least(createdAfter);
        expect(doc.created).to.be.at.most(modifiedBefore);
        expect(doc.updated).to.be.at.least(createdAfter);
        expect(doc.updated).to.be.at.most(modifiedBefore);
      })
      .then(done, done);
  });

  it('sync many "new" successed by many "set" value events for the same ids', function(done) {
    let _sync;
    let _ses;
    let createdAfter;
    let modifiedBefore;
    let verifyData;
    _Values(config)
      .then(({sync}) => {
        _sync = sync;
        return session.auth(authKey());
      }, done)
      .then(([key, ses]) => {
        _ses = ses;
        createdAfter = new Date().getTime();
        return _sync(ses, {
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
        });
      }, done)
      .then(([syncData, status]) => {
        modifiedBefore = new Date().getTime();
        expect(syncData).to.deep.equal({});
        expect(status.fails).to.equal(0);
        expect(status.ok.new).to.have.length(8);
        expect(status.ok.set).to.have.length(8);
        verifyData = {
          'test0': 'changed data',
          'test1': ['changed data', 3, 'not null', false],
          'test2': false,
          'test3': true,
          'test4': 'not null',
          'test5': {key: 'value2', foo: 'bar2'},
          'test6': 9876543210,
          'test7': 9.87654321,
        };
        return Promise
          .all([
            'test0', 'test1', 'test2', 'test3',
            'test4', 'test5', 'test6', 'test7'
          ].map(id => {
            expect(status.ok.new).to.contain(id);
            expect(status.ok.set).to.contain(id);
            return findValue(_ses.id, id);
          }), done)
          .then(docs => {
            docs.forEach(doc => {
              expect(doc.data).to.deep.equal(verifyData[doc.id]);
              expect(doc.created).to.be.at.least(createdAfter);
              expect(doc.created).to.be.at.most(modifiedBefore);
              expect(doc.updated).to.be.at.least(createdAfter);
              expect(doc.updated).to.be.at.most(modifiedBefore);
            });
          }, done);
      }, done)
      .then(done, done);
  });

});
