'use strict'

module.exports = (config) ->

  MongoUtil = require './mongodb-util'

  new Promise (expResolve, expReject) ->

    xport = {}

    MongoUtil(config.mongoUrl, ['sessions', 'values'])
      .then ([sesDb, valDb]) ->

        digest = (->
          {createHash} = require 'crypto'
          (key, seed='') ->
            createHash('sha1')
              .update(seed)
              .update(key)
              .digest('hex')
        )()

        {generate: genRandomString} = require 'randomstring'

        newKey = (len=config.keyLength) ->
          genRandomString(len)


        now = -> new Date().getTime()


        expiration = (seconds=config.timeout) ->
          Math.floor(now() + seconds * 1000)


        formatKey = (seq, key) -> "#{seq.toString(36)}:2:#{key}"


        createSession = (seed=genRandomString(24)) ->
          new Promise (resolve, reject) ->
            clientKey = newKey()
            key = digest(clientKey, seed)
            session = {
              key
              seq: 0
              expires: expiration(config.timeoutFirst)
              # id: @_id.toString()
              values: {}
              valueSync: {'new': [], 'set': [], 'del': []}
            }
            sesDb
              .insert(session)
              .then((result) ->
                session.id = session._id.toString()
                resolve([formatKey(session.seq, clientKey), session])
              reject)


        validateSession = (oldKey) ->
          new Promise (resolve, reject) ->
            sesDb
              .find({key: oldKey})
              .then (sessions) ->
                if sessions.length is 1
                  session = sessions[0]
                  clientKey = newKey()
                  key = digest(clientKey, oldKey)
                  [key, clientKey, session, {
                    $inc: {seq: 1}
                    $set: {key, expires: expiration()}
                  }]
                else
                  reject([false, {error: 'Invalid Session Key', code: -1}])
              .then ([key, clientKey, session, upData]) ->
                sesDb
                  .updateById(session._id, upData)
                  .then (result) ->
                    session.id = session._id.toString()
                    session.seq += 1
                    session.key = key
                    resolve([formatKey(session.seq, clientKey), session])
                  .catch(reject)
              .catch(reject)


        auth = (keyRaw) ->
          new Promise (resolve, reject) ->
            splitKey = keyRaw.split(':')
            if splitKey.length isnt 3
              reject([false, {error: 'Invalid Key Format', code: -3}])
            else
              [seq, ver, key] = splitKey
              if not seq.match(/([a-z0-9]+)/)
                reject([false, {error: 'Invalid Sequence Format', code: -4}])
              else if ver isnt '1' and ver isnt '2'
                reject([false, {error: 'Unsupported Version', code: -2}])
              else if seq is '0'
                createSession(key).then(resolve, reject)
              else
                validateSession(key).then(resolve, reject)


        log = (method, msg) ->
          console.log(
            "#{Math.floor(now()*1000).toString(36)} " +
            "\uD83D\uDC7B  MOWS Session##{method}: #{msg}")


        isStopped = false

        close = ->
          unless isStopped
            isStopped = true
            valDb.close()
            sesDb.close()


        sessionCleaner = ->
          unless isStopped
            t = now()
            sesDb
              .find({timeout: {$lt: t}})
              .then (sessions) ->
                unless sessions.length is 0
                  sessions.forEach (session) ->
                    valDb.remove({sid: session._id}, {multi: true})
                    sesDb.removeById(session._id)
                  amount = sessions.length
                  log('sessionCleaner', "expired #{amount} sessions")
                unless isStopped
                  nextClean = 1000 - (now() - t)
                  nextClean = 100 if nextClean < 100
                  setTimeout(sessionCleaner, nextClean)

        setTimeout(sessionCleaner, config.timeoutFirst * 1000) unless isStopped

        xport.auth = auth
        xport.close = close

        expResolve xport
