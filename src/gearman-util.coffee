'use strict'

gearmanode = require 'gearmanode'

# Gearmanode defaults to some super-verbose
# debug logging level, this reduces the
# amount of its garbage
gearmaDebug = true
unless gearmaDebug
  gearmanode
    .Client
    .logger
    .transports
    .console
    .level = 'none'

module.exports = (config) ->

  servers = config.gearmanServers
  utf8 = 'utf-8'

  initWorker = (name, cb) ->
    worker = new gearmanode.Worker({servers})
    if name?
      if name instanceof Object
        names = name
        for name, cb of names
          addToWorker(worker, name, cb)
      else if cb?
        addToWorker(worker, name, cb)
    worker


  addToWorker = (worker, name, cb) ->
    worker.addFunction name, (job) ->
      payload = JSON.parse(job.payload.toString(utf8), utf8)
      send = (data) ->
        job.workComplete(JSON.stringify(data, utf8))
      progress = (data) ->
        job.sendWorkData(JSON.stringify(data, utf8))
      cb({job, send, progress}, payload)
    worker


  removeFromWorker = (worker, name) ->
    if typeof name is 'array'
      names = name
      for name in names
        worker.removeFunction(name)
    else
      worker.removeFunction(name)
    worker


  bindDefaultClientErrors = (job, client, reject) ->

    progressFn = (data) ->
      # TODO: This is a dummy function for now
      console.log('got progress data: ', data)

    job.on 'workData', (data) ->
      progressFn JSON.stringify(data)

    job.on 'error', (err) ->
      console.log 'gearman-util error'
      client.close()
      reject(err)

    job.on 'warning', (err) ->
      console.log 'gearman-util warning'
      client.close()
      reject(err)

    job.on 'failed', (err) ->
      console.log 'gearman-util failed'
      client.close()
      reject(err)

    job.on 'exception', (err) ->
      console.log 'gearman-util exception'
      client.close()
      reject(err)

    job.on 'timeout', (err) ->
      console.log 'gearman-util timeout'
      client.close()
      reject(err)


  initClient = (name, data, options) ->

    new Promise (resolve, reject) ->
      client = new gearmanode.Client({servers})
      job = client.submitJob(name, JSON.stringify(data, utf8))
      bindDefaultClientErrors(job, client, reject)
      job.on 'complete', ->
        client.close()
        data = job.response.toString(utf8)
        try
          resolve(JSON.parse(data, utf8))
        catch e
          reject('JSON parse failed for data: ' + data)

  {
    worker: initWorker
    client: initClient
    initWorker
    initClient
    addToWorker
    removeFromWorker
  }


###
# some gearman reference stuff

# client reference
client = gearmanode.client({servers})

job = client.submitJob('reverse', 'hello world!', {
  background: false, toStringEncoding: 'utf-8', priority: 'LOW'})
job.on 'workData', (data) ->
  console.log 'WORK_DATA >>> ' + data
job.on 'complete', -> console.log 'RESULT >>> ' + job.response
client.close()

# worker reference:
worker = gearmanode.worker({servers})
worker.addFunction 'reverse', (job) ->
  job.sendWorkData('workload: '+job.payload)
  job.workComplete('not reverse')

test1 = gearman.worker 'test1', ({send}, data) ->
  console.log('test1 progress for '+data)
  setTimeout(send('test1 result'), 1000)

test2 = gearman.worker 'test2', ({send}, data) ->
  console.log({input: data})
  send({test: 123, foo: 'bar', input: data})

gearman.client('test1', 'testing123').then(
  (data) -> console.log('result1: ', data)
  (err) -> console.log('error1: ', err)
)

gearman.client('test2', {foo: 'testing123'}).then(
  (data) -> console.log('result1: ', data)
  (err) -> console.log('error1: ', err)
)
###

