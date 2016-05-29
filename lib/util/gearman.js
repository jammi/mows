'use strict';

const gearmanode = require('gearmanode');

// Gearmanode defaults to some super-verbose
// console debug logging level, this reduces the
// amount of its garbage
const gearmaDebug = false;

if (!gearmaDebug) {
  ['Worker', 'Client', 'Job'].forEach(gearmaMod => {
    gearmanode[gearmaMod]
      .logger
      .transports
      .console
      .level = 'warn';
  });
}

module.exports = (servers) => {

  const utf8 = 'utf-8';

  const clientConf = {
    servers,
    loadBalancing: 'RoundRobin', // alternatively 'Sequence'
    recoverTime: 10 // ms between retries
  };
  const workerConf = {servers};
  const jobConf = {
    toStringEncoding: utf8,
    priority: 'HIGH',
    // background: true
  };

  const _parserFromName = (name) => {
    // no parser by default
    let parser = data => {
      return data;
    };
    if (name.includes(':')) {
      const dataType = name.split(':')[1];
      if (dataType === 'json') {
        parser = data => {
          return JSON.parse(data.toString(utf8));
        };
      }
      else if (dataType === 'string' || dataType === 'str') {
        parser = data => {
          return data.toString(utf8);
        };
      }
      else if (dataType === 'int') {
        parser = data => {
          return parseInt(data.toString(utf8), 10);
        };
      }
      else if (dataType === 'float' || dataType === 'num') {
        parser = data => {
          return parseFloat(data.toString(utf8));
        };
      }
      else if (dataType === 'binary' || dataType === 'bin') {
        // binary is default as-is
      }
      else if (dataType === 'http') {
        throw new Error('TypeError: "http" isn\'t a dataType specified yet!');
      }
      else {
        console.warn(`dataType "${dataType}" of "${name}" is unknown; not parsed`);
      }
    }
    else {
      console.warn(`no dataType for "${name}" defined; not parsed`);
    }
    return parser;
  };

  const _normalizerFromName = (name) => {
    let normalizer = data => {
      return data.toString(utf8);
    };
    if (name.includes(':')) {
      const dataType = name.split(':')[1];
      if (dataType === 'json') {
        normalizer = data => {
          return JSON.stringify(data);
        };
      }
      else if (dataType === 'string' || dataType === 'str') {
        // toString is fine
      }
      else if (dataType === 'int') {
        normalizer = data => {
          return data.toString(10);
        };
      }
      else if (dataType === 'float' || dataType === 'num') {
        normalizer = data => {
          return data.toString(10);
        };
      }
      else if (dataType === 'binary' || dataType === 'bin') {
        normalizer = data => {
          return Buffer.from(data);
        };
      }
      else if (dataType === 'http') {
        throw new Error('TypeError: "http" isn\'t a dataType specified yet!');
      }
      else {
        console.warn(`dataType "${dataType}" of "${name}" is unknown; not normalized`);
      }
    }
    else {
      console.warn(`no dataType for "${name}" defined; not normalized`);
      normalizer = data => {
        return data;
      };
    }
    return normalizer;
  };

  const worker = (name, workFn) => {
    return new Promise((resolve, reject) => {
      try {
        const _parser = _parserFromName(name);
        const _normalizer = _normalizerFromName(name);
        const _worker = gearmanode.worker(workerConf);
        _worker.addFunction(name, function(job) {
          this.job = job;
          this.name = name;
          this.normalizer = _normalizer;
          this.parser = _parser;
          this.worker = _worker;
          this.remove = () => {
            _worker.removeFunction(name);
          };
          this.progress = status => {
            job.sendWorkData(_normalizer(status));
          };
          this.send = data => {
            job.workComplete(_normalizer(data));
          };
          const data = _parser(job.payload);
          const returns = workFn.call(this, data, this.status, this.send);
          if (returns) {
            this.send(returns);
          }
        });
        resolve(_worker);
      }
      catch (err) {
        reject(err);
      }
    });
  };

  const client = (name, data, options) => {
    return new Promise((resolve, reject) => {
      try {
        options = options ? options : {};
        let completed = false;
        const _parser = _parserFromName(name);
        const _client = gearmanode.client(clientConf);
        const _normalizer = _normalizerFromName(name);
        const _job = _client.submitJob(name, _normalizer(data), jobConf);
        const _timeout = options.timeout ? options.timeout : 1000;
        const jobFail = () => {
          if (!completed) {
            completed = true;
            reject(new Error(`Job "${name}" Failed: ${_job.handle}`));
            _job.close();
            _client.close();
          }
        };
        const jobTimeout = () => {
          if (!completed) {
            reject(new Error(`Job "${name}" Timeout: not completed in ${_timeout}ms`));
            _job.close();
            _client.close();
          }
        };
        const jobProgress = (_data) => {
          if (options.progress) {
            options.progress(_parser(_data));
          }
        };
        const jobComplete = () => {
          if (!completed) {
            completed = true;
            resolve(_parser(_job.response));
            _client.close();
          }
        };
        _job.on('created', () => {
          setTimeout(jobTimeout, _timeout);
        });
        _job.on('timeout', jobTimeout);
        _job.on('complete', jobComplete);
        _job.on('workData', jobProgress);
        // Maybe one of these errors should be enough?
        _job.on('failed', jobFail);
        _job.on('error', jobFail);
        _job.on('exception', jobFail);
        _job.on('warning', console.warn);
      }
      catch (err) {
        reject(err);
      }
    });
  };

  return {worker, client};
};
