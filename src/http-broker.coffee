'use strict'

module.exports = (config, reporter) ->

  express = require 'express'
  bodyParser = require 'body-parser'
  cookieParser = require 'cookie-parser'
  Multer = require 'multer'

  GearmanUtil = require './gearman-util'
  gearman = GearmanUtil(config)

  HttpPost = require './http-post'


  Session = require '../src/session'
  Values  = require '../src/values'

  Session(config)
    .then ({auth, close}) ->
      Values(config)
        .then ({sync}) ->
          sesValueHandler = HttpPost(auth, sync, console.log).post
          app = express()
          app.use(bodyParser.json())
          app.use(bodyParser.urlencoded({extended: true}))
          app.use(Multer(storage: Multer.MemoryStorage).any())
          app.use(cookieParser())
          app.post('/x', sesValueHandler)
          app.post('/hello', sesValueHandler)
          app.all '*', (req, res, next) ->
            reqIdent =
              ip: req.ip
              uri: req.path
              url: req.originalUrl
              host: req.hostname
              query: req.query
              https: req.secure
              method: req.method
              cookies: req.cookies
              reqHeaders: req.jotain
            gearman
              .client('httpRespondTo?', reqIdent)
              .then (data) ->
                respondersLeft = data.responders.length
                if respondersLeft is 0
                  next()
                else
                  reqData = reqIdent
                  reqData.body = req.body
                  reqData.files = req.files
                  data
                    .responders
                    .forEach (responderId) ->
                      gearman
                        .client(responderId, reqData)
                        .then (data) ->
                          respondersLeft -= 1
                          if data.handled
                            unless data.status?
                              data.status = '200'
                            res.status(data.status.toString())
                            res.send(data.body)
                          else if respondersLeft is 0
                            next()
                        .catch(next)
              .catch(next)
        .catch (err) ->
          console.error('Unable to start values:', err)
    .catch (err) ->
      console.error('Unable to start session:', err)
