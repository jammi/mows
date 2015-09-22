
describe 'Values sync in should succeed', ->

  { expect, config, Session, validateKey, setSession,
    expectFail, dontExpectFail, vars } = require('./util')()

  # shared references for tests after this
  session = null

  beforeEach (done) ->
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then ([sesDb, valDb]) ->
        valDb.remove({})
        sesDb.remove({})
        Session(config)
          .then (ses) ->
            session = ses # sets reference to be describe-wide
            setSession(ses)
            done()

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

  it 'sync no value events', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          createdAfter = new Date().getTime()
          sync(ses, {})
            .then ([syncData, status]) ->
              expect(syncData).to.deep.equal({})
              expect(status).to.be.an('object')
              expect(status).to.have.key('fails')
              expect(status.fails).to.equal(0)
              expect(status).to.not.have.key('ok')
              expect(status).to.not.have.key('fail')
              done()
            .then(null, done)
        .then(null, done)
    .then(null, done)

  it 'sync one "new" value event', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          createdAfter = new Date().getTime()
          sync ses, {
            'new': [
              ['test', 'testData']
            ]
          }
          .then ([syncData, status]) ->
            expect(syncData).to.deep.equal({})
            expect(status.fails).to.equal(0)
            expect(status.ok.new).to.have.length(1)
            expect(status.ok.new[0]).to.equal('test')
            findValue(ses.id, 'test')
              .then (doc) ->
                createdBefore = new Date().getTime()
                expect(doc.data).to.equal('testData')
                expect(doc.created).to.be.at.least(createdAfter)
                expect(doc.created).to.be.at.most(createdBefore)
                expect(doc.updated).to.be.at.least(createdAfter)
                expect(doc.updated).to.be.at.most(createdBefore)
                done()
              .then(null, done)
          .then(null, done)
        .then(null, done)
    .then(null, done)

  it 'sync many "new" value events', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          sync ses, {
            'new': [
              ['test0', 'testData']
              ['test1', ['testData', 2, null, true]]
              ['test2', true]
              ['test3', false]
              ['test4', null]
              ['test5', {key: 'value', foo: 'bar'}]
              ['test6', 1234567890]
              ['test7', 0.12345678]
            ]
          }
          .then ([syncData, status]) ->
            expect(syncData).to.deep.equal({})
            expect(status.fails).to.equal(0)
            expect(status.ok.new).to.have.length(8)
            [ 'test0', 'test1', 'test2', 'test3',
              'test4', 'test5', 'test6', 'test7'
            ].forEach (id) ->
              expect(status.ok.new).to.contain(id)
            done()
        .then(null, done)
    .then(null, done)

  it 'sync one "set" value event', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          sync ses, {
            'new': [
              ['test', 'initial value']
            ]
          }
          .then ([syncData, status]) ->
            createdBefore = new Date().getTime()
            sync ses, {
              'set': [
                ['test', 'changed value']
              ]
            }
            .then ([syncData, status]) ->
              expect(syncData).to.deep.equal({})
              expect(status.fails).to.equal(0)
              expect(status.ok.set).to.have.length(1)
              expect(status.ok.set[0]).to.equal('test')
            .then ->
              findValue(ses.id, 'test')
                .then (doc) ->
                  modifiedBefore = new Date().getTime()
                  expect(doc.data).to.equal('changed value')
                  expect(doc.updated).to.be.at.least(createdBefore)
                  expect(doc.updated).to.be.at.most(modifiedBefore)
                  done()
                .then(null, done)
            .then(null, done)
        .then(null, done)
    .then(null, done)

  it 'sync many "set" value events', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          sync ses, {
            'new': [
              ['test0', 'initial data']
              ['test1', ['initial data', 2, null, true]]
              ['test2', true]
              ['test3', false]
              ['test4', null]
              ['test5', {key: 'value1', foo: 'bar1'}]
              ['test6', 1234567890]
              ['test7', 0.12345678]
            ]
          }
          .then ([syncData, status]) ->
            createdBefore = new Date().getTime()
            sync ses, {
              'set': [
                ['test0', 'changed data']
                ['test1', ['changed data', 3, 'not null', false]]
                ['test2', false]
                ['test3', true]
                ['test4', 'not null']
                ['test5', {key: 'value2', foo: 'bar2'}]
                ['test6', 9876543210]
                ['test7', 9.87654321]
              ]
            }
            .then ([syncData, status]) ->
              expect(syncData).to.deep.equal({})
              expect(status.fails).to.equal(0)
              expect(status.ok.set).to.have.length(8)
              modifiedBefore = new Date().getTime()
              asyncs = 0
              asyncPlus = ->
                asyncs += 1
              asyncMinus = ->
                asyncs -= 1
                done() if asyncs is 0
              verifyData = {
                'test0': 'changed data'
                'test1': ['changed data', 3, 'not null', false]
                'test2': false
                'test3': true
                'test4': 'not null'
                'test5': {key: 'value2', foo: 'bar2'}
                'test6': 9876543210
                'test7': 9.87654321
              }
              [ 'test0', 'test1', 'test2', 'test3',
                'test4', 'test5', 'test6', 'test7'
              ].forEach (id) ->
                expect(status.ok.set).to.contain(id)
                asyncPlus()
                findValue(ses.id, id)
                  .then (doc) ->
                    expect(doc.data).to.deep.equal(verifyData[id])
                    expect(doc.updated).to.be.at.least(createdBefore)
                    expect(doc.updated).to.be.at.most(modifiedBefore)
                    asyncMinus()
                  .then(null, done)
            .then(null, done)
        .then(null, done)
    .then(null, done)

  it 'sync one "del" value event', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          sync ses, {
            'new': [
              ['test', 'initial value']
            ]
          }
          .then ([syncData, status]) ->
            createdBefore = new Date().getTime()
            sync ses, {'del': ['test']}
            .then ([syncData, status]) ->
              expect(syncData).to.deep.equal({})
              expect(status.fails).to.equal(0)
              expect(status.ok.del).to.have.length(1)
              expect(status.ok.del[0]).to.equal('test')
            .then ->
              findValue(ses.id, 'test')
                .then (doc) ->
                  expect(doc).to.equal(null)
                  done()
                .then(null, done)
            .then(null, done)
        .then(null, done)
    .then(null, done)

  it 'sync many "del" value events', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          sync ses, {
            'new': [
              ['test0', 'initial data']
              ['test1', ['initial data', 2, null, true]]
              ['test2', true]
              ['test3', false]
              ['test4', null]
              ['test5', {key: 'value1', foo: 'bar1'}]
              ['test6', 1234567890]
              ['test7', 0.12345678]
            ]
          }
          .then ([syncData, status]) ->
            expect(syncData).to.deep.equal({})
            createdBefore = new Date().getTime()
            sync ses, {
              'del': [
                'test0', 'test1', 'test2', 'test3',
                'test4', 'test5', 'test6', 'test7'
              ]
            }
            .then ([syncData, status]) ->
              expect(syncData).to.deep.equal({})
              expect(status.fails).to.equal(0)
              expect(status.ok.del).to.have.length(8)
              asyncs = 0
              asyncPlus = ->
                asyncs += 1
              asyncMinus = ->
                asyncs -= 1
                done() if asyncs is 0
              [ 'test0', 'test1', 'test2', 'test3',
                'test4', 'test5', 'test6', 'test7'
              ].forEach (id) ->
                expect(status.ok.del).to.contain(id)
                asyncPlus()
                findValue(ses.id, id)
                  .then (doc) ->
                    expect(doc).to.equal(null)
                    asyncMinus()
                  .then(null, done)
            .then(null, done)
        .then(null, done)
    .then(null, done)

  it 'sync one "new" successed by one "set" value event for the same id', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          createdAfter = new Date().getTime()
          sync ses, {
            'new': [
              ['test', 'initial value']
            ]
            'set': [
              ['test', 'changed value']
            ]
          }
          .then ([syncData, status]) ->
            expect(syncData).to.deep.equal({})
            expect(status.fails).to.equal(0)
            expect(status.ok.new).to.have.length(1)
            expect(status.ok.new[0]).to.equal('test')
            expect(status.ok.set).to.have.length(1)
            expect(status.ok.set[0]).to.equal('test')
            findValue(ses.id, 'test')
              .then (doc) ->
                modifiedBefore = new Date().getTime()
                expect(doc.data).to.equal('changed value')
                expect(doc.created).to.be.at.least(createdAfter)
                expect(doc.created).to.be.at.most(modifiedBefore)
                expect(doc.updated).to.be.at.least(createdAfter)
                expect(doc.updated).to.be.at.most(modifiedBefore)
                done()
              .then(null, done)
        .then(null, done)
    .then(null, done)


  it 'sync many "new" successed by many "set" value events for the same ids', (done) ->
    LibValues(config).then ({Values, sync}) ->
      session
        .auth(authKey())
        .then ([key, ses]) ->
          createdAfter = new Date().getTime()
          sync ses, {
            'new': [
              ['test0', 'initial data']
              ['test1', ['initial data', 2, null, true]]
              ['test2', true]
              ['test3', false]
              ['test4', null]
              ['test5', {key: 'value1', foo: 'bar1'}]
              ['test6', 1234567890]
              ['test7', 0.12345678]
            ]
            'set': [
              ['test0', 'changed data']
              ['test1', ['changed data', 3, 'not null', false]]
              ['test2', false]
              ['test3', true]
              ['test4', 'not null']
              ['test5', {key: 'value2', foo: 'bar2'}]
              ['test6', 9876543210]
              ['test7', 9.87654321]
            ]
          }
          .then ([syncData, status]) ->
            modifiedBefore = new Date().getTime()
            expect(syncData).to.deep.equal({})
            expect(status.fails).to.equal(0)
            expect(status.ok.new).to.have.length(8)
            expect(status.ok.set).to.have.length(8)
            asyncs = 0
            asyncPlus = ->
              asyncs += 1
            asyncMinus = ->
              asyncs -= 1
              done() if asyncs is 0
            verifyData = {
              'test0': 'changed data'
              'test1': ['changed data', 3, 'not null', false]
              'test2': false
              'test3': true
              'test4': 'not null'
              'test5': {key: 'value2', foo: 'bar2'}
              'test6': 9876543210
              'test7': 9.87654321
            }
            [ 'test0', 'test1', 'test2', 'test3',
              'test4', 'test5', 'test6', 'test7'
            ].forEach (id) ->
              expect(status.ok.new).to.contain(id)
              expect(status.ok.set).to.contain(id)
              asyncPlus()
              findValue(ses.id, id)
                .then (doc) ->
                  expect(doc.data).to.deep.equal(verifyData[id])
                  expect(doc.created).to.be.at.least(createdAfter)
                  expect(doc.created).to.be.at.most(modifiedBefore)
                  expect(doc.updated).to.be.at.least(createdAfter)
                  expect(doc.updated).to.be.at.most(modifiedBefore)
                  asyncMinus()
                .then(null, done)
        .then(null, done)
    .then(null, done)

