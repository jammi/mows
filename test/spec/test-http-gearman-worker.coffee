
{expect} = require 'chai'

{mowsConfig, config} = require('../config')()

http = require 'http'

GearmanUtil = require '../../src/gearman-util'

describe 'HTTP client post session handshake tests', ->

  baseUrl = "http://localhost:9080/"

  {gearmanServers} = config

  gearmanHttpWorkerTest = (
    doneIn
    gmResId
    requestBody
    customRequestOptions
    gmToHandler
    gmResHandler
    httpResHandler
  ) ->

    requestOptions =
      hostname: '127.0.0.1'
      port: 9080
      path: '/'
      method: 'GET'
      headers:
        'Content-Type': 'application/json; charset=utf-8'
        'Content-Length': Buffer.byteLength(requestBody, 'utf8')

    if customRequestOptions?
      for key, value of customRequestOptions
        unless key is 'headers'
          requestOptions[key] = value
      if customRequestOptions.headers?
        for key, value of customRequestOptions.headers
          requestOptions.headers[key] = value

    {initWorker, removeFromWorker} = GearmanUtil({gearmanServers})

    workers =
      'httpRespondTo?': ({send}, payload) ->
        gmToHandler(payload)
        send({responders: [gmResId]})

    workers[gmResId] =
      ({send}, payload) ->
        resp = gmResHandler(payload)
        response = {
          handled: if resp.handled? then resp.handled else true
          status: if resp.status then resp.status else 200
          body: if resp.body then resp.body else ''
        }
        response.headers = {
          'Content-Type': 'text/plain'
          'Content-Length': Buffer.byteLength(response.body, 'utf8')
        }
        if resp.headers?
          for key, value of resp.headers
            response.headers[key] = value
        send(response)


    worker = initWorker(workers)

    done = (err) ->
      worker.close()
      doneIn(err)

    req = http.request requestOptions, (res) ->
      res.setEncoding('utf8')
      res.on 'data', (rawData) ->
        data = JSON.parse(rawData, 'utf8')
        httpResHandler(data)
        removeFromWorker(worker, ['httpRespondTo?', gmResId])
        done()
      res.on 'error', (err) ->
        done(err)
    req.write(requestBody)
    req.end()
    req.on 'error', (err) ->
      done(err)


  it 'Init worker, then make a http call for it', (done) ->

    gearmanHttpWorkerTest(done, 'testResponder', '{"test":123}'

      # http options:
      {
        path: '/test123?foobar=something'
        method: 'POST'
        headers: {
          'Cookie': 'test=foobar'
        }
      }

      # gearman request header test
      (payload) ->
        expect(payload.ip).to.equal('127.0.0.1')
        expect(payload.uri).to.equal('/test123')
        expect(payload.host).to.equal('test')
        expect(payload.query).to.eql({foobar: 'something'})
        expect(payload.https).to.equal(false)
        expect(payload.method).to.equal('POST')
        expect(payload.cookies).to.eql({test: 'foobar'})

      # gearman request body test
      (payload) ->
        expect(payload.body).to.be.an('object')
        expect(payload.body).to.eql({test: 123})
        {
          handled: true
          status: 200
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          }
          body: '{"luke": "I\'m your father!"}'
        }

      # http response test:
      (data) ->
        expect(data).to.eql({luke: "I'm your father!"})
    )


