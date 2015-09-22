

describe 'HTTP client post value sync tests', ->

  HttpClient = require '../../src/http-client'

  ClientValues = require '../../src/http-client-values'

  ServerValues = require '../../src/values'

  sesDb = null
  valDb = null
  session = null

  { expect, config, Session, validateKey } = require('./util')()

  MongoLib = require '../../src/mongodb-util'

  # shared references for tests after this
  session = null

  beforeEach (done) ->
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then ([_sesDb, _valDb]) ->
        c = 3
        from3 = ->
          c -= 1
          done() if c is 0
        valDb = _valDb
        sesDb = _sesDb
        valDb.remove({}).then(from3).then(null, done)
        sesDb.remove({}).then(from3).then(null, done)
        Session(config)
          .then (ses) ->
            session = ses # sets reference to be describe-wide
          .then(from3)
          .then(null, done)

  afterEach (done) ->
    session.close().then(done).then(null, done)
    session = null

  nginxConfig = ->
    host: 'localhost'
    port: 9080
    path: '/'

  clientDefaults = -> {anyListeners: {new: [], set: [], del: []}, initValues: []}

  initClient = (values) ->
    values = ClientValues(clientDefaults) unless values?
    HttpClient(nginxConfig(), values)

  checkHandshake = ([val, messages, ses]) ->
    expect(messages).to.be.an('array')
    expect(messages).to.have.length(1)
    expect(messages[0]).to.have.key('syncStatus')
    status = messages[0].syncStatus
    console.log status.fail if status.fail?
    expect(status.fails).to.equal(0)
    [val, status, ses]

  it 'client creates value on the handshake request', (done) ->

    clientSettings = clientDefaults()
    clientSettings.initValues.push(['hellotest', 'testClientData'])
    values = ClientValues(clientSettings)

    initClient(values)
      .sync()
      .then(checkHandshake)
      .then ([val, status, ses]) ->
        expect(status).to.include.key('ok')
        expect(status.ok).to.have.key('new')
        expect(status.ok.new).to.have.length(1)
        expect(status.ok.new[0]).to.equal('hellotest')
        sesDb
          .findOne({key: ses.key})
          .then (sesDoc) ->
            valDb
              .findById(sesDoc.values.hellotest)
              .then (doc) ->
                expect(doc.data).to.equal('testClientData')
                done()
      .then(null, done)


  it 'server creates value after the handshake request', (done) ->

    client = initClient()

    client
      .sync()
      .then(checkHandshake)
      .then ([val, status, ses]) ->
        sesDb
          .findOne({key: ses.key})
          .then (sesDoc) ->
            ServerValues(config)
              .then ({valuesOf}) ->
                sv = valuesOf({id: sesDoc._id})
                sv.create('servertest', 'this comes from the server')
                  .then(req1)
                  .then(null, done)
              .then(null, done)
          .then(null, done)
      .then(null, done)

    req1 = ->
      client
        .sync()
        .then(checkHandshake)
        .then ([val, status, ses]) ->
          expect(status.fails).to.equal(0)
          expect(val).to.have.key('new')
          expect(val.new).to.be.an('array')
          expect(val.new).to.have.length(1)
          expect(val.new[0]).to.deep
            .equal(['servertest', 'this comes from the server'])
          done()
        .then(null, done)


  it 'client and server create and set each other\'s values', (done) ->

    valueSettings = clientDefaults()
    valueSettings.initValues.push(['hellotest', 'testClientData'])
    values = ClientValues(valueSettings)
    clientSettings = nginxConfig()
    clientSettings.verbose = false
    client = HttpClient(clientSettings, values)

    client
      .sync()
      .then(checkHandshake)
      .then ([val, status, ses]) ->
        expect(status.ok.new).to.deep.equal(['hellotest'])
        sesDb
          .findOne({key: ses.key})
          .then (sesDoc) ->
            ServerValues(config)
              .then ({valuesOf}) ->
                sv = valuesOf({id: sesDoc._id})
                sv.create('servertest', 'this comes from the server')
                  .then ->
                    sv.set('hellotest', 'serverChangedData').then(req1)
                  .then(null, done)
              .then(null, done)
          .then(null, done)
      .then(null, done)

    req1 = ->
      client
        .sync()
        .then(checkHandshake)
        .then ([val, status, ses]) ->
          expect(val.new).to
            .deep.equal([['servertest', 'this comes from the server']])
          expect(val.set).to
            .deep.equal([['hellotest', 'serverChangedData']])
          ses.values.servertest.set('client changed this')
          req2()
        .then(null, done)

    req2 = ->
      client
        .sync()
        .then(checkHandshake)
        .then ([val, status, ses]) ->
          expect(status.ok.set).to.deep.equal(['servertest'])
          sesDb
            .findOne({key: ses.key})
            .then (sesDoc) ->
              valDb
                .findById(sesDoc.values.servertest)
                .then (valDoc) ->
                  expect(valDoc.data).to.equal('client changed this')
                  done()
                .then(null, done)
            .then(null, done)
        .then(null, done)
