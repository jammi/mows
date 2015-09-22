'use strict'

http = require 'http'

digest = (->
  {createHash} = require 'crypto'
  (key, seed='') ->
    createHash('sha1')
      .update(seed)
      .update(key)
      .digest('hex')
)()

{generate: genRandomString} = require 'randomstring'

module.exports = (config, values) ->

  config = {} unless config?

  config.host = 'localhost' unless config.host?
  config.port = 8001 unless config.port?
  config.path = '/' unless config.path?
  config.pollThrottle = 100 unless config.pollThrottle?
  config.idlePoll = 5000 unless config.idlePoll?
  config.step = true unless config.step?
  config.verbose = false unless config.verbose?

  session =
    seq: 0
    key: genRandomString(40)
    values: {}
    valueSync: {'new': [], 'set': [], 'del': []}

  willPoll = true # initially true, to complete hello -> x quickly
  pollSoon = ->
    # console.log 'pollSoon'
    willPoll = true

  unless values?
    values = require('./http-client-values')({
      anyListeners:
        'new': [pollSoon]
        'set': [pollSoon]
        'del': [pollSoon]
      initValues: [
        # ['client.hello', 'Hi, says client!']
      ]
    })

  getPath = ->
    if session.seq is 0
      "#{config.path}hello"
    else
      "#{config.path}x"

  formatKey = (seq, key) ->
    "#{seq.toString(36)}:2:#{key}"

  valuesOut = {}

  syncReq = ->
    new Promise (resolve, reject) ->
      try
        values.initDefaults(session) if session.seq is 0
        data = [formatKey(session.seq, session.key), values.syncOut(session, valuesOut), []]
        strData = JSON.stringify(data)
        opts =
          hostname: config.host
          port: config.port
          path: getPath()
          method: 'POST'
          headers:
            'Content-Type': 'application/json; charset=utf-8'
            'Content-Length': Buffer.byteLength(strData, 'utf8')
        if config.verbose
          console.log "POST http://#{config.host}:#{config.port}#{opts.path}"
          console.log "req: #{strData}"
        req = http.request opts, (res) ->
          res.setEncoding('utf8')
          res.on('data', resolve)
          res.on('error', reject)
        req.write(strData)
        req.end()
        req.on('error', reject)
      catch err
        reject(err)

  incrementKey = (key) ->
    session.key = digest(key, session.key)
    session.seq += 1

  stopClient = false
  stop = -> stopClient = true
  start = -> stopClient = false

  sync = ->
    syncReq()
      .then (res) ->
        console.log "res: #{res}\n" if config.verbose
        [keyRaw, valuesIn, messagesIn] = JSON.parse(res)
        splitKey = keyRaw.split(':')
        if splitKey.length isnt 3
          throw new Error('Invalid session Key')
        else
        [seq, ver, key] = splitKey
        if ver isnt '1' and ver isnt '2'
          throw new Error('Unsupported Version')
        else
          incrementKey(key)
          [valuesIn, messagesIn]
      .then ([valuesIn, messagesIn]) ->
        values.syncIn(session, valuesIn)
        unless stopClient or config.step
          setTimeout ->
            willPoll = false
            sync()
          , if willPoll then config.pollThrottle else config.idlePoll
        [valuesIn, messagesIn, session]
      .catch (err) ->
        throw new Error(err)

  {sync, stop, start}
