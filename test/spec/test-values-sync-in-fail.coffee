
describe 'Values sync in should fail', ->

  { expect, config, Session, validateKey, setSession,
    expectFail, dontExpectFail, vars } = require('./util')()

  # shared references for tests after this
  session = null

  beforeEach (done) ->
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then ([sesDb, valDb]) ->
        c = 3
        from3 = ->
          c -= 1
          done() if c is 0
        valDb.remove({}).then(from3)
        sesDb.remove({}).then(from3)
        Session(config)
          .then (ses) ->
            session = ses # sets reference to be describe-wide
            setSession(ses)
          .then(from3)

  afterEach ->
    if session?
      session.close()
      setSession(null)
      session = null

  LibValues = require '../../src/values'
  MongoLib = require '../../src/mongodb-util'

  authKey = -> "0:2:#{new Date().getTime().toString(36)}"

  findValue = (sid, id) ->
    new Promise (resolve, reject) ->
      MongoLib(config.mongoUrl, 'values')
        .then ([valDb]) ->
          valDb
            .findOne({sid: valDb.ObjectId(sid), id})
            .then(resolve, reject)
            .catch(reject)
        .catch(reject)

  it 'module is a function', ->
    expect(LibValues).to.be.a('function')

  it 'inited module has the correct methods', (done) ->
    LibValues(config).then ({Values, sync}) ->
      expect(Values).to.be.a('function')
      expect(sync).to.be.a('function')
      done()
    .then(null, done)

  it 'new values with duplicate ids #1', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          sync ses, {
            'new': [
              ['test', 'testData']
              ['test', 'otherData']
            ]
          }
          .then ([syncData, status]) ->
            expect(status.fails).to.equal(1)
            expect(status.ok.new).to.have.length(1)
            expect(status.ok.new[0]).to.equal('test')
            expect(Object.keys(status.fail.new)).to.have.length(1)
            expect(status.fail.new.test.code).to.equal(-17)
            findValue(ses.id, 'test')
              .then (doc) ->
                expect(doc.data).to.equal('testData')
                done()
              .then(null, done)
          .then(null, done)
        .then(null, done)
    .then(null, done)

  it 'new values with duplicate ids #2', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          sync(ses, {'new': [['test', 'testData']]})
            .then ->
              sync(ses, {'new': [['test', 'otherData']]})
                .then ([syncData, status]) ->
                  expect(status.fails).to.equal(1)
                  expect(Object.keys(status.fail.new)).to.have.length(1)
                  expect(status.fail.new.test.code).to.equal(-4)
                  findValue(ses.id, 'test')
                    .then (doc) ->
                      expect(doc.data).to.equal('testData')
                      done()
                    .then(null, done)
                .then(null, done)
            .then(null, done)
        .then(null, done)


  it 'set values with duplicate ids', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          sync(ses, {'new': [['test', 'testData']]})
            .then ->
              sync ses, {'set': [
                ['test', 'otherData']
                ['test', 'otherData2']
              ]}
                .then ([syncData, status]) ->
                  expect(status.fails).to.equal(1)
                  expect(Object.keys(status.fail.set)).to.have.length(1)
                  expect(status.fail.set.test.code).to.equal(-18)
                  findValue(ses.id, 'test')
                    .then (doc) ->
                      expect(doc.data).to.equal('otherData')
                      done()
                    .then(null, done)
                .then(null, done)
            .then(null, done)
        .then(null, done)

  it 'del values with duplicate ids', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          sync(ses, {'new': [['test', 'testData']]})
            .then ->
              sync(ses, {'del': ['test', 'test']})
                .then ([syncData, status]) ->
                  expect(status.fails).to.equal(1)
                  expect(Object.keys(status.fail.del)).to.have.length(1)
                  expect(status.fail.del.test.code).to.equal(-19)
                  findValue(ses.id, 'test')
                    .then (doc) ->
                      expect(doc).to.equal(null)
                      done()
                    .then(null, done)
                .then(null, done)
            .then(null, done)
        .then(null, done)
