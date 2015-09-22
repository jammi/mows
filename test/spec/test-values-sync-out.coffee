
describe 'Values api sync out', ->

  { expect, config, Session, validateKey, setSession,
    expectFail, dontExpectFail, vars } = require('./util')()

  # shared references for tests after this
  sync = null
  session = null
  values = null
  sesId = null

  LibValues = require '../../src/values'
  MongoLib = require '../../src/mongodb-util'

  authKey = -> "0:2:#{new Date().getTime().toString(36)}"

  beforeEach (done) ->
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then ([sesDb, valDb]) ->
        c = 2
        from2 = ->
          c -= 1
          if c is 0
            Session(config)
              .then (ses) ->
                session = ses # sets reference to be describe-wide
                setSession(ses)
                LibValues(config)
                  .then (api) ->
                    sync = api.sync
                    session
                      .auth(authKey())
                      .then ([key, ses]) ->
                        sesId = ses.id
                        values = api.Values(ses.id)
                        done()
                      .then(null, done)
                  .then(null, done)
              .then(null, done)
        valDb.remove({}).then(from2)
        sesDb.remove({}).then(from2)

  afterEach ->
    if session?
      session.close()
      setSession(null)
      session = null


  findValue = (sid, id) ->
    new Promise (resolve, reject) ->
      MongoLib(config.mongoUrl, 'values')
        .then ([valDb]) ->
          valDb
            .findOne({sid: valDb.ObjectId(sid), id})
            .then(resolve, reject)
            .catch(reject)
        .catch(reject)

  testData = ->
    {
      one:1
      two: 'two'
      'true': true
      'false': false
      'null': null
      obj: {
        foo: 'bar'
        arr: [1, '2', 'three', false]
      }
      arr: [1, 2, 3, 'four', true]
    }

  it 'create value', (done) ->
    values
      .create('test', testData())
      .then ->
        sync({id: sesId}, {})
          .then ([syncData, status]) ->
            expect(syncData).to.have.key('new')
            expect(syncData).to.not.contain.keys(['set', 'del'])
            expect(syncData.new).to.deep.equal([['test', testData()]])
            done()
          .then(null, done)
      .then(null, done)

  it 'set value', (done) ->
    values
      .create('test', 'initial')
      .then ->
        sync({id: sesId}, {})
          .then ->
            values
              .set('test', testData())
              .then ->
                sync({id: sesId}, {})
                  .then ([syncData, status]) ->
                    expect(syncData).to.have.key(['set'])
                    expect(syncData).to.not.contain.keys(['new', 'del'])
                    expect(syncData.set).to.deep.equal([['test', testData()]])
                    done()
                  .then(null, done)
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'create and set the same value', (done) ->
    values
      .create('test', 'initial')
      .then ->
        values
          .set('test', testData())
          .then ->
            sync({id: sesId}, {})
              .then ([syncData, status]) ->
                expect(syncData).to.have.key('new')
                expect(syncData).to.not.contain.keys(['set', 'del'])
                expect(syncData.new).to.deep.equal([['test', testData()]])
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'create and del the same value', (done) ->
    values
      .create('test', 'initial')
      .then ->
        values
          .del('test')
          .then ->
            sync({id: sesId}, {})
              .then ([syncData, status]) ->
                expect(syncData).to.have.key('del')
                expect(syncData).to.not.contain.keys(['new', 'set'])
                expect(syncData.del).to.deep.equal(['test'])
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)
