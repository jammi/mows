'use strict'

module.exports = (auth, sync, reporter) ->

  sessionError = (req, res, error) ->
    res.status(401)
    res.json(["#{error.code}:2:", {}, [error]])

  post: (req, res, next) ->
    [keyIn, valuesIn, messagesIn] = req.body
    if messagesIn? and messagesIn.length and reporter?
      reporter(messagesIn)
    auth(keyIn)
      .then ([key, session]) ->
        if not key
          sessionError(req, res, session)
        else
          sync(session, valuesIn).then ([values, status]) ->
            res.json([key, values, [{syncStatus:status}]])
