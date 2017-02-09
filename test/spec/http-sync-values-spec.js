
describe('HTTP client post value sync tests', function() {

  const Client = require('../../lib/http/client');
  const ClientValues = require('../../lib/http/client-values');
  const _Values = require('../../lib/values');

  let sesDb = null;
  let valDb = null;

  const {expect, config, Session} = require('./util')();

  const Mongo = require('../../lib/util/mongodb');

  // shared references for tests after this
  let session = null;

  beforeEach(done => {
    Mongo(config.mongoUrl, ['sessions', 'values'])
      .then(dbs => {
        sesDb = dbs[0];
        valDb = dbs[1];
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

  const nginxConfig = () => {
    return {
      host: 'localhost',
      port: 9080,
      path: '/',
    };
  };

  const clientDefaults = () => {
    return {anyListeners: {new: [], set: [], del: []}, initValues: []};
  };

  const initClient = (values) => {
    if (!values) {
      values = ClientValues(clientDefaults);
    }
    return Client(nginxConfig(), values);
  };

  const checkHandshake = ([val, messages, ses]) => {
    expect(messages).to.be.an('array');
    expect(messages).to.have.length(1);
    expect(messages[0]).to.have.key('syncStatus');
    const status = messages[0].syncStatus;
    if (status.fail) {
      console.dir(status.fail);
    }
    expect(status.fails).to.equal(0);
    return [val, status, ses];
  };

  it('client creates value on the handshake request', (done) => {

    const clientSettings = clientDefaults();
    clientSettings.initValues.push(['hellotest', 'testClientData']);
    const initValues = ClientValues(clientSettings);

    initClient(initValues)
      .sync()
      .then(checkHandshake, done)
      .then(([val, status, ses]) => {
        expect(status).to.include.key('ok');
        expect(status.ok).to.have.key('new');
        expect(status.ok.new).to.have.length(1);
        expect(status.ok.new[0]).to.equal('hellotest');
        return sesDb.findOne({key: ses.key});
      }, done)
      .then(sesDoc => {
        return valDb.findById(sesDoc.values.hellotest);
      }, done)
      .then(doc => {
        expect(doc.data).to.equal('testClientData');
      })
      .then(done, done);
  });

  it('server creates value after the handshake request', (done) => {

    const client = initClient();

    let _ses;
    client
      .sync()
      .then(checkHandshake, done)
      .then(([val, status, ses]) => {
        return sesDb.findOne({key: ses.key});
      }, done)
      .then(sesDoc => {
        _ses = sesDoc;
        return _Values(config);
      }, done)
      .then(({valuesOf}) => {
        return valuesOf({id: _ses._id}).create('servertest', 'this comes from the server');
      }, done)
      .then(() => {
        return client.sync();
      }, done)
      .then(checkHandshake, done)
      .then(([val, status, ses]) => {
        expect(status.fails).to.equal(0);
        expect(val).to.have.key('new');
        expect(val.new).to.be.an('array');
        expect(val.new).to.have.length(1);
        expect(val.new[0]).to.deep.equal(['servertest', 'this comes from the server']);
      }, done)
      .then(done, done);
  });

  it('client and server create and set each other\'s values', (done) => {

    const valueSettings = clientDefaults();
    valueSettings.initValues.push(['hellotest', 'testClientData']);
    const initValues = ClientValues(valueSettings);
    const clientSettings = nginxConfig();
    clientSettings.verbose = false;
    const client = Client(clientSettings, initValues);

    let sv;
    let _ses;

    client
      .sync()
      .then(checkHandshake, done)
      .then(([val, status, ses]) => {
        expect(status.ok.new).to.deep.equal(['hellotest']);
        return sesDb.findOne({key: ses.key});
      }, done)
      .then((sesDoc) => {
        _ses = sesDoc;
        return _Values(config);
      }, done)
      .then(({valuesOf}) => {
        sv = valuesOf({id: _ses._id});
        return sv.create('servertest', 'this comes from the server');
      }, done)
      .then(() => {
        return sv.set('hellotest', 'serverChangedData');
      }, done)
      .then(() => {
        return client.sync();
      }, done)
      .then(checkHandshake, done)
      .then(([val, status, ses]) => {
        expect(val.new).to.deep.equal([['servertest', 'this comes from the server']]);
        expect(val.set).to.deep.equal([['hellotest', 'serverChangedData']]);
        ses.values.servertest.set('client changed this');
      }, done)
      .then(() => {
        return client.sync();
      }, done)
      .then(checkHandshake, done)
      .then(([val, status, ses]) => {
        expect(status.ok.set).to.deep.equal(['servertest']);
        return sesDb.findOne({key: ses.key});
      }, done)
      .then((sesDoc) => {
        return valDb.findById(sesDoc.values.servertest);
      }, done)
      .then(valDoc => {
        expect(valDoc.data).to.equal('client changed this');
      }, done)
      .then(done, done);
  });
});
