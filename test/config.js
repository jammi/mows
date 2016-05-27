'use strict';

module.exports = function exports() {

  const config = (function config(basePort) {
    const _conf = {
      basePort: basePort,

      cwd: process.cwd(),

      numMongo: 1,
      mongoBase: basePort + 100,

      numNginx: 8,
      nginxBase: basePort + 80,

      numGearman: 2,
      gearmanBase: basePort + 300,

      numHttp: 16,
      httpBase: basePort + 400,

      numTestClients: 16,
    };

    _conf.gearmanServers = (() => {
      const servers = [];
      for (let i = 0; i < _conf.numGearman; i++) {
        const port = _conf.gearmanBase + i;
        servers.push({host: '127.0.0.1', port});
      }
      return servers;
    })();

    return _conf;
  })(9000);

  const mowsConfig = {

    mongoUrl: `mongodb://127.0.0.1:${config.mongoBase}/mongotest`,

    // Session timeout in seconds
    timeout: 15 * 60,

    // Separate timeout for the first request to
    // prevent session flooding by inoperable
    // clients
    timeoutFirst: 15,

    // Key length defines the length of the
    // random part of the key.
    keyLength: 40,

    gearmanServers: config.gearmanServers,

  };

  return {
    config: config,
    mowsConfig: mowsConfig,
    isRunning: {
      mongod: [],
      gearmand: [],
      nginx: [],
      http: [],
      clients: [],
    },

    childProcs: {
      mongod: [],
      gearmand: [],
      nginx: [],
      http: [],
      clients: [],
    },
  };
};
