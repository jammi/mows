'use strict';

const _cp = require('child_process');
const exec = _cp.execSync;
const spawn = _cp.spawn;
const fs = require('fs');
const mkdir = fs.mkdirSync;

// Create directories for test data (pid files, databases, logs and so forth)
const initTestData = (config) => {
  exec(`rm -rf ${config.cwd}/test-data`);
  mkdir(`${config.cwd}/test-data`);
  for (let n of ['mongodb', 'nginx', 'gearman']) {
    mkdir(`${config.cwd}/test-data/${n}`);
  }
  for (let num = 0; num < config.numMongo; num++) {
    mkdir(`${config.cwd}/test-data/mongodb/${num}`);
  }
};

// Finds out full path of given executable
const execPath = (execName) => {
  return exec(`which ${execName}`).toString('utf8').slice(0, -1);
};

// Some terminal styling constants
const term = {
  fgColor: '\x1b[97m', // white
  bgColor: '\x1b[40m', // black
  infoIcon: '\uD83D\uDC31  ',
  warnIcon: '\uD83D\uDE3F  ',
};

/**
  * Runs dependencies of the tests
  *
  * @arg {Object} config - Configuration object, see `config.js`
  * @arg {Object} isRunning - Status register of running processes
  * @arg {Object} childProcs - Status register of child processes
  *
  * @returns {Object} - Processes by name
  **/
module.exports = (config, isRunning, childProcs) => {

  /**
    * Spawns a process
    *
    *  @arg {string} procName - The human-readable name of the process
    *  @arg {number} procNum: The index number of the process (to differentiate from several instances)
    *  @arg {string} bin: The full path to the executable of the process
    *  @arg {array} args: A list of arguments of the executable
    *  @arg {string=} startId: The identifier string from the stdout of the process to indentify it started successfully
    *  @arg {string=} logId: Optional prefix in the stdout logs of the process launched
    *
    *  @returns {Object} - A proc reference to the process started
    **/
  const launchProc = (procName, procNum, bin, args, startId, logId) => {

    // Handle to the spawned process:
    const proc = spawn(bin, args);

    // Construct logId if it's not given, then apply coloring to it and then normalize the rest to default colors:
    if (!logId) {
      logId = `${procName}-${procNum}`;
    }
    logId = `${term.fgColor}${term.bgColor}${logId}\x1b[0m`;

    // Logging decorator of the process stdout
    proc.stdout.on('data', data => {
      data = data.toString('utf8');
      if (isRunning[procName][procNum]) {
        console.log(`${term.infoIcon}${logId}: ${data}`);
      }
      else if (data && data.includes(startId)) {
        isRunning[procName][procNum] = true;
        console.log(`${term.infoIcon}${logId} is running`);
      }
    });

    // Logging decorator of the process stderr:
    proc.stderr.on('data', data => {
      console.error(`${logId}: ${data}`);
    });

    // Logging decorator of the process non-zero return codes:
    proc.on('error', err => {
      console.error(`${term.warnIcon}${logId} error: `, err);
    });

    // Logging decorator of the process exit status:
    proc.on('close', code => {
      console.error(`${term.warnIcon}${logId} exited with code ${code}`);
    });

    // Appends the process to the list of child processes:
    childProcs[procName].push(proc);

    // WARN: If no startId is given, assume it's started ok within 500ms
    if (!startId) {
      setTimeout(() => {
        isRunning[procName][procNum] = true;
        console.log(`${term.infoIcon}${logId} is running`);
      }, 500);
    }

    return proc;

  };
  const launchMongod = () => {
    const bin = execPath('mongod');
    const args =
      `--master --quiet --port ${config.mongoBase} --noauth --dbpath ${config.cwd}/test-data/mongodb/0`
      .split(' ');
    const startId = `[initandlisten] waiting for connections on port ${config.mongoBase}`;
    return [launchProc('mongod', 0, bin, args, startId)];
  };

  const launchGearmand = () => {
    const bin = execPath('gearmand');
    const startId = false;
    const procs = [];
    for (let procNum = 0; procNum < config.numGearman; procNum++) {
      const logId = `gearman-${procNum}`;
      const logPath = `${config.cwd}/test-data/gearman/${logId}.log`;
      const args = `-l ${logPath} -t 8 --port ${config.gearmanBase + procNum}`.split(' ');
      procs.push(
        launchProc('gearmand', procNum, bin, args, startId, logId)
      );
    }
    return procs;
  };

  const launchNginx = () => {
    const proxyTarget = [];
    for (let i = 0; i < config.numHttp - 1; i++) {
      proxyTarget.push(`          server localhost:${config.httpBase + i};`);
    }
    const conf = `
      # auto-generated nginx config for http-mongo-gearman testing
      worker_processes ${config.numNginx};
      daemon off;
      events {
        worker_connections ${1024 * config.numNginx};
      }
      http {
        upstream test {
${proxyTarget.join('\n')}
        }

        server {
          listen ${config.nginxBase};
          proxy_read_timeout 10;
          location / {
            proxy_pass http://test;
          }
        }
      }
      pid ${config.cwd}/nginx.pid;
      `.replace(/\n\ \ \ \ \ \ /g, '\n');

    const confPath = `${config.cwd}/test-data/nginx/nginx.conf`;
    fs.writeFileSync(confPath, conf);

    const bin = execPath('nginx');
    const args = `-c ${confPath}`.split(' ');
    return [launchProc('nginx', 0, bin, args)];
  };

  initTestData(config);

  return {
    mongod: launchMongod(),
    gearmand: launchGearmand(),
    nginx: launchNginx(),
  };
};
