
const _errors = require('./errors');

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

const sanitizeIn = (dataIn, type, fail) => {
  const valueList = dataIn[type] ? dataIn[type] : [];
  const ids = [];
  if (type === 'del') {
    return valueList.filter(id => {
      if (ids.includes(id)) {
        return fail(type, id)(-19);
      }
      else {
        ids.push(id);
        return true;
      }
    });
  }
  else {
    return valueList.filter(([id]) => {
      if (ids.includes(id)) {
        return fail(type, id)(type === 'new' ? -17 : (type === 'set' ? -18 : -19));
      }
      else {
        ids.push(id);
        return true;
      }
    });
  }
};

module.exports = (sesDb, valDb, Values) => {

  const errLogger = console.error;
  const {errors} = _errors(errLogger);

  const syncIn = (sid, syncArrs) => {
    const values = Values(sid);
    const status = {
      ok: {'new': [], 'set': [], 'del': []},
      fail: {'new': {}, 'set': {}, 'del': {}},
      fails: 0,
    };
    const _fail = (type, id) => {
      return (code, descr) => {
        status.fails += 1;
        if (typeof code === 'number') {
          status.fail[type][id] = errors(code, {id, descr});
        }
        else {
          status.fail[type][id] = code;
        }
        return false;
      };
    };
    const _processNew = (reject) => {
      return Promise.all(sanitizeIn(syncArrs, 'new', _fail)
        .map(([id, data]) => {
          const fail = _fail('new', id);
          const ok = () => {
            status.ok.new.push(id);
          };
          return values
            .exists(id)
            .then(exist => {
              return exist ? -4 : values._clientCreated(id, data);
            }, err => {
              fail(err.code === -41 ? -5 : -6, err);
            })
            .then(code => {
              typeof code === 'number' ? fail(code) : ok();
            }, fail);
        }), reject);
    };
    const _processSet = (reject) => {
      return Promise.all(sanitizeIn(syncArrs, 'set', _fail)
        .map(([id, data]) => {
          const fail = _fail('set', id);
          const ok = () => {
            status.ok.set.push(id);
          };
          return values
            .exists(id)
            .then(exist => {
              return exist ? values._clientSet(id, data) : -13;
            }, err => {
              fail(err.code === -41 ? -14 : -15, err);
            })
            .then(code => {
              typeof code === 'number' ? fail(code) : ok();
            }, fail);
        }), reject);
    };
    const _processDel = (reject) => {
      return Promise.all(sanitizeIn(syncArrs, 'del', _fail)
        .map(id => {
          const fail = _fail('del', id);
          const ok = () => {
            status.ok.del.push(id);
          };
          return values
            .exists(id)
            .then(exist => {
              return exist ? values._clientDel(id) : -20;
            }, err => {
              fail([-41, -42].includes(err.code) ? err : -11, err);
            })
            .then(code => {
              typeof code === 'number' ? fail(code) : ok();
            }, fail);
        }), reject);
    };
    return new Promise((resolve, reject) => {
      _processNew(reject)
        .then(() => {
          return _processSet(reject);
        }, reject)
        .then(() => {
          return _processDel(reject);
        }, reject)
        .then(() => {
          return _minimizedStatus(status);
        }, reject)
        .then(resolve, reject);
    });
  };

  const syncOut = sid => {
    return new Promise((resolve, reject) => {
      const syncData = {'new': [], set: [], del: []};
      sesDb
        .findById(sid)
        .then(({values, valueSync}) => {
          return Promise.all([
            Promise.all(valueSync.new.map(id => {
              const _id = values[id];
              return valDb
                .findById(_id)
                .then(doc => {
                  syncData.new.push([id, doc.data]);
                  return sesDb.updateById(sid, {$pull: {'valueSync.new': id}});
                }, reject)
                .catch(reject);
            })),
            Promise.all(valueSync.set.map(id => {
              if (valueSync.new.includes(id)) {
                return sesDb
                  .updateById(sid, {$pull: {'valueSync.set': id}})
                  .catch(reject);
              }
              else {
                const _id = values[id];
                return valDb
                  .findById(_id)
                  .then(doc => {
                    syncData.set.push([id, doc.data]);
                    return sesDb.updateById(sid, {$pull: {'valueSync.set': id}});
                  }, reject)
                  .catch(reject);
              }
            })),
            Promise.all(valueSync.del.map(id => {
              syncData.del.push(id);
              return sesDb
                .updateById(sid, {$pull: {'valueSync.del': id}})
                .catch(reject);
            }))
          ]);
        }, reject)
        .then(() => {
          if (syncData.new.length === 0) {
            delete syncData.new;
          }
          if (syncData.set.length === 0) {
            delete syncData.set;
          }
          if (syncData.del.length === 0) {
            delete syncData.del;
          }
          return syncData;
        }, reject)
        .then(resolve, reject);
    });
  };

  return (session, valuesIn) => {
    return new Promise((resolve, reject) => {
      let status;
      syncIn(session.id, valuesIn)
        .then(_status => {
          status = _status;
          return syncOut(session.id);
        }, reject)
        .then(syncData => {
          return [syncData, status];
        }, reject)
        .then(resolve, reject);
    });
  };
};
