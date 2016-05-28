'use strict';

/***
  ** Error Format:
  ** -------------
  ** {message: 'descriptionOfErrorDetails', code: negativeNumber}
  **
  **
  ** Error Codes:
  ** ------------
  **
  **  -1: creation error: non-unique id
  **  -2: creation error: generic error
  **  -3: creation error: session update error
  **  -4: syncIn.new requested with pre-existent id
  **  -5: syncIn.new requested with multi-pre-existent ids found
  **  -6: syncIn.new unknown error
  **  -7: get error: not found
  **  -8: get error: multiple existing ids found
  **  -9: set error: session update failed
  ** -10: set error: value update failed
  ** -11: syncIn.del requested with nonexistent id
  ** -12: get error: unknown
  ** -13: syncIn.set requested with nonexistent id
  ** -14: syncIn.set requested with multiple pre-existent ids found
  ** -15: syncIn.set unknown error
  ** -16: syncIn error: unknown stage
  ** -17: syncIn.new: requested with multiple same ids
  ** -18: syncIn.set: requested with multiple same ids
  ** -19: syncIn.del: requested with multiple same ids
  ** -20: syncIn.del: database deletion error
  ** -21: del error: session update error
  ** -22: del error: value deletion error
  **
  **
  ***/

const MongoUtil = require('./util/mongodb');
const GearmanUtil = require('./util/gearman');

module.exports = (config, initVars) => {

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

  const gearman = GearmanUtil(config);

  return MongoUtil(config.mongoUrl, ['sessions', 'values']).then(([sesDb, valDb]) => {

    const ObjectId = sesDb.ObjectId;

    const errLogger = console.error;

    const Values = sid => {

      sid = new ObjectId(sid);

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

      const get = id => {
        return new Promise((resolve, reject) => {
          valDb.find({sid: sid, id: id})
            .then(docs => {
              if (docs.length === 1) {
                resolve(docs[0].data);
              }
              else if (docs.length === 0) {
                reject({
                  message: `MOWS Value#get error: value '${id}' not found`,
                  code: -7,
                });
              }
              else {
                reject({
                  message: `MOWS Value#get error: duplicate docs of id '${id}': ${docs.map(doc => {return doc._id;})}`,
                  code: -8,
                });
              }
            })
            .catch(err => {
              reject({
                message: `MOWS Value#get error; id '${id}': generic error ${err}`,
                code: -12,
              });
            });
        });
      };

      const _delegate = (id, workerId, event) => {
        // TODO: event is not handled
        return get(id).then(data => {
          const packet = {id: id, sid: sid.toString(), data: data};
          gearman.client(workerId, packet)
            .then(respData => {
              if (respData) {
                errLogger('MOWS Value#_delegate warning: Unexpected response data: ', respData);
              }
            })
            .catch(err => {
              errLogger('values error: ', err);
            });
        });
      };

      const _delegateAll = (id, event) => {
        return valDb.find({sid, id})
          .then(data => {
            data[`workers.${event}`].forEach(workerId => {
              _delegate(id, workerId, event);
            });
          });
      };

      const create = (id, data, listeners) => {
        if (!listeners) {
          listeners = {};
        }
        return new Promise((resolve, reject) => {
          valDb.find({id: id, sid: sid})
            .then(docs => {
              if (docs.length === 0) {
                const dateTime = now(); // epoch, ms
                // The value document:
                const doc = {
                  id, sid, data,
                  updated: dateTime,
                  created: dateTime,
                  workers: {
                    set: _collectArrs([anyListeners.set, listeners.set]),
                    del: _collectArrs([anyListeners.del, listeners.del]),
                  },
                };
                // The value document insertion and session update:
                valDb.insertOne(doc)
                  .then(() => {
                    const _set = {};
                    _set[`values.${id}`] = doc._id;
                    sesDb.updateById(sid, {$set: _set, $addToSet: {'valueSync.new': id}})
                      .then(() => {
                        _collectArrs([anyListeners.new, listeners.new])
                          .forEach(workerId => {
                            _delegate(id, workerId, 'new');
                          });
                        resolve();
                      })
                      .catch(err => {
                        reject({
                          message: `MOWS Value#create session update; id '${id}' error: ${err}`,
                          code: -3,
                        });
                      });
                  })
                  .catch(err => {
                    reject({
                      message: `MOWS Value#create insertion; id '${id}' error: ${err}`,
                      code: -2,
                    });
                  });
              }
              else {
                reject({
                  message: `MOWS Value#create error: Non-unique id '${id}' specified`,
                  code: -1,
                });
              }
            })
            .catch(reject);
        });
      };

      const _clientCreated = (id, data) => {
        return new Promise((resolve, reject) => {
          valDb.find({id, sid})
            .then(docs => {
              if (docs.length === 0) {
                const dateTime = now(); // epoch, ms
                // The value document:
                const doc = {
                  id: id,
                  sid: sid,
                  data: data,
                  updated: dateTime,
                  created: dateTime,
                  workers: {
                    set: anyListeners.set,
                    del: anyListeners.del,
                  },
                };
                // The value document insertion and session update:
                valDb.insertOne(doc)
                  .then(() => {
                    const _set = {};
                    _set[`values.${id}`] = doc._id;
                    sesDb.updateById(sid, {$set: _set})
                      .then(() => {
                        anyListeners.new.forEach(workerId => {
                          _delegate(id, workerId, 'new');
                        });
                        resolve();
                      })
                      .catch(err => {
                        reject({
                          message: `MOWS Value#_clientCreated session update; id '${id}' error: ${err}`,
                          code: -3,
                        });
                      });
                  })
                  .catch(err => {
                    reject({
                      message: `MOWS Value#_clientCreated insertion; id '${id}' error: ${err}`,
                      code: -2,
                    });
                  });
              }
              else {
                reject({
                  message: `MOWS Value#_clientCreated error: Non-unique id '${id}' specified`,
                  code: -1,
                });
              }
            });
        });
      };

      const listen = (id, workerId, events) => {
        events = (events instanceof Array) ? events : [events];
        const addSet = {};
        events.forEach(event => {
          if (['set', 'del'].includes(event)) {
            addSet[`workers.${event}`] = workerId;
          }
          else {
            errLogger(`MOWS Value#listen error: invalid event ('${event}')`);
          }
        });
        valDb.update({id: id, sid: sid}, {$addToSet: addSet});
      };

      const ignore = (id, workerId, events) => {
        events = (events instanceof Array) ? events : [events];
        const rmSet = {};
        events.forEach(event => {
          if (['set', 'del'].includes(event)) {
            rmSet[`workers.${event}`] = workerId;
          }
          else {
            errLogger(`MOWS Value#ignore error: invalid event ('${event}')`);
          }
        });
        valDb.update({id: id, sid: sid}, {$pull: rmSet});
      };

      const set = (id, data) => {
        return new Promise((resolve, reject) => {
          valDb.setOne({sid: sid, id: id}, {data: data, updated: now()})
            .then(() => {
              sesDb.updateById(sid, {$addToSet: {'valueSync.set': id}})
                .then(() => {
                  _delegateAll(id, 'set');
                  resolve();
                })
                .catch(err => {
                  reject({
                    message: `MOWS Value#set error: value '${id}' encountered session update error: ${err}`,
                    code: -9,
                  });
                });
            })
            .catch(err => {
              reject({
                message: `MOWS Value#set error: value '${id}' encountered value update error: ${err}`,
                code: -10,
              });
            });
        });
      };

      const _clientSet = (id, data) => {
        return new Promise((resolve, reject) => {
          valDb.setOne({sid: sid, id: id}, {data: data, updated: now()})
            .then(result => {
              _delegateAll(id, 'set');
              resolve(result);
            })
            .catch(err => {
              reject({
                message: `MOWS Value#_clientSet error: value '${id}' encountered value update error: ${err}`,
                code: -10,
              });
            });
        });
      };

      const del = id => {
        return new Promise((resolve, reject) => {
          const _unset = {};
          _unset[`values.${id}`] = true;
          const _pulls = {
            'valueSync.new': id,
            'valueSync.set': id,
          };
          sesDb.updateById(sid, {$unset: _unset, $pull: _pulls, $addToSet: {'valueSync.del': id}})
            .then(() => {
              valDb.remove({sid: sid, id: id})
                .then(result => {
                  _delegateAll(id, 'del');
                  resolve(result);
                })
                .catch(err => {
                  reject({
                    message: `MOWS Value#del error: value '${id}' encountered value deletion error: ${err}`,
                    code: -22,
                  });
                });
            })
            .catch(err => {
              reject({
                message: `MOWS Value#del error: value '${id}' encountered session update error: ${err}`,
                code: -21,
              });
            });
        });
      };

      const _clientDel = id => {
        return new Promise((resolve, reject) => {
          const _unset = {};
          _unset[`values.${id}`] = true;
          const _pull = {
            'valueSync.new': id,
            'valueSync.set': id,
            'valueSync.del': id,
          };
          sesDb.updateById(sid, {$unset: _unset, $pull: _pull})
            .then(() => {
              valDb.remove({sid: sid, id: id})
                .then(() => {
                  _delegateAll(id, 'del');
                  resolve();
                })
                .catch(err => {
                  reject({
                    message: `MOWS Value#del error: value '${id}' encountered value deletion error: ${err}`,
                    code: -22,
                  });
                });
            })
            .catch(err => {
              reject({
                message: `MOWS Value#del error: value '${id}' encountered session update error: ${err}`,
                code: -21,
              });
            });
        });
      };

      // API:
      return {
        create: create,
        _clientCreated: _clientCreated,
        get: get,
        set: set,
        _clientSet: _clientSet,
        del: del,
        _clientDel: _clientDel,
        listen: listen,
        ignore: ignore,
      };
    };

    const _minimizedStatus = status => {
      if (status.fails === 0) {
        delete status.fail;
      }
      else {
        if (Object.keys(status.fail.new).length === 0) {
          delete status.fail.new;
        }
        if (Object.keys(status.fail.set).length === 0) {
          delete status.fail.set;
        }
        if (Object.keys(status.fail.del).length === 0) {
          delete status.fail.del;
        }
      }
      if (status.ok.new.length === 0) {
        delete status.ok.new;
      }
      if (status.ok.set.length === 0) {
        delete status.ok.set;
      }
      if (status.ok.del.length === 0) {
        delete status.ok.del;
      }
      if (Object.keys(status.ok).length === 0) {
        delete status.ok;
      }
      return status;
    };

    const syncIn = (sid, syncArrs) => {
      return new Promise((resolve, reject) => {

        const values = Values(sid);

        const status = {
          ok: {'new': [], 'set': [], 'del': []},
          fail: {'new': {}, 'set': {}, 'del': {}},
          fails: 0,
        };

        let cbs = 0;

        const cbPlus = () => {
          cbs += 1;
        };

        const checkEndOfStage = stage => {
          if (cbs === 0) {
            if (stage === 'new') {
              syncStage('set');
            }
            else if (stage === 'set') {
              syncStage('del');
            }
            else if (stage === 'del') {
              resolve(_minimizedStatus(status));
            }
            else {
              reject({
                message: `MOWS syncIn error: unknown stage '${stage}'`,
                code: -16,
              });
            }
          }
        };

        const cbMinus = stage => {
          cbs -= 1;
          checkEndOfStage(stage);
        };

        const sanitizeIn = (dataIn, type) => {
          const valueList = dataIn[type];
          const ids = [];
          if (type === 'del') {
            return valueList.filter(id => {
              if (ids.includes(id)) {
                status.fails += 1;
                status.fail[type][id] = {
                  message: 'MOWS syncIn error: duplicate id for the same ' +
                           `'del' sync operation: '${id}', omitting last occurrence`,
                  code: -19,
                };
                return false;
              }
              else {
                ids.push(id);
                return true;
              }
            });
          }
          else {
            return valueList.filter(([id, data]) => {
              if (ids.includes(id)) {
                status.fails += 1;
                status.fail[type][id] = {
                  message: 'MOWS syncIn error: duplicate id for the same ' +
                           `'${type}' sync operation: '${id}', omitting last occurrence`,
                  code: (type === 'new') ? -17 : ((type === 'set') ? -18 : -19),
                };
                return false;
              }
              else {
                ids.push(id);
                return true;
              }
            });
          }
        };

        const syncStage = stage => {
          if (stage === 'new') {
            if (syncArrs.new) {
              sanitizeIn(syncArrs, 'new').forEach(([id, data]) => {
                cbPlus();
                values.get(id)
                  .then(() => {
                    status.fail.new[id] = {
                      message: `MOWS syncIn error: value of id '${id}' already exists!`,
                      code: -4,
                    };
                    status.fails += 1;
                    cbMinus('new');
                  })
                  .catch(err => {
                    const code = err.code;
                    // const message = err.message;

                    // No document found; ok
                    if (code === -7) {
                      values._clientCreated(id, data)
                        .then(() => {
                          status.ok.new.push(id);
                          cbMinus('new');
                        })
                        .catch(e => {
                          status.fail.new[id] = e;
                          status.fails += 1;
                          cbMinus('new');
                        });
                    }
                    else if (code === -8) {
                      status.fail.new[id] = {
                        message: `MOWS syncIn error: many values of id '${id}' already exists!`,
                        code: -5,
                      };
                      status.fails += 1;
                      cbMinus('new');
                    }
                    else {
                      status.fail.new[id] = {
                        message: `MOWS syncIn error: unknown error when creating id '${id}'`,
                        code: -6,
                      };
                      status.fails += 1;
                      cbMinus('new');
                    }
                  });
              });
            }
            checkEndOfStage('new');
          }
          if (stage === 'set') {
            if (syncArrs.set) {
              sanitizeIn(syncArrs, 'set').forEach(([id, data]) => {
                cbPlus();
                values.get(id)
                  .then(() => {
                    values._clientSet(id, data)
                      .then(() => {
                        status.ok.set.push(id);
                        cbMinus('set');
                      })
                      .catch(err => {
                        const code = err[0];
                        const message = err[1];
                        status.fail.set[id] = {code: code, message: message};
                        status.fails += 1;
                        cbMinus('set');
                      });
                  })
                  .catch(err => {
                    const code = err[0];
                    // const message = err[1];
                    if (code === -7) {
                      status.fail.set[id] = {
                        message: `MOWS syncIn error: no value of id '${id}' found!`,
                        code: -13,
                      };
                    }
                    else if (code === -8) {
                      status.fail.set[id] = {
                        message: `MOWS syncIn error: many values of id '${id}' found!`,
                        code: -14,
                      };
                    }
                    else {
                      status.fail.set[id] = {
                        message: `MOWS syncIn error: unknown error when setting id '${id}'`,
                        code: -15,
                      };
                    }
                    status.fails += 1;
                    cbMinus('set');
                  });
              });
            }
            checkEndOfStage('set');
          }
          if (stage === 'del') {
            if (syncArrs.del) {
              sanitizeIn(syncArrs, 'del').forEach(id => {
                cbPlus();
                values.get(id)
                  .then(() => {
                    values._clientDel(id)
                      .then(() => {
                        status.ok.del.push(id);
                        cbMinus('del');
                      })
                      .catch(err => {
                        status.fail.del[id] = {
                          message: err,
                          code: -20,
                        };
                        status.fails += 1;
                        cbMinus('del');
                      });
                  })
                  .catch(err => {
                    status.fail.del[id] = {
                      message: err,
                      code: -11,
                    };
                    status.fails += 1;
                    cbMinus('del');
                  });
              });
            }
            checkEndOfStage('del');
          }
        };

        syncStage('new');

      });
    };

    const syncOut = sid => {
      return new Promise((resolve, reject) => {
        const syncData = {'new': [], set: [], del: []};
        sesDb.findById(sid)
          .then(({values, valueSync}) => {
            let cbs =
              valueSync.new.length +
              valueSync.set.length +
              valueSync.del.length;

            if (cbs === 0) {
              resolve({});
            }
            else {
              const cbMinus = () => {
                cbs -= 1;
                if (cbs === 0) {
                  if (syncData.new.length === 0) {
                    delete syncData.new;
                  }
                  if (syncData.set.length === 0) {
                    delete syncData.set;
                  }
                  if (syncData.del.length === 0) {
                    delete syncData.del;
                  }
                  resolve(syncData);
                }
              };
              valueSync.new.forEach(id => {
                const _id = values[id];
                valDb.findById(_id)
                  .then(doc => {
                    syncData.new.push([id, doc.data]);
                    sesDb.updateById(sid, {$pull: {'valueSync.new': id}})
                      .then(() => {
                        cbMinus();
                      })
                      .catch(reject);
                  })
                  .catch(reject);
              });
              valueSync.set.forEach(id => {
                if (valueSync.new.includes(id)) {
                  sesDb.updateById(sid, {$pull: {'valueSync.set': id}})
                    .then(() => {
                      cbMinus();
                    })
                    .catch(reject);
                }
                else {
                  const _id = values[id];
                  valDb.findById(_id)
                    .then(doc => {
                      syncData.set.push([id, doc.data]);
                      sesDb.updateById(sid, {$pull: {'valueSync.set': id}})
                        .then(() => {
                          cbMinus();
                        })
                        .catch(reject);
                    })
                    .catch(reject);
                }
              });
              valueSync.del.forEach(id => {
                // const _id = values[id];
                syncData.del.push(id);
                sesDb.updateById(sid, {$pull: {'valueSync.set': id}})
                  .then(() => {
                    cbMinus();
                  })
                  .catch(reject);
              });
            }
          });
      });
    };

    return {
      Values,

      valuesOf: session => {
        return Values(session.id);
      },

      sync: (session, valuesIn) => {
        return new Promise((resolve, reject) => {
          syncIn(session.id, valuesIn)
            .then(status => {
              syncOut(session.id)
                .then(syncData => {
                  resolve([syncData, status]);
                })
                .catch(reject);
            })
            .catch(reject);
        });
      },

    };
  });
};
