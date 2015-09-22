
{expect} = require 'chai'

describe 'HTTP client post session handshake tests', ->

  HttpClient = require '../../src/http-client'

  ClientValues = require '../../src/http-client-values'

  nginxConfig =
    host: 'localhost'
    port: 9080
    path: '/'

  clientDefaults = -> {anyListeners: {new: [], set: [], del: []}, initValues: []}

  checkHandshake = (values, messages, session) ->
    expect(values).to.deep.equal({})
    expect(messages).to.be.an('array')
    expect(messages).to.have.length(1)
    expect(messages[0]).to.have.key('syncStatus')
    status = messages[0].syncStatus
    expect(status.fails).to.equal(0)

  it 'should handshake the session through nginx', (done) ->

    values = ClientValues(clientDefaults())

    HttpClient(nginxConfig, values)
      .sync()
      .then ([values, messages, session]) ->
        checkHandshake(values, messages, session)
        done()
      .then(null, done)


  it 'should handshake the session through express #1', (done) ->

    values = ClientValues(clientDefaults())

    HttpClient(
      host: 'localhost'
      port: 9400
      path: '/'
    values)
      .sync()
      .then ([values, messages, session]) ->
        checkHandshake(values, messages, session)
        done()
      .then(null, done)


  it 'should handshake the session through express #2', (done) ->

    values = ClientValues(clientDefaults())

    HttpClient(
      host: 'localhost'
      port: 9401
      path: '/'
    values)
      .sync()
      .then ([values, messages, session]) ->
        checkHandshake(values, messages, session)
        done()
      .then(null, done)


  it 'should handshake the session through express #3', (done) ->

    values = ClientValues(clientDefaults())

    HttpClient(
      host: 'localhost'
      port: 9402
      path: '/'
    values)
      .sync()
      .then ([values, messages, session]) ->
        checkHandshake(values, messages, session)
        done()
      .then(null, done)


  it 'should handshake the session through express #4', (done) ->

    values = ClientValues(clientDefaults())

    HttpClient(
      host: 'localhost'
      port: 9403
      path: '/'
    values)
      .sync()
      .then ([values, messages, session]) ->
        checkHandshake(values, messages, session)
        done()
      .then(null, done)


  it 'should handshake 250 simultaneous sessions through nginx', (done) ->

    cbs = 250
    cbMinus = ->
      cbs -= 1
      done() if cbs is 0

    for i in [0..250]
      setImmediate ->
        values = ClientValues(clientDefaults())
        HttpClient(nginxConfig, values)
          .sync()
          .then ([values, messages, session]) ->
            expect(values).to.deep.equal({})
            expect(messages).to.be.an('array')
            expect(messages).to.have.length(1)
            expect(messages[0]).to.have.key('syncStatus')
            status = messages[0].syncStatus
            expect(status.fails).to.equal(0)
            expect(session.seq).to.equal(1)
            cbMinus()
          .then(null, done)


  it 'should handshake 5 times 50 simultaneous sessions through nginx', (done) ->

    cbs = 50
    cbMinus = ->
      cbs -= 1
      done() if cbs is 0

    for i in [0..50]
      setImmediate ->
        values = ClientValues(clientDefaults())
        seq = 0
        client = HttpClient(nginxConfig, values)
        verifyClient = ([values, messages, session]) ->
          seq += 1
          expect(values).to.deep.equal({})
          expect(messages).to.be.an('array')
          expect(messages).to.have.length(1)
          expect(messages[0]).to.have.key('syncStatus')
          status = messages[0].syncStatus
          expect(status.fails).to.equal(0)
          expect(session.seq).to.equal(seq)
          if seq is 5
            cbMinus()
          else
            syncClient()
        syncClient = ->
          client.sync()
            .then(verifyClient)
            .then(null, done)
        syncClient()


  it 'should handshake 50 times 5 simultaneous sessions through nginx', (done) ->

    cbs = 5
    cbMinus = ->
      cbs -= 1
      done() if cbs is 0

    for i in [0..5]
      setImmediate ->
        values = ClientValues(clientDefaults())
        seq = 0
        client = HttpClient(nginxConfig, values)
        verifyClient = ([values, messages, session]) ->
          seq += 1
          expect(values).to.deep.equal({})
          expect(messages).to.be.an('array')
          expect(messages).to.have.length(1)
          expect(messages[0]).to.have.key('syncStatus')
          status = messages[0].syncStatus
          expect(status.fails).to.equal(0)
          expect(session.seq).to.equal(seq)
          if seq is 50
            cbMinus()
          else
            syncClient()
        syncClient = ->
          client.sync()
            .then(verifyClient)
            .then(null, done)
        syncClient()
