
module.exports = ->
  config =

    cwd: process.cwd()

    basePort: 9000

    numMongo: 1
    mongoBase: 100

    numNginx: 8
    nginxBase: 80

    numGearman: 2
    gearmanBase: 300

    numHttp: 16
    httpBase: 400

    numTestClients: 16

    gearmanServers: []

  devTest = ->
    config.numNginx = 1
    config.numGearman = 1
    config.numHttp = 1
  # devTest()

  config.mongoBase += config.basePort
  config.nginxBase += config.basePort
  config.gearmanBase += config.basePort
  config.httpBase += config.basePort

  config.gearmanServers = (->
    servers = []
    for i in [0..(config.numGearman-1)]
      port = config.gearmanBase + i
      servers.push({host: '127.0.0.1', port})
    servers
  )()

  mowsConfig = {

    mongoUrl: "mongodb://127.0.0.1:#{config.mongoBase}/mongotest"

    # Session timeout in seconds
    timeout: 15 * 60

    # Separate timeout for the first request to
    # prevent session flooding by inoperable
    # clients
    timeoutFirst: 15

    # Key length defines the length of the
    # random part of the key.
    keyLength: 40

    gearmanServers: config.gearmanServers

  }

  {
    config
    mowsConfig
    isRunning: {
      mongod: []
      gearmand: []
      nginx: []
      http: []
      clients: []
    }

    childProcs: {
      mongod: []
      gearmand: []
      nginx: []
      http: []
      clients: []
    }
  }
