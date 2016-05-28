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

module.exports = (config) => {

  const servers = config.gearmanServers;
  const utf8 = 'utf-8';

  const addToWorker = (worker, name, cb) => {
    worker.addFunction(name, job => {
      const payload = JSON.parse(job.payload.toString(utf8), utf8);
      const send = data => {
        job.workComplete(JSON.stringify(data, utf8));
      };
      const progress = data => {
        job.sendWorkData(JSON.stringify(data, utf8));
      };
      cb({job, send, progress}, payload);
    });
    return worker;
  };

  const initWorker = (name, cb) => {
    const worker = new gearmanode.Worker({servers});
    if (name) {
      if (name instanceof Object) {
        const callbacksByName = name;
        for (const _name in callbacksByName) {
          const _cb = callbacksByName[_name];
          addToWorker(worker, _name, _cb);
        }
      }
      else if (cb) {
        addToWorker(worker, name, cb);
      }
    }
    return worker;
  };

  const removeFromWorker = (worker, names) => {
    if (typeof names === 'string') {
      names = [names];
    }
    for (const name of names) {
      worker.removeFunction(name);
    }
    return worker;
  };

  const bindDefaultClientErrors = (job, client, reject) => {

    const progressFn = data => {
      // TODO: This is a dummy function for now
      console.log('got progress data: ', data);
    };

    job.on('workData', data => {
      progressFn(JSON.stringify(data));
    });

    job.on('error', err => {
      console.log('gearman-util error');
      client.close();
      reject(err);
    });

    job.on('warning', err => {
      console.log('gearman-util warning');
      client.close();
      reject(err);
    });

    job.on('failed', err => {
      console.log('gearman-util failed');
      client.close();
      reject(err);
    });

    job.on('exception', err => {
      console.log('gearman-util exception');
      client.close();
      reject(err);
    });

    job.on('timeout', err => {
      console.log('gearman-util timeout');
      client.close();
      reject(err);
    });

  };

  const initClient = (name, data) => {

    return new Promise((resolve, reject) => {
      const client = gearmanode.client({servers: servers});
      const job = client.submitJob(name, JSON.stringify(data, utf8));
      bindDefaultClientErrors(job, client, reject);
      job.on('complete', () => {
        client.close();
        data = job.response.toString(utf8);
        try {
          resolve(JSON.parse(data, utf8));
        }
        catch (e) {
          reject('JSON parse failed for data: ' + data);
        }
      });
    });
  };

  return {
    worker: initWorker,
    client: initClient,
    addToWorker: addToWorker,
    removeFromWorker: removeFromWorker
  };
};
