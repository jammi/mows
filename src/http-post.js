'use strict';

module.exports = (auth, sync, logger) => {

  const post = function *(next) {

    yield next;

    this.type = 'json';
    this.status = 200;

    const req = this.request;

    const keyIn = req.body.keyIn;
    const valuesIn = req.body.valuesIn;
    const messagesIn = req.body.messagesIn;

    if (messagesIn && messagesIn.length && logger) {
      logger(messagesIn);
    }

    auth(keyIn).then(([key, session]) => {
      if (!key) {
        this.status = 401;
        this.body = [`${session.code}:2:`, {}, [session]];
      }
      else {
        sync(session, valuesIn).then(([values, status]) => {
          this.body = [key, values, [{syncStatus: status}]];
        });
      }
    });
  };

  return {post};

};

