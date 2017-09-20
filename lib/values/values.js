
const _errors = require('./errors');

const RabbitMQ = require('../util/rabbitmq');

module.exports = (sesDb, valDb, config, initVars) => {
  const ObjectId = sesDb.ObjectId;
  // setup
  let anyListeners;
  let initValues;

  if (initVars) {
    anyListeners = initVars.anyListeners;
    initValues = initVars.initValues;
  }
  if (anyListeners) {
    if (!anyListeners.new) {
      anyListeners.new = [];
    }
    if (!anyListeners.set) {
      anyListeners.set = [];
    }
    if (!anyListeners.del) {
      anyListeners.del = [];
    }
  }
  else {
    anyListeners = {new: [], set: [], del: []};
  }

  if (!initValues) {
    initValues = [];
  }
  const errLogger = console.error;

  const {errors, catchIdReject} = _errors(errLogger);

  const rabbitMQ = RabbitMQ(config);

  // stateless functions:
  const now = () => {
    return new Date().getTime();
  };

  const _collectArrs = arrs => {
    let out = [];
    arrs.forEach(arr => {
      if (arr instanceof Array) {
        out = out.concat(arr).filter((item, i, self) => {
          return (self.indexOf(item) === i);
        });
      }
    });
    return out;
  };

  return sid => {

    sid = new ObjectId(sid);

    const get = id => {
      return new Promise((resolve, _reject) => {
        const reject = catchIdReject(_reject);
        valDb
          .find({sid, id})
          .then(docs => {
            if (docs.length === 0) {
              reject(-7, id)();
            }
            else if (docs.length === 1) {
              resolve(docs[0].data);
            }
            else {
              reject(-8, id, docs.map(doc => {return doc._id;}))();
            }
          })
          .catch(reject(-12, id));
      });
    };

    const exists = id => {
      return new Promise((resolve, _reject) => {
        const reject = catchIdReject(_reject);
        valDb
          .find({sid, id})
          .then(docs => {
            if (docs.length === 0) {
              resolve(false);
            }
            else if (docs.length === 1) {
              resolve(true);
            }
            else {
              reject(-41, id, docs.length)();
            }
          }, reject(-42, id));
      });
    };

    const _delegate = (id, workerId, event) => {
      console.log('_delegate:', {id, workerId, event});
      // TODO: event is not handled
      return get(id)
        .then(data => {
          const packet = {id: id, sid: sid.toString(), data};
          return rabbitMQ.send(workerId, JSON.stringify(packet));
        })
        .then(data => {
          if (data) {
            throw new Error(errors(-31, {id, data}).message);
          }
        });
    };

    const _delegateAll = (id, event) => {
      return valDb
        .find({sid, id})
        .then(data => {
          data.forEach(_data => {
            _data.workers[event].forEach(workerId => {
              _delegate(id, workerId, event);
            });
          });
        });
    };

    const create = (id, data, listeners) => {
      if (!listeners) {
        listeners = {};
      }
      return new Promise((resolve, _reject) => {
        const reject = catchIdReject(_reject);
        valDb
          .find({id, sid})
          .then(docs => {
            if (docs.length !== 0) {
              reject(-1, id)();
            }
            const dateTime = now(); // epoch, ms
            // The value document insertion
            return valDb.insertOne({
              id, sid, data,
              updated: dateTime,
              created: dateTime,
              workers: {
                set: _collectArrs([anyListeners.set, listeners.set]),
                del: _collectArrs([anyListeners.del, listeners.del]),
              },
            });
          }, reject(0, id))
          .then(docId => {
            // session update:
            const _set = {};
            _set[`values.${id}`] = docId;
            return sesDb.updateById(sid, {$set: _set, $addToSet: {'valueSync.new': id}});
          }, reject(-2, id))
          .then(() => {
            _collectArrs([anyListeners.new, listeners.new])
              .forEach(workerId => {
                _delegate(id, workerId, 'new');
              });
          }, reject(-3, id))
          .then(resolve, reject(-29, id));
      });
    };

    const _clientCreated = (id, data) => {
      return new Promise((resolve, _reject) => {
        const reject = catchIdReject(_reject);
        valDb
          .find({id, sid})
          .then(docs => {
            if (docs.length !== 0) {
              reject(-25, id);
            }
            const dateTime = now(); // epoch, ms
            // The value document insertion:
            return valDb.insertOne({
              id, sid, data,
              updated: dateTime,
              created: dateTime,
              workers: {
                set: anyListeners.set,
                del: anyListeners.del,
              },
            });
          }, reject(0, id))
          .then(docId => {
            const _set = {};
            _set[`values.${id}`] = docId;
            // session update:
            return sesDb.updateById(sid, {$set: _set});
          }, reject(-24, id))
          .then(() => {
            anyListeners.new.forEach(workerId => {
              _delegate(id, workerId, 'new');
            });
          }, reject(-23, id))
          .then(resolve, reject(-30, id));
      });
    };

    const listen = (id, workerId, events) => {
      return new Promise((resolve, _reject) => {
        const reject = catchIdReject(_reject);
        events = (events instanceof Array) ? events : [events];
        const addSet = {};
        events.forEach(event => {
          if (['set', 'del'].includes(event)) {
            addSet[`workers.${event}`] = workerId;
          }
          else {
            reject(-33, id, event)();
          }
        });
        valDb
          .update({id, sid}, {$addToSet: addSet})
          .then(resolve, reject(-34, id));
      });
    };

    const ignore = (id, workerId, events) => {
      return new Promise((resolve, _reject) => {
        const reject = catchIdReject(_reject);
        events = (events instanceof Array) ? events : [events];
        const rmSet = {};
        events.forEach(event => {
          if (['set', 'del'].includes(event)) {
            rmSet[`workers.${event}`] = workerId;
          }
          else {
            reject(-35, id, event)();
          }
        });
        valDb
          .update({id, sid}, {$pull: rmSet})
          .then(resolve, reject(-36, id));
      });
    };

    const set = (id, data) => {
      return new Promise((resolve, _reject) => {
        const reject = catchIdReject(_reject);
        valDb
          .setOne({sid, id}, {data, updated: now()})
          .then(() => {
            return sesDb.updateById(sid, {$addToSet: {'valueSync.set': id}});
          }, reject(-9, id))
          .then(() => {
            _delegateAll(id, 'set');
          }, reject(-10, id))
          .then(resolve, reject(-37, id));
      });
    };

    const _clientSet = (id, data) => {
      return new Promise((resolve, _reject) => {
        const reject = catchIdReject(_reject);
        valDb
          .setOne({sid, id}, {data, updated: now()})
          .then(result => {
            _delegateAll(id, 'set');
            return result;
          }, reject(-26, id))
          .then(resolve, reject(-38, id));
      });
    };

    const del = id => {
      return new Promise((resolve, _reject) => {
        const reject = catchIdReject(_reject);
        const _unset = {};
        _unset[`values.${id}`] = true;
        const _pulls = {
          'valueSync.new': id,
          'valueSync.set': id,
        };
        sesDb
          .updateById(sid, {$unset: _unset, $pull: _pulls, $addToSet: {'valueSync.del': id}})
          .then(() => {
            return valDb.remove({sid, id});
          }, reject(-21, id))
          .then(result => {
            _delegateAll(id, 'del');
            return result;
          }, reject(-22, id))
          .then(resolve, reject(-39, id));
      });
    };

    const _clientDel = id => {
      return new Promise((resolve, _reject) => {
        const reject = catchIdReject(_reject);
        const _unset = {};
        _unset[`values.${id}`] = true;
        const _pull = {
          'valueSync.new': id,
          'valueSync.set': id,
          'valueSync.del': id,
        };
        sesDb
          .updateById(sid, {$unset: _unset, $pull: _pull})
          .then(() => {
            return valDb.remove({sid, id});
          }, reject(-27, id))
          .then(() => {
            _delegateAll(id, 'del');
          }, reject(-28, id))
          .then(resolve, reject(-40, id));
      });
    };

    // Values API:
    return {
      create, _clientCreated,
      del, _clientDel,
      get, exists,
      listen, ignore,
      set, _clientSet,
    };
  };
};
