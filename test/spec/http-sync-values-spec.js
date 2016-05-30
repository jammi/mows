'use strict';

describe('HTTP client post value sync tests', function() {

  const HttpClient = require('../../lib/http/client');

  const ClientValues = require('../../lib/http/client-values');

  const ServerValues = require('../../lib/values');

  let sesDb = null;
  let valDb = null;

  const {expect, config, Session} = require('./util')();

  const MongoLib = require('../../lib/util/mongodb');

  // shared references for tests after this
  let session = null;

  beforeEach((done) => {
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then(([_sesDb, _valDb]) => {
        let c = 3;
        const from3 = () => {
          c -= 1;
          if (c === 0) {
            done();
          }
        };
        valDb = _valDb;
        sesDb = _sesDb;
        valDb.remove({}).then(from3).catch(done);
        sesDb.remove({}).then(from3).catch(done);
        Session(config)
          .then((ses) => {
            session = ses; // sets reference to be describe-wide
          })
          .then(from3)
          .catch(done);
      });
  });

  afterEach((done) => {
    session.close().then(done).catch(done);
    session = null;
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
    return HttpClient(nginxConfig(), values);
  };

  const checkHandshake = ([val, messages, ses]) => {
    expect(messages).to.be.an('array');
    expect(messages).to.have.length(1);
    expect(messages[0]).to.have.key('syncStatus');
    const status = messages[0].syncStatus;
    if (status.fail) {
      console.log(status.fail);
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
      .then(checkHandshake)
      .then(([val, status, ses]) => {
        expect(status).to.include.key('ok');
        expect(status.ok).to.have.key('new');
        expect(status.ok.new).to.have.length(1);
        expect(status.ok.new[0]).to.equal('hellotest');
        sesDb
          .findOne({key: ses.key})
          .then((sesDoc) => {
            valDb
              .findById(sesDoc.values.hellotest)
              .then(doc => {
                expect(doc.data).to.equal('testClientData');
                done();
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('server creates value after the handshake request', (done) => {

    const client = initClient();

    const req1 = () => {
      client
        .sync()
        .then(checkHandshake)
        .then(([val, status, ses]) => {
          expect(status.fails).to.equal(0);
          expect(val).to.have.key('new');
          expect(val.new).to.be.an('array');
          expect(val.new).to.have.length(1);
          expect(val.new[0]).to.deep
            .equal(['servertest', 'this comes from the server']);
          done();
        })
        .catch(done);
    };

    client
      .sync()
      .then(checkHandshake)
      .then(([val, status, ses]) => {
        sesDb
          .findOne({key: ses.key})
          .then((sesDoc) => {
            ServerValues(config)
              .then(({valuesOf}) => {
                valuesOf({id: sesDoc._id})
                  .create('servertest', 'this comes from the server')
                  .then(req1)
                  .catch(done);
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });

  it('client and server create and set each other\'s values', (done) => {

    const valueSettings = clientDefaults();
    valueSettings.initValues.push(['hellotest', 'testClientData']);
    const initValues = ClientValues(valueSettings);
    const clientSettings = nginxConfig();
    clientSettings.verbose = false;
    const client = HttpClient(clientSettings, initValues);

    const req1 = () => {
      client
        .sync()
        .then(checkHandshake)
        .then(([val, status, ses]) => {
          expect(val.new).to
            .deep.equal([['servertest', 'this comes from the server']]);
          expect(val.set).to
            .deep.equal([['hellotest', 'serverChangedData']]);
          ses.values.servertest.set('client changed this');
          req2();
        })
        .catch(done);
    };

    const req2 = () => {
      client
        .sync()
        .then(checkHandshake)
        .then(([val, status, ses]) => {
          expect(status.ok.set).to.deep.equal(['servertest']);
          sesDb
            .findOne({key: ses.key})
            .then((sesDoc) => {
              valDb
                .findById(sesDoc.values.servertest)
                .then((valDoc) => {
                  expect(valDoc.data).to.equal('client changed this');
                  done();
                })
                .catch(done);
            })
            .catch(done);
        })
        .catch(done);
    };

    client
      .sync()
      .then(checkHandshake)
      .then(([val, status, ses]) => {
        expect(status.ok.new).to.deep.equal(['hellotest']);
        sesDb
          .findOne({key: ses.key})
          .then((sesDoc) => {
            ServerValues(config)
              .then(({valuesOf}) => {
                const sv = valuesOf({id: sesDoc._id});
                sv.create('servertest', 'this comes from the server')
                  .then(() => {
                    sv.set('hellotest', 'serverChangedData').then(req1);
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
