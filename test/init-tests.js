
const _cp = require('child_process');
const exec = _cp.execSync;
const spawn = _cp.spawn;
const fs = require('fs');
const mkdir = fs.mkdirSync;
const exists = fs.existsSync;

// Finds out full path of given executable
const execPath = execName => {
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
  * @arg {String} baseDir - The base directory for storing the data
  *
  * @returns {Object} - Processes by name
  **/
module.exports = (config, isRunning, childProcs, baseDir) => {

  if (!baseDir) {
    baseDir = `${config.cwd}/test-data`;
  }

  // Create directories for test data (pid files, databases, logs and so forth)
  const initDataPaths = rmFirst => {
    if (rmFirst) {
      exec(`rm -rf ${baseDir}`);
    }
    if (!exists(baseDir)) {
      mkdir(baseDir);
    }
    // ['mongodb', 'nginx', 'rabbitmq'].forEach(n => {
    ['nginx'].forEach(n => {
      const serverDir = `${baseDir}/${n}`;
      if (!exists(serverDir)) {
        mkdir(serverDir);
      }
    });
    // for (let num = 0; num < config.mongoCount; num++) {
    //   const mongoDir = `${baseDir}/mongodb/${num}`;
    //   if (!exists(mongoDir)) {
    //     mkdir(mongoDir);
    //   }
    // }
    // for (let num = 0; num < config.rabbitmqCount; num++) {
    //   const rabbitDir = `${baseDir}/rabbitmq/${num}`;
    //   if (!exists(rabbitDir)) {
    //     mkdir(rabbitDir);
    //   }
    //   const logDir = `${rabbitDir}/logs`;
    //   if (!exists(logDir)) {
    //     mkdir(logDir);
    //   }
    // }
  };

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
  const launchProc = (procName, procNum, bin, args, startId, logId, env) => {

    // Handle to the spawned process:
    const proc = env ?
      spawn(bin, args, {env}) :
      spawn(bin, args);

    // Construct logId if it's not given, then apply coloring to it and then normalize the rest to default colors:
    if (!logId) {
      logId = `${procName}-${procNum}`;
    }
    logId = `${term.fgColor}${term.bgColor}${logId}\x1b[0m`;

    // Logging decorator of the process stdout
    proc.stdout.on('data', data => {
      data = data.toString('utf8');
      // console.log(`${term.infoIcon}${logId}: ${data}`);
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
    return;
    const bin = execPath('mongod');
    const args =
      `--master --quiet --port ${config.mongoBase} --noauth --dbpath ${baseDir}/mongodb/0`
      .split(' ');
    const startId = `[initandlisten] waiting for connections on port ${config.mongoBase}`;
    return [launchProc('mongod', 0, bin, args, startId)];
  };

  const launchRabbitMQ = () => {
    return;
    const bin = execPath('rabbitmq-server');
    const startId = ' completed with 10 plugins.';
    const procs = [];
    for (let procNum = 0; procNum < config.rabbitmqCount; procNum++) {
      const logId = `rabbitmq-${procNum}`;
      const basePath = `${baseDir}/rabbitmq`;
      const dbPath = `${basePath}/${procNum}`;
      const pidPath = `${dbPath}/pid`;
      const logPath = `${dbPath}/logs`;
      const env = {
        HOME: basePath,
        RABBITMQ_PID_FILE: pidPath,
        RABBITMQ_MNESIA_BASE: dbPath,
        RABBITMQ_NODENAME: logId,
        RABBITMQ_LOG_BASE: logPath,
        RABBITMQ_NODE_IP_ADDRESS: '127.0.0.1',
        RABBITMQ_NODE_PORT: config.rabbitmqBase + procNum
      };
      const args = []; // ['-detached'];
      procs.push(
        launchProc('rabbitmq', procNum, bin, args, startId, logId, env)
      );
    }
    return procs;
  };

  const launchNginx = () => {
    const proxyTarget = [];
    for (let i = 0; i < config.mowsCount - 1; i++) {
      proxyTarget.push(`          server localhost:${config.mowsBase + i};`);
    }
    const conf = `
      # auto-generated nginx config for mows testing
      worker_processes ${config.nginxCount};
      daemon off;
      events {
        worker_connections ${1024 * config.nginxCount};
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
      pid ${baseDir}/nginx/nginx.pid;
      `.replace(/\n\ \ \ \ \ \ /g, '\n');

    const confPath = `${baseDir}/nginx/nginx.conf`;
    if (!exists(confPath)) {
      fs.writeFileSync(confPath, conf);
    }

    const bin = execPath('nginx');
    const args = `-c ${confPath}`.split(' ');
    return [launchProc('nginx', 0, bin, args)];
  };

  const launchMows = () => {
    const procs = [];
    for (let i = 0; i < config.mowsCount; i++) {
      const host = '127.0.0.1';
      const port = config.mowsBase + i;
      const bin = execPath('node');
      const args = [`${config.cwd}/test/test-http.js`, host, port];
      const logId = `mows${i}`;
      const startId = `Mows server listening on http://${host}:${port}`;
      procs.push(
        launchProc('mows', i, bin, args, startId, logId)
      );
    }
    return procs;
  };

  return {
    initDataPaths, launchMongod, launchRabbitMQ, launchNginx, launchMows
  };
};
