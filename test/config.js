
module.exports = () => {

  const config = (basePort => {
    const _conf = {
      basePort: basePort,

      cwd: process.cwd(),

      // mongoCount: 1,
      // mongoBase: basePort + 100,

      nginxCount: 8,
      nginxBase: basePort + 80,

      // rabbitmqCount: 1,
      // rabbitmqBase: basePort + 300,

      amqpServers: ['amqp://127.0.0.1/'],

      mowsCount: 16,
      mowsBase: basePort + 400,

      testClientCount: 16,
    };

    // _conf.amqpServers = (() => {
    //   const servers = [];
    //   for (let i = 0; i < _conf.rabbitmqCount; i++) {
    //     const port = _conf.rabbitmqBase + i;
    //     servers.push(`amqp://127.0.0.1:${port}`);
    //   }
    //   return servers;
    // })();

    return _conf;
  })(9000);

  const mowsConfig = {

    // mongoUrl: `mongodb://127.0.0.1:${config.mongoBase}/mongotest`,
    mongoUrl: 'mongodb://127.0.0.1/mongotest',

    // Session timeout in seconds
    timeout: 15 * 60,

    // Separate timeout for the first request to
    // prevent session flooding by inoperable
    // clients
    timeoutFirst: 15,

    // Key length defines the length of the
    // random part of the key.
    keyLength: 40,

    amqpServers: config.amqpServers,

  };

  return {
    config: config,
    mowsConfig: mowsConfig,
    isRunning: {
      // mongod: [],
      // rabbitmq: [],
      nginx: [],
      mows: [],
      clients: [],
    },

    childProcs: {
      // mongod: [],
      // rabbitmq: [],
      nginx: [],
      mows: [],
      clients: [],
    },
  };
};
