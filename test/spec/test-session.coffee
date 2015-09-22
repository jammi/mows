
describe 'Session', ->

  { expect, config, Session, validateKey, setSession,
    expectFail, dontExpectFail, vars } = require('./util')()

  MongoLib = require '../../src/mongodb-util'

  # shared references for tests after this
  session = null

  beforeEach (done) ->
    MongoLib(config.mongoUrl, ['sessions', 'values'])
      .then ([sesDb, valDb]) ->
        c = 3
        from3 = ->
          c -= 1
          done() if c is 0
        valDb.remove({}).then(from3).then(null, done)
        sesDb.remove({}).then(from3).then(null, done)
        Session(config)
          .then (ses) ->
            session = ses # sets reference to be describe-wide
            setSession(ses)
          .then(from3)
          .then(null, done)

  afterEach (done) ->
    session.close().then(done).then(null, done)
    setSession(null)
    session = null

  it 'module is a function', ->
    expect(Session).to.be.a('function')

  it 'inited module has the correct methods', (done) ->
    expect(session.auth).to.be.a('function')
    expect(session.close).to.be.a('function')
    done()


  it 'handles a new session', (done) ->
    vars.key = '0:2:abcdefghi'
    session
      .auth(vars.key)
      .then(validateKey(vars, '0', done))
      .then(null, done)


  it 'handles another new session', (done) ->
    vars.key = '0:2:jklmnopqrs'
    session
      .auth(vars.key)
      .then(validateKey(vars, '0', done))
      .then(null, done)

  it "handles the session for 500 iterations", (done) ->
    vars.key = '0:2:klmnopqrst'
    c = 500
    from500 = (e) ->
      c -= 1
      if e
        done(e)
      else if c is 0
        MongoLib(config.mongoUrl, 'sessions')
          .then ([sesDb]) ->
            sesDb
              .find({})
              .then (docs) ->
                expect(docs).to.have.length(1)
                done()
              .catch(null, done)
          .then(null, done)
      else
        session
          .auth(vars.key)
          .then(validateKey(vars, (500-c).toString(36), from500))
          .then(null, done)
    session
      .auth(vars.key)
      .then(validateKey(vars, '0', from500))
      .then(null, done)

  it 'fails with an invalid auth format #1', (done) ->
    session
      .auth('abcdefghi')
      .then(
        dontExpectFail
        expectFail([false, {error: 'Invalid Key Format', code: -3}], done)
      )
      .then(null, done)

  it 'fails with an invalid auth format #2', (done) ->
    session
      .auth('0:bcdefghi')
      .then(
        dontExpectFail
        expectFail([false, {error: 'Invalid Key Format', code: -3}], done)
      )
      .then(null, done)

  it 'fails with an invalid auth format #3', (done) ->
    session
      .auth('0:bc:de:fghi')
      .then(
        dontExpectFail
        expectFail([false, {error: 'Invalid Key Format', code: -3}], done)
      )
      .then(null, done)

  it 'fails with an invalid version format #1', (done) ->
    session
      .auth('a:-:defghi')
      .then(
        dontExpectFail
        expectFail([false, {error: 'Unsupported Version', code: -2}], done)
      )
      .then(null, done)

  it 'fails with an invalid version format #2', (done) ->
    session
      .auth('a:0:defghi')
      .then(
        dontExpectFail
        expectFail([false, {error: 'Unsupported Version', code: -2}], done)
      )
      .then(null, done)

  it 'fails with an invalid version format #3', (done) ->
    session
      .auth('a:3:defghi')
      .then(
        dontExpectFail
        expectFail([false, {error: 'Unsupported Version', code: -2}], done)
      )
      .then(null, done)


  it 'fails with an invalid key', (done) ->
    session
      .auth('a:2:defghi')
      .then(
        dontExpectFail
        expectFail([false, {error: 'Invalid Session Key', code: -1}], done)
      )
      .then(null, done)

