
const amqp = require('amqplib');

module.exports = config => {
  const servers = config.amqpServers;
  const server = servers[0]; // only one supported at this time
  const timeout = 500; // ms
  const getConnection = () => {
    let closed = false;
    return new Promise((resolve, reject) => {
      amqp.connect(server, (err, conn) => {
        if (err) {
          reject(err);
        }
        else {
          const close = () => {
            if (!closed) {
              closed = true;
              conn.close();
            }
          };
          setTimeout(close, timeout);
          resolve({conn, close});
        }
      });
    });
  };
  const getChannel = queue => {
    return ({conn, close}) => {
      return new Promise((resolve, reject) => {
        conn.createChannel((err, channel) => {
          if (err) {
            reject(err);
          }
          else {
            channel.assertQueue(queue, {durable: false});
            resolve({conn, channel, close});
          }
        });
      });
    };
  };
  const sendMessage = (queue, msg) => {
    return ({conn, channel, close}) => {
      channel.sendToQueue(queue, Buffer.from(msg));
      return {conn, channel, close};
    };
  };
  const send = (queue, msg) => {
    return getConnection()
      .then(getChannel(queue))
      .then(sendMessage(queue, msg))
      .then(({close}) => {
        close();
      });
  };
  const receive = queue => {
    return getConnection()
      .then(getChannel(queue))
      .then(({conn, channel, close}) => {
        channel.consume((q, msg) => {
          resolve(msg);
          close();
        }, {noAck: true});
      });
  };
  return {
    send: (queue, msg) => {
      return amqp
        .connect(server)
        .then(conn => {
          return conn
            .createChannel()
            .then(ch => {
              return Promise.all([
                ch.assertQueue(queue),
                ch.sendMessage(queue, msg)
              ]);
            });
        });
    },
    consume: (queue, responder) => {
      return amqp
        .connect(server)
        .then(conn => {
          return conn
            .createChannel()
            .then(ch => {
              return Promise.all([
                ch.assertQueue(queue),
                ch.consume(queue, responder)
              ]);
            });
        });
    }
  };
};
