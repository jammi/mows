
const mongodb = require('mongodb');

const createAPI = (db, collName) => {

  const coll = db.collection(collName);

  const idQ = id => {
    return {_id: new mongodb.ObjectId(id)};
  };

  const insert = (data, opts) => {
    return new Promise((resolve, reject) => {
      coll.insert(data, opts, (err, result) => {
        if (err) {
          reject({message: 'Mongo#insert error', err});
        }
        else {
          const insertedIds = result.insertedIds;
          if (insertedIds && typeof insertedIds[0] === 'undefined') {
            insertedIds.shift();
          }
          resolve(insertedIds);
        }
      });
    });
  };

  const insertOne = (data, opts) => {
    return new Promise((resolve, reject) => {
      coll.insertOne(data, opts, (err, result) => {
        if (err) {
          reject({message: 'Mongo#insert error', err});
        }
        else {
          resolve(result.insertedId);
        }
      });
    });
  };

  const update = (query, data, opts) => {
    return new Promise((resolve, reject) => {
      coll.update(query, data, opts, (err, result) => {
        if (err) {
          reject({message: 'Mongo#update error', err});
        }
        else {
          resolve(result);
        }
      });
    });
  };

  const set = (query, data) => {
    return update(query, {$set: data}, {multi: true});
  };

  const setOne = (query, data) => {
    return update(query, {$set: data}, {multi: false});
  };

  const find = (query, opts) => {
    return new Promise((resolve, reject) => {
      coll.find(query, opts, (err, docs) => {
        if (err) {
          reject({message: 'Mongo#find error', err});
        }
        else {
          resolve(docs.toArray());
        }
      });
    });
  };

  const findOne = (query, opts) => {
    return new Promise((resolve, reject) => {
      coll.findOne(query, opts, (err, doc) => {
        if (err) {
          reject({message: 'Mongo#findOne error', err});
        }
        else {
          resolve(doc);
        }
      });
    });
  };

  const remove = query => {
    return new Promise((resolve, reject) => {
      coll.remove(query, {multi: true}, (err, result) => {
        if (err) {
          reject({message: 'Mongo#remove error', err});
        }
        else {
          resolve(result);
        }
      });
    });
  };

  const removeOne = query => {
    return new Promise((resolve, reject) => {
      coll.remove(query, {multi: false}, (err, result) => {
        if (err) {
          reject({message: 'Mongo#removeOne error', err});
        }
        else {
          resolve(result);
        }
      });
    });
  };

  const updateById = (id, data) => {
    return update(idQ(id), data);
  };

  const setById = (id, data) => {
    return setOne(idQ(id), data);
  };

  const findById = id => {
    return findOne(idQ(id));
  };

  const removeById = id => {
    return remove(idQ(id));
  };

  const close = () => {
    return new Promise((resolve, reject) => {
      try {
        db.close();
        resolve();
      }
      catch (e) {
        reject(e);
      }
    });
  };

  return { // API:
    ObjectId: mongodb.ObjectId,
    db, coll, collName, close,
    insert, insertOne,
    update, updateById,
    set, setOne, setById,
    find, findOne, findById,
    remove, removeOne, removeById,
  };
};

module.exports = (url, collNames) => {
  return new Promise((resolve, reject) => {
    mongodb.MongoClient.connect(url, (err, db) => {
      if (err) {
        reject({message: 'Mongo#connect error', err});
      }
      else {
        if (typeof collNames === 'string') {
          collNames = [collNames];
        }
        if (!(collNames instanceof Array)) {
          collNames = [];
        }
        const apis = collNames.map(collName => {
          return createAPI(db, collName);
        });
        resolve(apis);
      }
    });
  });
};
