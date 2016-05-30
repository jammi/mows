'use strict';

const Mongo = require('./util/mongodb');
const Sync = require('./values/sync');
const _Values = require('./values/values');

module.exports = (config, initVars) => {

  return Mongo(config.mongoUrl, ['sessions', 'values'])
    .then(([sesDb, valDb]) => {
      const Values = _Values(sesDb, valDb, config, initVars);
      return {
        Values,
        valuesOf: session => {
          return Values(session.id);
        },
        sync: Sync(sesDb, valDb, Values)
      };
    });
};
