#!/usr/bin/env node --harmony

const conf = require('./config')();
const config = conf.config;
const mowsConfig = conf.mowsConfig;
const isRunning = conf.isRunning;
const childProcs = conf.childProcs;
const validMatch = new RegExp('^(.*?)-spec\.js$');
const mocha = new (require('mocha'));
const fs = require('fs');
const path = require('path');
const unitPath = path.join(path.normalize(__dirname), 'spec');

require('./init-tests')(config, isRunning, childProcs);
require('./test-http')(config, mowsConfig);

const runTests = () => {
  console.log('Starting test runner..');
  fs.readdirSync(unitPath)
    .forEach(fileName => {
      const isTestFile = validMatch.test(fileName);
      if (isTestFile) {
        const filePath = path.relative(config.cwd, path.join(unitPath, fileName));
        console.log('Adding test:', filePath);
        mocha.addFile(filePath);
      }
    });

  mocha.run(fails => {
    process.on('exit', () => {
      process.exit(fails);
    });
  });
};

setTimeout(runTests, 3000);
