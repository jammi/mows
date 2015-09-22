
describe 'MongoUtil lib', ->

  {expect} = require 'chai'

  {config, dontExpectFail} = require('./util')()

  url = config.mongoUrl

  MongoUtil = require '../../src/mongodb-util'

  testInterface = (it) ->
    [
      'ObjectId',
      'close', 'insert', 'update', 'set', 'find', 'remove',
      'findOne',
      'updateById', 'setById', 'findById', 'removeById'
    ].forEach (fn) ->
      expect(it[fn]).to.be.a('function')

  it 'is a function', ->
    expect(MongoUtil).to.be.a('function')

  it 'inits correct interface by string', (done) ->
    MongoUtil(url, 'testcoll')
      .then (colls) ->
        expect(colls).to.have.length(1)
        testInterface(colls[0])
        colls[0].close()
        done()
      .then(null, done)

  it 'inits correct interface by arr', (done) ->
    MongoUtil(url, ['testcoll'])
      .then (colls) ->
        expect(colls).to.have.length(1)
        testInterface(colls[0])
        colls[0].close()
        done()
      .then(null, done)

  it 'inits multiple correct interfaces by arr', (done) ->
    MongoUtil(url, ['testcoll0', 'testcoll1'])
      .then (colls) ->
        expect(colls).to.have.length(2)
        testInterface(colls[0])
        testInterface(colls[1])
        colls[0].close()
        colls[1].close()
        done()
      .then(null, done)

  it 'ObjectId works correctly', (done) ->
    MongoUtil(url, 'testcoll')
      .then ([testcoll]) ->
        objId = testcoll.ObjectId('abcdefghijkl')
        expect(objId.toString()).to.equal('6162636465666768696a6b6c')
        testcoll.close()
        done()
      .then(null, done)

  it 'insert works correctly', (done) ->
    MongoUtil(url, 'testcoll')
      .then ([tc]) ->
        co = tc.coll
        tc.insert({'foo': 'bar', 'one': 1})
          .then (ids) ->
            expect(ids).to.have.length(1)
            id = tc.ObjectId(ids[0])
            co.findOne {'_id': id}, {}, (err, doc) ->
              expect(doc.foo).to.equal('bar')
              expect(doc.one).to.equal(1)
              co.remove({'_id': id}, {multi: true})
              tc.close()
              done()
          .then(null, done)
      .then(null, done)

  it 'insertOne works correctly', (done) ->
    MongoUtil(url, 'testcoll')
      .then ([tc]) ->
        co = tc.coll
        tc.insertOne({'foo': 'bar', 'one': 1})
          .then (id) ->
            co.findOne {'_id': id}, {}, (err, doc) ->
              expect(doc.foo).to.equal('bar')
              expect(doc.one).to.equal(1)
              co.remove({'_id': id}, {multi: true})
              tc.close()
              done()
          .then(null, done)
      .then(null, done)

  it 'find works correctly', (done) ->
    MongoUtil(url, 'testcoll')
      .then ([tc]) ->
        tc.insert({'foo': 'bar', 'one': 1, 'i': 1})
          .then ->
            tc.insert({'foo': 'bar', 'two': 2, 'i': 2})
              .then ->
                tc.find({'foo': 'bar'}, {sort: [['i', 'asc']]})
                  .then (docs) ->
                    expect(docs).to.have.length(2)
                    expect(docs[0].foo).to.equal('bar')
                    expect(docs[0].foo).to.equal(docs[1].foo)
                    expect(docs[0].one).to.equal(1)
                    expect(docs[1].two).to.equal(2)
                    tc.coll.remove({}, {multi: true})
                    tc.close()
                    done()
                  .then(null, done)
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'findOne works correctly', (done) ->
    MongoUtil(url, 'testcoll')
      .then ([tc]) ->
        tc.insert({'foo': 'bar', 'one': 1, 'i': 0})
          .then ([id]) ->
            tc.findOne({_id: id})
              .then (doc) ->
                expect(doc.foo).to.equal('bar')
                expect(doc.one).to.equal(1)
                expect(doc.i).to.equal(0)
                tc.coll.remove({}, {multi: true})
                tc.close()
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'findById works correctly #1', (done) ->
    MongoUtil(url, 'testcoll')
      .then ([tc]) ->
        tc.insert({'foo': 'bar', 'one': 1, 'i': 0})
          .then ([id]) ->
            tc.findById(id)
              .then (doc) ->
                expect(doc.foo).to.equal('bar')
                expect(doc.one).to.equal(1)
                expect(doc.i).to.equal(0)
                tc.coll.remove({}, {multi: true})
                tc.close()
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'findById works correctly #2', (done) ->
    MongoUtil(url, 'testcoll')
      .then ([tc]) ->
        tc.insert({'foo': 'bar', 'one': 1, 'i': 0})
          .then (id) ->
            tc.findById(id.toString())
              .then (doc) ->
                expect(doc.foo).to.equal('bar')
                expect(doc.one).to.equal(1)
                expect(doc.i).to.equal(0)
                tc.coll.remove({}, {multi: true})
                tc.close()
                done()
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'update works correctly', (done) ->
    MongoUtil(url, 'testcoll')
      .then ([tc]) ->
        tc.insert({'foo': 'bar', 'one': 1})
          .then ->
            tc.update({'foo': 'bar'}, {'foo': 'baz', 'two': 2})
              .then ->
                tc.find({'foo': 'baz'})
                  .then (docs) ->
                    expect(docs).to.have.length(1)
                    doc = docs[0]
                    expect(doc.two).to.equal(2)
                    tc.coll.remove({}, {multi: true})
                    tc.close()
                    done()
                  .then(null, done)
              .then(null, done)
          .then(null, done)
      .then(null, done)

  it 'remove works correctly', (done) ->
    MongoUtil(url, 'testcoll')
      .then ([tc]) ->
        tc.insert({'foo': 'bar', 'one': 1})
          .then ->
            tc.remove({'foo': 'bar'}, {'foo': 'baz', 'two': 2})
              .then ->
                tc.find({})
                  .then (docs) ->
                    expect(docs).to.have.length(0)
                    tc.close()
                    done()
                  .then(null, done)
              .then(null, done)
          .then(null, done)
      .then(null, done)

