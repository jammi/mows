module.exports = ->
  {expect} = require 'chai'

  {mowsConfig:config} = require('../config')()

  Session = require '../../src/session'
  session = null
  setSession = (ses) -> session = ses
  vars = {}

  digest = (->
    {createHash} = require 'crypto'
    (key, seed='') ->
      createHash('sha1')
        .update(seed)
        .update(key)
        .digest('hex')
  )()

  updateKey = (seq, ver, oldKey, serverKey) ->
    seq = (parseInt(seq, 36)+1).toString(36)
    newKey = digest(serverKey, oldKey)
    [seq, ver, newKey].join(':')

  validateKey = (vars, expectedSeq, done) ->
    ([serverKey, sesData]) ->
      oldKey = vars.key.split(':')[2]
      vars.serverKey = serverKey
      splitKey = serverKey.split(':')
      expect(splitKey).to.have.length(3)
      [seq, ver, key] = splitKey
      expect(seq).to.equal(expectedSeq)
      expect(sesData.seq).to.be.a('number')
      expect(seq).to.equal(sesData.seq.toString(36))
      expect(ver).to.equal('2')
      vars.key = updateKey(seq, ver, oldKey, key)
      expect(sesData.id).to.be.a('string')
      expect(sesData.id).to.have.length(24)
      expect(sesData.key).to.have.length(40)
      expect(sesData.key).to.be.a('string')
      expect(vars.key.split(':')[2]).to.equal(sesData.key)
      expect(sesData.expires).to.be.a('number')
      expect(sesData.expires).to.be.above(new Date().getTime())
      done()

  expectFail = ([compStatus, compDescr], done) ->
    ([status, descr]) ->
      expect(status).to.equal(compStatus)
      if compDescr
        expect(descr).to.be.an(typeof compDescr)
        for key, value of compDescr
          expect(descr[key]).to.be.a(typeof value)
          expect(descr[key]).to.equal(value)
      done()

  dontExpectFail = ([status, descr]) ->
    err = [
      "unexpected promise fail, got status:", JSON.stringify(status),
      ', descr:' + JSON.stringify(descr)
    ].join('')
    throw new Error(err)

  { expect, setSession, vars,
    config, Session, digest, updateKey,
    validateKey, expectFail, dontExpectFail}
