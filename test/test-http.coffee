'use strict'

module.exports = (config, mowsConfig) ->

  host = '127.0.0.1'

  express = require 'express'
  Broker = require '../src/http-broker'

  apps = []

  for i in [0..(config.numHttp-1)]
    (->
      port = config.httpBase + i
      app = express()
      Broker(mowsConfig, console.error)
        .then (broker) ->
          app.use(broker)
        .then ->
          server = app.listen port, host, ->
            console.log "Test server listening at http://#{host}:#{port}"
          apps.push {app, server}
        .catch (err) ->
          console.error('Unable to start broker:', err)
    )()

  apps
