'use strict'

module.exports = (config, mowsConfig) ->

  host = '127.0.0.1'

  express = require 'express'
  bodyParser = require 'body-parser'
  HttpPost = require '../src/http-post'
  Session = require '../src/session'
  Values  = require '../src/values'

  apps = []

  for i in [0..(config.numHttp-1)]
    (->
      port = config.httpBase + i
      app = express()
      app.use(bodyParser.json())
      Session(mowsConfig)
        .then ({auth, close}) ->
          Values(mowsConfig)
            .then ({sync}) ->
              HttpPost(auth, sync, console.log).post
            .then (post) ->
              app.post '/x', post
              app.post '/hello', post
              server = app.listen port, host, ->
                console.log "Test server listening at http://#{host}:#{port}"
              apps.push {app, server}
            .catch (err) ->
              console.error('Unable to start values:', err)
        .catch (err) ->
          console.error('Unable to start session:', err)
    )()

  apps
