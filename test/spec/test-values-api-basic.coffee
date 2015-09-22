
describe 'Values api basics work', ->

  { expect, config, Session, validateKey, setSession,
    expectFail, dontExpectFail, vars } = require('./util')()

  # shared references for tests after this
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
                  .then ({Values, sync}) ->
                    session
                      .auth(authKey())
                      .then ([key, ses]) ->
                        sesId = ses.id
                        values = Values(ses.id)
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

  verifySyncHasValue = (sid, id, types) ->
    types = [types] if typeof types is 'string'
    new Promise (resolve, reject) ->
      MongoLib(config.mongoUrl, 'sessions')
        .then ([sesDb]) ->
          sesDb
            .findById(sid)
            .then (sesObj) ->
              expect(sesObj).to.contain.keys(['valueSync','values'])
              expect(sesObj.valueSync).to.be.an('object')
              expect(sesObj.values).to.be.an('object')
              valueSync = sesObj.valueSync
              valueMap = sesObj.values
              expect(valueSync).to.have.keys(['new', 'set', 'del'])
              expect(valueSync.new).to.to.be.an('array')
              expect(valueSync.set).to.to.be.an('array')
              expect(valueSync.del).to.to.be.an('array')
              unless ~types.indexOf 'del'
                expect(valueMap).to.have.key(id)
                expect(valueMap[id]).to.be.an('object')
                value_id = valueMap[id]
              if ~types.indexOf 'new'
                expect(valueSync.new).to.have.length(1)
                expect(valueSync.new[0]).to.equal(id)
              else
                expect(valueSync.new).to.have.length(0)
              if ~types.indexOf 'set'
                expect(valueSync.set).to.have.length(1)
                expect(valueSync.set[0]).to.equal(id)
              else
                expect(valueSync.set).to.have.length(0)
              if ~types.indexOf 'del'
                expect(valueSync.del).to.have.length(1)
                expect(valueSync.del[0]).to.equal(id)
              else
                expect(valueSync.del).to.have.length(0)
              findValue(sid, id)
                .then (doc) ->
                  if ~types.indexOf 'del'
                    expect(doc).to.equal(null)
                  else
                    expect(doc).to.be.an('object')
                    expect(doc._id).to.deep.equal(value_id)
                  resolve([sesObj, doc])
                .catch(reject)
            .catch(reject)
        .catch(reject)

  it 'create value with data:null', (done) ->
    values
      .create('test', null)
      .then ->
        findValue(sesId, 'test')
          .then (doc) ->
            verifySyncHasValue(sesId, 'test', 'new')
              .then ([sesObj, valObj]) ->
                expect(valObj.data).to.equal(null)
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'create value with data:true', (done) ->
    values
      .create('test', true)
      .then ->
        findValue(sesId, 'test')
          .then (doc) ->
            verifySyncHasValue(sesId, 'test', 'new')
              .then ([sesObj, valObj]) ->
                expect(valObj.data).to.equal(true)
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'create value with data:false', (done) ->
    values
      .create('test', false)
      .then ->
        findValue(sesId, 'test')
          .then (doc) ->
            verifySyncHasValue(sesId, 'test', 'new')
              .then ([sesObj, valObj]) ->
                expect(valObj.data).to.equal(false)
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'create value with data:"string"', (done) ->
    values
      .create('test', 'string')
      .then ->
        findValue(sesId, 'test')
          .then (doc) ->
            verifySyncHasValue(sesId, 'test', 'new')
              .then ([sesObj, valObj]) ->
                expect(valObj.data).to.equal('string')
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'create value with data:123456789', (done) ->
    values
      .create('test', 123456789)
      .then ->
        findValue(sesId, 'test')
          .then (doc) ->
            verifySyncHasValue(sesId, 'test', 'new')
              .then ([sesObj, valObj]) ->
                expect(valObj.data).to.equal(123456789)
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'create value with data:9.87654321', (done) ->
    values
      .create('test', 9.87654321)
      .then ->
        findValue(sesId, 'test')
          .then (doc) ->
            verifySyncHasValue(sesId, 'test', 'new')
              .then ([sesObj, valObj]) ->
                expect(valObj.data).to.equal(9.87654321)
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'create value with data:[1,"2",[true,null,false],{foo:"bar",one:1,two:"2"}]', (done) ->
    values
      .create('test', [1,"2",[true,null,false],{foo:"bar",one:1,two:"2"}])
      .then ->
        findValue(sesId, 'test')
          .then (doc) ->
            verifySyncHasValue(sesId, 'test', 'new')
              .then ([sesObj, valObj]) ->
                expect(valObj.data).to.deep.equal(
                  [1,"2",[true,null,false],{foo:"bar",one:1,two:"2"}]
                )
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'create value with data:{one:1, two:"two", "true": true, "false": false, "null": null, obj: {foo: "bar", arr: [1,"2","three",false]}, arr: [1,2,3,"four",true]}', (done) ->
    values
      .create('test', {one:1, two:"two", "true": true, "false": false, "null": null, obj: {foo: "bar", arr: [1,"2","three",false]}, arr: [1,2,3,"four",true]})
      .then ->
        findValue(sesId, 'test')
          .then (doc) ->
            verifySyncHasValue(sesId, 'test', 'new')
              .then ([sesObj, valObj]) ->
                expect(valObj.data).to.deep.equal({one:1, two:"two", "true": true, "false": false, "null": null, obj: {foo: "bar", arr: [1,"2","three",false]}, arr: [1,2,3,"four",true]})
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'set value', (done) ->
    values
      .create('test', 'initial')
      .then ->
        values
          .set('test', 'changed')
          .then ->
            findValue(sesId, 'test')
              .then (doc) ->
                verifySyncHasValue(sesId, 'test', ['new', 'set'])
                  .then ([sesObj, valObj]) ->
                    expect(valObj.data).to.equal('changed')
                    done()
                  .then(null, done)
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'del value', (done) ->
    values
      .create('test', 'initial')
      .then ->
        values
          .del('test')
          .then ->
            findValue(sesId, 'test')
              .then (doc) ->
                verifySyncHasValue(sesId, 'test', ['del'])
                  .then ([sesObj, valObj]) ->
                    expect(valObj).to.equal(null)
                    done()
                  .then(null, done)
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'get value', (done) ->
    values
      .create('test', 'initial')
      .then ->
        values
          .get('test')
          .then (data) ->
            expect(data).to.equal('initial')
            done()
          .then(null, done)
      .then(null, done)
