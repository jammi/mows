'use strict';

// Simple RAM-based value manager
module.exports = ({anyListeners, initValues}) => {

  const InitListeners = (listeners) => {
    if (!listeners) {
      listeners = {};
    }
    ['new', 'set', 'del'].forEach((verb) => {
      if (!listeners[verb]) {
        listeners[verb] = [];
      }
    });
    return listeners;
  };

  anyListeners = InitListeners(anyListeners);

  const Value = function(_id, _data, _session, listeners, _byServer) {
    this.id = _id;
    this.data = _data;
    this.session = _session;
    this.session.values[this.id] = this;
    this.valueSync = this.session.valueSync;
    if (!_byServer) {
      this.valueSync.new.push(this);
    }
    this.listeners = InitListeners(listeners);
    anyListeners.new.forEach((cb1) => {
      cb1(this);
    });
    this.listeners.new.forEach((cb2) => {
      cb2(this);
    });

    this.listen = (cb, listenTypes) => {
      if (!listenTypes) {
        listenTypes = ['set'];
      }
      listenTypes.forEach((listenType) => {
        if (!this.listeners[listenType].includes(cb)) {
          this.listeners[listenType].push(cb);
        }
      });
    };

    this.ignore = (cb, listenTypes) => {
      if (!listenTypes) {
        listenTypes = ['new', 'set', 'del'];
      }
      listenTypes.forEach((listenType) => {
        const index = this.listeners[listenType].indexOf(cb);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      });
    };

    this.set = (data, byServer) => {
      if (data !== this.data && byServer) {
        this.data = data;
      }
      else if (data !== this.data) {
        this.data = data;
        if (!this.valueSync.set.includes(this)) {
          this.valueSync.set.push(this);
        }
      }
      anyListeners.set.forEach((cb) => {
        cb(this);
      });
      this.listeners.set.forEach((cb) => {
        cb(this);
      });
    };

    this.del = (byServer) => {
      if (!byServer) {
        if (!this.valueSync.del.includes(this)) {
          this.valueSync.del.push(this);
        }
      }
      anyListeners.del.forEach((cb) => {
        cb(this);
      });
      this.listeners.del.forEach((cb) => {
        cb(this);
      });
      delete this.session.values[_id];
    };

    return this;
  };

  const initDefaults = (session) => {
    if (initValues) {
      initValues.forEach(([id, data, listeners]) => {
        new Value(id, data, session, listeners);
      });
    }
  };

  const createValues = (session, valuesIn, byServer) => {
    valuesIn.forEach(([valueId, valueData]) => {
      if (session.values[valueId]) {
        throw new Error(`Duplicate value id: ${valueId}`);
      }
      else {
        new Value(valueId, valueData, session, null, byServer);
      }
    });
  };

  const setValues = (session, valuesIn, byServer) => {
    valuesIn.forEach(([valueId, valueData]) => {
      session.values[valueId].set(valueData, byServer);
    });
  };

  const delValues = (session, keysIn, byServer) => {
    keysIn.forEach((valueId) => {
      session.values[valueId].del(byServer);
    });
  };

  const syncIn = (session, values) => {
    if (values.new) {
      createValues(session, values.new, true);
    }
    if (values.set) {
      setValues(session, values.set, true);
    }
    if (values.del) {
      delValues(session, values.del, true);
    }
  };

  const valuesById = (valuesIn) => {
    const valuesObjIn = {'new': {}, 'set': {}, 'del': {}};
    if (valuesIn) {
      ['new', 'set', 'del'].forEach((verb) => {
        if (valuesIn[verb]) {
          valuesIn[verb].forEach(([id, data]) => {
            valuesObjIn[verb][id] = data;
          });
        }
      });
    }
    return valuesObjIn;
  };

  const syncOut = (session, valuesIn) => {
    const valueSync = session.valueSync;
    const valuesInSync = valuesById(valuesIn);
    const values = {};
    ['new', 'set', 'del'].forEach((verb) => {
      const syncLen = valueSync[verb].length;
      if (syncLen) {
        values[verb] = [];
        for (let i = 0; i < syncLen; i++) {
          const value = session.valueSync[verb].shift();
          if (verb === 'new' || verb === 'set') {
            const valueInSync = valuesInSync[verb][value.id];
            if (!valueInSync || valueInSync !== value.data) {
              if (verb === 'new') {
                values.new.push([value.id, value.data]);
              }
              else if (verb === 'set') {
                values.set.push([value.id, value.data]);
              }
            }
          }
          else if (verb === 'del') {
            if (!valuesInSync.del[value.id]) {
              values.del.push(value.id);
            }
          }
        }
        if (!values[verb].length) {
          delete values[verb];
        }
      }
    });
    return values;
  };

  const syncServer = (session, values) => {
    if (session.seq === 0) {
      initDefaults(session);
    }
    syncIn(session, values);
    syncOut(session, values);
  };

  return {syncServer, syncIn, syncOut, Value, initDefaults};
};

