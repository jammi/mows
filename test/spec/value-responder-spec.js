
describe.only('Simple value responder via MQ works', function() {

  const {expect, config, Session} = require('./util')();

  const Values = require('../../lib/values');
  const Mongo = require('../../lib/util/mongodb');

  // shared references for tests after this
  let session = null;
  const setSession = ses => {
    session = ses;
  };
  const unsetSession = () => {
    session = null;
  };

  beforeEach(done => {
    Mongo(config.mongoUrl, ['sessions', 'values'])
      .then(dbs => Promise.all(dbs.map(db => db.remove({}))))
      .then(() => Session(config))
      .then(setSession)
      .then(done)
      .catch(done);
  });

  afterEach(done => {
    session
      .close()
      .then(unsetSession)
      .then(done)
      .catch(done);
  });

  const authKey = () => `0:2:${new Date().getTime().toString(36)}`;

  const findValue = (sid, id) =>
    Mongo(config.mongoUrl, 'values')
      .then(([valDb]) =>
        valDb.findOne({sid: valDb.ObjectId(sid), id})
      );

  it('gets notified of a "new" value event', done => {
    done();
  });

  it('gets notified of a "set" value event', done => {
    done();
  });

  it('gets notified of a "del" value event', done => {
    done();
  });

});
