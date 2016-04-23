#!/usr/bin/env coffee
'use strict'

{config, mowsConfig, isRunning, childProcs} = require('./config')()

startDeps = ->
  initTests = require './init-tests'
  {
    launchMongod,
    launchGearmand,
    launchNginx
  } = initTests(config, isRunning, childProcs)

  testHttp = require './test-http'
  httpApps = testHttp(config, mowsConfig)

startDeps()

require 'coffee-script/register'
runTests = ->
  console.log 'Starting test runner..'
  try
    validMatch = new RegExp('^test\-(.*?)\\.(coffee|js)$')
    Mocha = require('mocha')
    mocha = new Mocha()
    fs = require 'fs'
    path = require 'path'
    unitPath = path.join(path.normalize(__dirname), 'spec')
    fs.readdirSync(unitPath)
      .forEach (fileName) ->
        isTestFile = validMatch.test(fileName)
        if isTestFile
          filePath = path.relative(config.cwd, path.join(unitPath, fileName))
          console.log 'Adding test:', filePath
          mocha.addFile(filePath)
    mocha.run (fails) ->
      process.on 'exit', ->
        process.exit fails

  catch e
    console.log 'Test runner error:', e

# runTests()
setTimeout(runTests, 1500)
