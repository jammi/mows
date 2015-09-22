'use strict'

module.exports = (config, isRunning, childProcs) ->
  {
    execSync: exec
    spawn
  } = require 'child_process'
  fs = require 'fs'

  initTestData = ->
    cwd = config.cwd
    exec("rm -rf #{cwd}/test-data")
    fs.mkdirSync("#{cwd}/test-data")
    fs.mkdirSync("#{cwd}/test-data/#{n}") for n in ['mongodb', 'nginx', 'gearman']
    for num in [1..config.numMongo]
      fs.mkdirSync("#{cwd}/test-data/mongodb/#{num-1}")

  execPath = (execName) -> exec("which #{execName}").toString('utf8').slice(0,-1)

  launchProc = (procName, procNum, bin, args, startId, logId) ->
    proc = spawn(bin, args)
    fgColor = "\x1b[97m" # white
    bgColor = "\x1b[40m" # black
    infoIcon = "\u2139\ufe0f  "
    warnIcon = "\u26a0\ufe0f  "
    logId = "#{procName}-#{procNum}" unless logId?
    logId = "#{fgColor}#{bgColor}#{logId}\x1b[0m"
    proc.stdout.on 'data', (data) ->
      data = data.toString('utf8')
      if isRunning[procName][procNum]
        # console.log("#{infoIcon}#{logId}: #{data}")
      else if data? and ~data.indexOf(startId)
        isRunning[procName][procNum] = true
        console.log "#{infoIcon}#{logId} is running"
    proc.stderr.on 'data', (data) -> console.error("#{logId}: #{data}")
    proc.on 'error', (err) -> console.error("#{warnIcon}#{logId} error: ", err)
    proc.on 'close', (code) -> console.error("#{warnIcon}#{logId} exited with code #{code}")
    childProcs[procName].push(proc)
    if not startId
      setTimeout((->
        isRunning[procName][procNum] = true
        console.log "#{infoIcon}#{logId} is running"
      ), 500)
    proc

  launchMongod = ->
    bin = execPath('mongod')
    args = "--master --quiet --port #{config.mongoBase} --noauth --dbpath #{process.cwd()}/test-data/mongodb/0".split(' ')
    startId = "[initandlisten] waiting for connections on port #{config.mongoBase}"
    launchProc('mongod', 0, bin, args, startId)

  launchGearmand = ->
    bin = execPath('gearmand')
    startId = false
    for procNum in [0..(config.numGearman-1)]
      logId = "gearman-#{procNum}"
      logPath = "#{config.cwd}/test-data/gearman/#{logId}.log"
      args = "-l #{logPath} -t 8 --port #{config.gearmanBase+procNum*10}".split(' ')
      launchProc('gearmand', procNum, bin, args)

  launchNginx = ->
    confMirt = ""
    for i in [0..(config.numHttp-1)]
      confMirt += "        server localhost:#{config.httpBase+i};\n"
    conf = """
    # auto-generated nginx config for http-mongo-gearman testing
      worker_processes #{config.numNginx};
      daemon off;
      events {worker_connections #{1024*config.numNginx};}
      http {
        upstream test {
    #{confMirt}      }

        server {
          listen #{config.nginxBase};
          location / {
            proxy_pass http://test;
          }
        }
      }
      pid #{config.cwd}/nginx.pid;
    """.replace(/\n\ \ /g, "\n")
    confPath = "#{config.cwd}/test-data/nginx/nginx.conf"
    fs.writeFileSync(confPath, conf)
    bin = execPath('nginx')
    args = "-c #{confPath}".split(' ')
    launchProc('nginx', 0, bin, args)

  initTestData()
  launchMongod()
  launchGearmand()
  launchNginx()
