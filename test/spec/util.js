
const expect = require('chai').expect;

module.exports = () => {

  const config = require('../config')().mowsConfig;

  const Session = require('../../lib/session');
  let session = null;
  const setSession = ses => {
    session = ses;
  };
  const vars = {};

  const digest = (() => {
    const createHash = require('crypto').createHash;
    return (key, seed) => {
      seed = seed ? seed : '';
      return createHash('sha1')
        .update(seed)
        .update(key)
        .digest('hex');
    };
  })();

  const updateKey = (seq, ver, oldKey, serverKey) => {
    seq = (parseInt(seq, 36)+1).toString(36);
    const newKey = digest(serverKey, oldKey);
    // console.log('updateKey');
    return [seq, ver, newKey].join(':');
  };

  const validateKey = (_vars, expectedSeq, done) => {
    return _args => {
      const serverKey = _args[0];
      const sesData = _args[1];
      const oldKey = _vars.key.split(':')[2];
      _vars.serverKey = serverKey;
      const splitKey = serverKey.split(':');
      expect(splitKey).to.have.length(3);
      const seq = splitKey[0];
      const ver = splitKey[1];
      const key = splitKey[2];
      expect(seq).to.equal(expectedSeq);
      expect(sesData.seq).to.be.a('number');
      expect(seq).to.equal(sesData.seq.toString(36));
      expect(ver).to.equal('2');
      _vars.key = updateKey(seq, ver, oldKey, key);
      expect(sesData.id).to.be.a('string');
      expect(sesData.id).to.have.length(24);
      expect(sesData.key).to.have.length(40);
      expect(sesData.key).to.be.a('string');
      expect(_vars.key.split(':')[2]).to.equal(sesData.key);
      expect(sesData.expires).to.be.a('number');
      expect(sesData.expires).to.be.above(new Date().getTime());
      // console.log('validateKey');
      done();
    };
  };

  const expectFail = (_args, done) => {
    const compStatus = _args[0];
    const compDescr = _args[1];
    return (_args2) => {
      const status = _args2[0];
      const descr = _args2[1];
      expect(status).to.equal(compStatus);
      if (compDescr) {
        expect(descr).to.be.an(typeof compDescr);
        for (const key in compDescr) {
          const value = compDescr[key];
          expect(descr[key]).to.be.a(typeof value);
          expect(descr[key]).to.equal(value);
        }
      }
      // console.log('expectFail');
      done();
    };
  };

  const dontExpectFail = _args => {
    throw new Error(
      'unexpected promise fail, ' +
      `got status: ${JSON.stringify(_args[0])}, ` +
      `descr: ${JSON.stringify(_args[1])}`
    );
  };

  return {
    expect: expect,
    setSession: setSession,
    vars: vars,
    config: config,
    Session: Session,
    digest: digest,
    updateKey: updateKey,
    validateKey: validateKey,
    expectFail: expectFail,
    dontExpectFail: dontExpectFail
  };
};
