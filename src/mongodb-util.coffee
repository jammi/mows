'use strict'

{MongoClient, ObjectId} = require 'mongodb'

createAPI = (db, collName) ->

  coll = db.collection(collName)

  idQ = (id) -> {_id: new ObjectId(id)}

  insert = (data, opts) ->
    new Promise (resolve, reject) ->
      coll
        .insert data, opts, (err, result) ->
          if err
            reject {message: 'MOWS Mongo#insert error', err}
          else
            insertedIds = result.insertedIds
            insertedIds.shift() if not insertedIds?[0]?[0]
            resolve(insertedIds)

  insertOne = (data, opts) ->
    new Promise (resolve, reject) ->
      coll
        .insertOne data, opts, (err, result) ->
          if err
            reject {message: 'MOWS Mongo#insert error', err}
          else
            resolve(result.insertedId)

  update = (query, data, opts) ->
    new Promise (resolve, reject) ->
      coll
        .update query, data, opts, (err, result) ->
          if err
            reject {message: 'MOWS Mongo#update error', err}
          else
            resolve(result)

  set = (query, data) -> update(query, {$set: data}, {multi:true})

  setOne = (query, data) -> update(query, {$set: data}, {multi:false})

  find = (query, opts) ->
    new Promise (resolve, reject) ->
      coll
        .find query, opts, (err, docs) ->
          if err
            reject {message: 'MOWS Mongo#find error', err}
          else
            resolve(docs.toArray())

  findOne = (query, opts) ->
    new Promise (resolve, reject) ->
      coll
        .findOne query, opts, (err, doc) ->
          if err
            reject {message: 'MOWS Mongo#findOne error', err}
          else
            resolve(doc)

  remove = (query) ->
    new Promise (resolve, reject) ->
      coll
        .remove query, {multi: true}, (err, result) ->
          if err
            reject {message: 'MOWS Mongo#remove error', err}
          else
            resolve(result)

  removeOne = (query) ->
    new Promise (resolve, reject) ->
      coll
        .remove query, {multi: false}, (err, result) ->
          if err
            reject {message: 'MOWS Mongo#removeOne error', err}
          else
            resolve(result)

  updateById = (id, data) -> update(idQ(id), data)

  setById = (id, data) -> setOne(idQ(id), data)

  findById = (id) -> findOne(idQ(id))

  removeById = (id) -> remove(idQ(id))

  close = -> db.close()

  { # API:
    ObjectId, db, coll, collName, close
    insert, insertOne,
    update, updateById,
    set, setOne, setById,
    find, findOne, findById,
    remove, removeOne, removeById,
  }


module.exports = (url, collNames) ->
  new Promise (resolve, reject) ->
    MongoClient
      .connect url, (err, db) ->
        if err
          reject {message: 'MOWS Mongo#connect error', err}
        else
          if typeof collNames is 'string'
            collNames = [collNames]
          collNames = [] unless collNames instanceof Array
          apis = collNames.map (collName) ->
            createAPI(db, collName)
          resolve(apis)
