const mongoDB = require();

const defaultSettings = {
  values: {
    /*
    id: {
      restore: false,
      value: 'foo'
    }
    */
  },
  events: [
    /*
    'init_ses',
    'restore_ses',
    'cloned_target',
    'cloned_source',
    'idle',
    'open',
    'close',
    'init_ui',
    'kill_ui',
    'dump_ses',
    'dump_ses_id',
    'load_ses',
    'load_ses_id'
    */
  ]
};

const register = (id, settings) => {
};

module.exports = {
  register
};
