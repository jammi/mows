#!/usr/bin/env node

const conf = require('./config')();
const config = conf.config;
// const mowsConfig = conf.mowsConfig;
const isRunning = conf.isRunning;
const childProcs = conf.childProcs;
const validMatch = new RegExp('^(.*?)-spec\.js$');
const mocha = new (require('mocha'))();
const fs = require('fs');
const path = require('path');
const unitPath = path.join(path.normalize(__dirname), 'spec');

const initTests = require('./init-tests')(
  config, isRunning, childProcs, `${config.cwd}/test-data`
);
initTests.initDataPaths(true);
// initTests.launchMongod();
// initTests.launchRabbitMQ();
initTests.launchNginx();
initTests.launchMows();

// require('./test-http')(config, mowsConfig);

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
    const nginx = childProcs.nginx[0];
    if (!nginx.killed) {
      nginx.kill();
    }
    childProcs.mows.forEach(mows => mows.kill());
    if (fails) {
      throw fails;
      process.exit(1);
    }
    else {
      process.exit(0);
    }
  });
};
const waitStartTime = new Date().getTime() + 3000;
const waitStart = () => {
  if (isRunning.nginx[0] && isRunning.mows.every(n=>n)) {
    runTests();
  }
  else {
    const timedOut = waitStartTime < new Date().getTime();
    if (timedOut) {
      console.error('nginx did not start');
      process.exit(1);
    }
    else {
      setImmediate(waitStart);
    }
  }
};
waitStart();
