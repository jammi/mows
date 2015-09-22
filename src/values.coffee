'use strict'

###
# Error Format:
# -------------
# {message: 'descriptionOfErrorDetails', code: negativeNumber}
#
#
# Error Codes:
# ------------
#
#  -1: creation error: non-unique id
#  -2: creation error: generic error
#  -3: creation error: session update error
#  -4: syncIn.new requested with pre-existent id
#  -5: syncIn.new requested with multi-pre-existent ids found
#  -6: syncIn.new unknown error
#  -7: get error: not found
#  -8: get error: multiple existing ids found
#  -9: set error: session update failed
# -10: set error: value update failed
# -11: syncIn.del requested with nonexistent id
# -12: get error: unknown
# -13: syncIn.set requested with nonexistent id
# -14: syncIn.set requested with multiple pre-existent ids found
# -15: syncIn.set unknown error
# -16: syncIn error: unknown stage
# -17: syncIn.new: requested with multiple same ids
# -18: syncIn.set: requested with multiple same ids
# -19: syncIn.del: requested with multiple same ids
# -20: syncIn.del: database deletion error
# -21: del error: session update error
# -22: del error: value deletion error
#
#
###
module.exports = (config, initVars) ->

  if initVars?
    {anyListeners, initValues} = initVars
  if anyListeners?
    anyListeners.new = [] unless anyListeners.new?
    anyListeners.set = [] unless anyListeners.set?
    anyListeners.del = [] unless anyListeners.del?
  else
    anyListeners = {new: [], set: [], del: []}

  unless initValues?
    initValues = []

  MongoUtil = require './mongodb-util'
  GearmanUtil = require './gearman-util'

  gearman = GearmanUtil(config)

  MongoUtil(config.mongoUrl, ['sessions', 'values'])
  .then ([sesDb, valDb]) ->

    ObjectId = sesDb.ObjectId

    errLogger = console.error

    Values = (sid) ->

      sid = new ObjectId(sid)

      now = -> new Date().getTime()

      _collectArrs = (arrs) ->
        out = []
        arrs.forEach (arr) ->
          if arr instanceof Array
            out = out
              .concat(arr)
              .filter (item, i, self) -> (self.indexOf(item) is i)
        out

      _delegate = (id, workerId, event) ->
        data = get(id)
          .then (data) ->
            packet = {id, sid: sid.toString(), data}
            gearman
              .client(workerId, packet)
              .then(
                (data) ->
                  errLogger(
                    'MOWS Value#_delegate warning: Unexpected response data: ',
                    data
                  ) if data
                (err) -> errLogger('values error: ', err)
              )

      _delegateAll = (id, event) ->
        valDb
          .find({sid, id})
          .then (data) ->
            data["workers.#{event}"]
              .forEach (event) ->
                _delegate(id, workerId, event)

      create = (id, data, listeners) ->
        listeners = {} unless listeners?
        new Promise (resolve, reject) ->
          valDb
            .find({id, sid})
            .then (docs) ->
              if docs.length is 0
                dateTime = now() # epoch, ms
                # The value document:
                doc =
                  id: id
                  sid: sid
                  data: data
                  updated: dateTime
                  created: dateTime
                  workers:
                    set: _collectArrs([anyListeners.set, listeners.set])
                    del: _collectArrs([anyListeners.del, listeners.del])
                # The value document insertion and session update:
                valDb
                  .insertOne(doc)
                  .then (_id) ->
                    sesDb
                      .updateById sid,
                        $set: {"values.#{id}": doc._id}
                        $addToSet: {'valueSync.new': id}
                      .then ->
                        _collectArrs([anyListeners.new, listeners.new])
                          .forEach (workerId) ->
                            _delegate(id, workerId, 'new')
                        resolve()
                      .catch (err) ->
                        reject {
                          message: "MOWS Value#create session update; id '#{id}' error: #{err}",
                          code: -3
                        }
                  .catch (err) ->
                    reject {
                      message: "MOWS Value#create insertion; id '#{id}' error: #{err}",
                      code: -2
                    }
              else
                reject {
                  message: "MOWS Value#create error: Non-unique id '#{id}' specified",
                  code: -1
                }

      _clientCreated = (id, data) ->
        new Promise (resolve, reject) ->
          valDb
            .find({id, sid})
            .then (docs) ->
              if docs.length is 0
                dateTime = now() # epoch, ms
                # The value document:
                doc =
                  id: id
                  sid: sid
                  data: data
                  updated: dateTime
                  created: dateTime
                  workers:
                    set: anyListeners.set
                    del: anyListeners.del
                # The value document insertion and session update:
                valDb
                  .insertOne(doc)
                  .then (_id) ->
                    sesDb
                      .updateById sid,
                        $set: {"values.#{id}": doc._id}
                      .then ->
                        anyListeners.new.forEach (workerId) ->
                          _delegate(id, workerId, 'new')
                        resolve()
                      .catch (err) ->
                        reject {
                          message: "MOWS Value#_clientCreated session update; id '#{id}' error: #{err}",
                          code: -3
                        }
                  .catch (err) ->
                    reject {
                      message: "MOWS Value#_clientCreated insertion; id '#{id}' error: #{err}",
                      code: -2
                    }
              else
                reject {
                  message: "MOWS Value#_clientCreated error: Non-unique id '#{id}' specified",
                  code: -1
                }

      listen = (id, workerId, event) ->
        events =
          if Util.isArray(event)
            event
          else
            [event]
        addSet = {}
        events.forEach (event) ->
          if (event in ['set', 'del'])
            addSet["workers.#{event}"] = workerId
          else
            errLogger("MOWS Value#listen error: invalid event ('#{event}')")
        valDb
          .update({id, sid}, {
            $addToSet: addSet
          })

      ignore = (id, workerId, events) ->
        events =
          if Util.isArray(event)
            event
          else
            [event]
        addSet = {}
        events.forEach (event) ->
          if (event in ['set', 'del'])
            addSet["workers.#{event}"] = workerId
          else
            errLogger("MOWS Value#listen error: invalid event ('#{event}')")
        valDb
          .update({id, sid}, {
            $addToSet: addSet
          })

      get = (id) ->
        new Promise (resolve, reject) ->
          valDb
            .find({sid, id})
            .then (docs) ->
              if docs.length is 1
                doc = docs[0]
                resolve(doc.data)
              else if docs.length is 0
                reject {
                  message: "MOWS Value#get error: value '#{id}' not found"
                  code: -7
                }
              else
                reject {
                  message: "MOWS Value#get error: duplicate docs of id '#{id}': #{docs.map((doc)->doc._id)}"
                  code: -8
                }
            .catch (err) ->
              reject {
                message: "MOWS Value#get error; id '#{id}': generic error #{err}"
                code: -12
              }

      set = (id, data) ->
        new Promise (resolve, reject) ->
          valDb
            .setOne({sid, id}, {data, updated: now()})
            .then (result) ->
              sesDb
                .updateById sid, {
                  $addToSet: {'valueSync.set': id}
                }
                .then ->
                  _delegateAll(id, 'set')
                  resolve()
                .catch (err) ->
                  reject {
                    message: "MOWS Value#set error: value '#{id}' encountered session update error: #{err}"
                    code: -9
                  }
            .catch (err) ->
              reject {
                message: "MOWS Value#set error: value '#{id}' encountered value update error: #{err}"
                code: -10
              }

      _clientSet = (id, data) ->
        new Promise (resolve, reject) ->
          valDb
            .setOne({sid, id}, {data, updated: now()})
            .then (result) ->
              _delegateAll(id, 'set')
              resolve(result)
            .catch (err) ->
              reject {
                message: "MOWS Value#_clientSet error: value '#{id}' encountered value update error: #{err}"
                code: -10
              }

      del = (id) ->
        new Promise (resolve, reject) ->
          sesDb
            .updateById sid,
              $unset: {"values.#{id}": true}
              $pull: {
                'valueSync.new': id
                'valueSync.set': id
              }
              $addToSet: {'valueSync.del': id}
            .then ->
              valDb
                .remove({sid, id})
                .then (result) ->
                  _delegateAll(id, 'del')
                  resolve(result)
                .catch (err) ->
                  reject {
                    message: "MOWS Value#del error: value '#{id}' encountered value deletion error: #{err}"
                    code: -22
                  }
            .catch (err) ->
              reject {
                message: "MOWS Value#del error: value '#{id}' encountered session update error: #{err}"
                code: -21
              }

      _clientDel = (id) ->
        new Promise (resolve, reject) ->
          sesDb
            .updateById sid,
              $unset: {"values.#{id}": true}
              $pull: {
                'valueSync.new': id
                'valueSync.set': id
                'valueSync.del': id
              }
            .then ->
              valDb
                .remove({sid, id})
                .then ->
                  _delegateAll(id, 'del')
                  resolve()
                .catch (err) ->
                  reject {
                    message: "MOWS Value#del error: value '#{id}' encountered value deletion error: #{err}"
                    code: -22
                  }
            .catch (err) ->
              reject {
                message: "MOWS Value#del error: value '#{id}' encountered session update error: #{err}"
                code: -21
              }

      {create, _clientCreated, get, set, _clientSet, del, _clientDel, listen, ignore}

    _minimizedStatus = (status) ->
      if status.fails is 0
        delete status.fail
      else
        if Object.keys(status.fail.new).length is 0
          delete status.fail.new
        if Object.keys(status.fail.set).length is 0
          delete status.fail.set
        if Object.keys(status.fail.del).length is 0
          delete status.fail.del
      if status.ok.new.length is 0
        delete status.ok.new
      if status.ok.set.length is 0
        delete status.ok.set
      if status.ok.del.length is 0
        delete status.ok.del
      if Object.keys(status.ok).length is 0
        delete status.ok
      status

    syncIn = (sid, syncArrs) ->
      new Promise (resolve, reject) ->

        values = Values(sid)
        status = {
          ok: {'new': [], 'set': [], 'del': []}
          fail: {'new': {}, 'set': {}, 'del': {}}
          fails: 0
        }
        cbs = 0

        cbPlus = -> cbs += 1

        checkEndOfStage = (stage) ->
          if cbs is 0
            if stage is 'new'
              syncStage('set')
            else if stage is 'set'
              syncStage('del')
            else if stage is 'del'
              resolve(_minimizedStatus(status))
            else
              reject {
                message: "MOWS syncIn error: unknown stage '#{stage}'"
                code: -16
              }

        cbMinus = (stage) ->
          cbs -= 1
          checkEndOfStage(stage)

        sanitizeIn = (syncIn, type) ->
          valueList = syncIn[type]
          ids = []
          if type is 'del'
            valueList.filter (id) ->
              if ~ids.indexOf(id)
                status.fails += 1
                status.fail[type][id] = {
                  message: "MOWS syncIn error: duplicate id for the same 'del' sync operation: '#{id}', omitting last occurrence"
                  code: -19
                }
                false
              else
                ids.push(id)
                true
          else
            valueList.filter ([id, data]) ->
              if ~ids.indexOf(id)
                status.fails += 1
                status.fail[type][id] = {
                  message: "MOWS syncIn error: duplicate id for the same '#{type}' sync operation: '#{id}', omitting last occurrence"
                  code:
                    if type is 'new'
                      -17
                    else if type is 'set'
                      -18
                }
                false
              else
                ids.push(id)
                true

        sanitizeInDel = (valueList) ->
          sanitized = []
          valueList.forEach (id) ->
            unless ~sanitized.indexOf(id)
              sanitized.push(id)
          sanitized

        syncStage = (stage) ->
          if stage is 'new'
            if syncArrs.new?
              sanitizeIn(syncArrs, 'new')
              .forEach ([id, data]) ->
                cbPlus()
                values
                  .get(id)
                  .then (doc) ->
                    status.fail.new[id] = {
                      message: "MOWS syncIn error: value of id '#{id}' already exists!"
                      code: -4
                    }
                    status.fails += 1
                    cbMinus('new')
                  .catch ({code, message}) ->
                    # No document found; ok
                    if code is -7
                      values
                        ._clientCreated(id, data)
                        .then ->
                          status.ok.new.push(id)
                          cbMinus('new')
                        .catch (err) ->
                          status.fail.new[id] = err
                          status.fails += 1
                          cbMinus('new')
                    else if code is -8
                      status.fail.new[id] = {
                        message: "MOWS syncIn error: many values of id '#{id}' already exists!"
                        code: -5
                      }
                      status.fails += 1
                      cbMinus('new')
                    else
                      status.fail.new[id] = {
                        message: "MOWS syncIn error: unknown error when creating id '#{id}'"
                        code: -6
                      }
                      status.fails += 1
                      cbMinus('new')
            checkEndOfStage('new')
          if stage is 'set'
            if syncArrs.set?
              sanitizeIn(syncArrs, 'set')
              .forEach ([id, data]) ->
                cbPlus()
                values
                  .get(id)
                  .then (doc) ->
                    values
                      ._clientSet(id, data)
                      .then (result) ->
                        status.ok.set.push(id)
                        cbMinus('set')
                      .catch ([code, message]) ->
                        status.fail.set[id] = {code, message}
                        status.fails += 1
                        cbMinus('set')
                  .catch ([code, message]) ->
                    if code is -7
                      status.fail.set[id] = {
                        message: "MOWS syncIn error: no value of id '#{id}' found!"
                        code: -13
                      }
                    else if code is -8
                      status.fail.set[id] = {
                        message: "MOWS syncIn error: many values of id '#{id}' found!"
                        code: -14
                      }
                    else
                      status.fail.set[id] = {
                        message: "MOWS syncIn error: unknown error when setting id '#{id}'"
                        code: -15
                      }
                    status.fails += 1
                    cbMinus('set')
            checkEndOfStage('set')
          if stage is 'del'
            if syncArrs.del?
              sanitizeIn(syncArrs, 'del')
              .forEach (id) ->
                cbPlus()
                values
                  .get(id)
                  .then (doc) ->
                    values
                      ._clientDel(id)
                      .then ->
                        status.ok.del.push(id)
                        cbMinus('del')
                      .catch (err) ->
                        status.fail.del[id] = {
                          message: err
                          code: -20
                        }
                        status.fails += 1
                        cbMinus('del')
                  .catch (err) ->
                    status.fail.del[id] = {
                      message: err
                      code: -11
                    }
                    status.fails += 1
                    cbMinus('del')
            checkEndOfStage('del')
        syncStage('new')

    syncOut = (sid) ->
      new Promise (resolve, reject) ->
        syncData = {'new': [], set: [], del: []}
        sesDb
          .findById(sid)
          .then ({values, valueSync}) ->
            cbs =
              valueSync.new.length +
              valueSync.set.length +
              valueSync.del.length
            if cbs is 0
              resolve({})
            else
              cbMinus = ->
                cbs -= 1
                if cbs is 0
                  if syncData.new.length is 0
                    delete syncData.new
                  if syncData.set.length is 0
                    delete syncData.set
                  if syncData.del.length is 0
                    delete syncData.del
                  resolve(syncData)
              valueSync.new.forEach (id) ->
                _id = values[id]
                valDb
                  .findById(_id)
                  .then (doc) ->
                    syncData.new.push([id, doc.data])
                    sesDb
                      .updateById sid,
                        $pull: {
                          'valueSync.new': id
                        }
                      .then ->
                        cbMinus()
                      .catch(reject)
                  .catch(reject)
              valueSync.set.forEach (id) ->
                if ~valueSync.new.indexOf(id)
                  sesDb
                    .updateById sid,
                      $pull: {
                        'valueSync.set': id
                      }
                    .then ->
                      cbMinus()
                    .catch(reject)
                else
                  _id = values[id]
                  valDb
                    .findById(_id)
                    .then (doc) ->
                      syncData.set.push([id, doc.data])
                      sesDb
                        .updateById sid,
                          $pull: {
                            'valueSync.set': id
                          }
                        .then ->
                          cbMinus()
                        .catch(reject)
                    .catch(reject)
              valueSync.del.forEach (id) ->
                _id = values[id]
                syncData.del.push(id)
                sesDb
                  .updateById sid,
                    $pull: {
                      'valueSync.set': id
                    }
                  .then ->
                    cbMinus()
                  .catch(reject)


    {
      Values

      valuesOf: (session) -> Values(session.id)

      sync: (session, valuesIn) ->
        # if session.seq is 0
        #   initDefaults(session)
        new Promise (resolve, reject) ->
          syncIn(session.id, valuesIn)
            .then (status) ->
              syncOut(session.id)
                .then (syncData) ->
                  resolve([syncData, status])
                .catch(reject)
            .catch(reject)
    }
