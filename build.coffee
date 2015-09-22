#!/usr/bin/env coffee

'use strict'

coffee = require 'coffee-script'
coffeeLint = require 'coffeelint'
fs = require 'fs'
path = require 'path'

printLint = (fileName, lintResults) ->
  for lintLine in lintResults
    console.log("""LINT: #{fileName} #{lintLine.lineNumber}: #{lintResult.message}""")

validMatch = /^.*?\.coffee$/
projPath = path.normalize(__dirname)
srcPath = path.join(projPath, 'src')
destPath = path.join(projPath, 'lib')
unless fs.existsSync(destPath)
  fs.mkdirSync(destPath)
fs.readdirSync('./src').forEach (fileName) ->
  if validMatch.test(fileName)
    srcFile = path.relative(process.cwd(), path.join(srcPath, fileName))
    libFile = path.relative(process.cwd(), path.join(destPath, fileName.split('.')[0]+'.js'))
    console.log("#{srcFile}\n..linting")
    printLint(fileName, coffeeLint.lint(srcFile))
    console.log("..compiling to #{libFile}")
    fileData = fs.readFileSync(srcFile).toString('utf-8')
    {js, v3SourceMap} = coffee.compile(fileData, {
      sourceMap: true
      filename: fileName
      header: false
    })
    fs.writeFileSync(libFile, js)
    fs.writeFileSync(libFile.replace('.js','.map'), v3SourceMap)
