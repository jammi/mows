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

module.exports = (errLogger) => {

  const errors = (code, _) => {
    let message;
    switch (code) {

    // Values#get
    case -7: message = `Values#get error: value '${_.id}' not found`; break;
    case -8: message = `Values#get error: duplicate docs of id: '${_.id}': ${_.descr}`; break;
    case -12: message = `Values#get error; id '${_.id}': unable to find, because ${_.err}`; break;

    // Values#exists
    case -41: message = `Values#exists error; expected 0 or 1 docs of id '${_.id}', but got ${_.descr}`; break;
    case -42: message = `Values#exists error; unable to query id '${_.id}', because ${_.err}`; break;

    // Values#_delegate
    case -31: message = `Values#_delegate error; id '${_.id}' got unexpected data: ${_.data}`; break;

    // Values#_delegateAll
    case -32: message = `Values#_delegateAll error; id '${_.id}' got error: ${_.err}`; break;

    // Values#create
    case -1: message = `Values#create error: Non-unique id: '${_.id}' specified`; break;
    case -2: message = `Values#create insertion; id: '${_.id}' error: ${_.err}`; break;
    case -3: message = `Values#create session update; id: '${_.id}' error: ${_.err}`; break;
    case -29: message = `Values#create error: value '${_.id}' delegation failed`; break;

    // Values#_clientCreated
    case -25: message = `Values#_clientCreated error: Non-unique id '${_.id}' specified`; break;
    case -24: message = `Values#_clientCreated insertion; id '${_.id}' error: ${_.err}`; break;
    case -23: message = `Values#_clientCreated session update; id '${_.id}' error: ${_.err}`; break;
    case -30: message = `Values#_clientCreated delegation: value '${_.id}' delegation error ${_.err}`; break;

    // Values#listen
    case -33: message = `Values#listen error: id '${_.id}' invalid event: '${_.descr}'`; break;
    case -34: message = `Values#listen error: id '${_.id}' valDb update error: '${_.err}'`; break;

    // Values#ignore
    case -35: message = `Values#ignore error: id '${_.id}' invalid event: '${_.descr}'`; break;
    case -36: message = `Values#ignore error: id '${_.id}' valDb update error: '${_.err}'`; break;

    // Values#set
    case -9: message = `Values#set error: value '${_.id}' encountered value update error: ${_.err}`; break;
    case -10: message = `Values#set error: value '${_.id}' encountered session update error: ${_.err}`; break;
    case -37: message = `Values#set error: value '${_.id}' delegation error: ${_.err}`; break;

    // Values#_clientSet
    case -26: message = `Values#_clientSet error: value '${_.id}' encountered value update error: ${_.err}`; break;
    case -38: message = `Values#_clientSet error: value '${_.id}' delegation error: ${_.err}`; break;

    // Values#del
    case -21: message = `Values#del error: value '${_.id}' encountered session update error: ${_.err}`; break;
    case -22: message = `Values#del error: value '${_.id}' encountered value deletion error: ${_.err}`; break;
    case -39: message = `Values#del error: value '${_.id}' delegation error: ${_.err}`; break;

    // Values#_clientDel
    case -27: message = `Values#_clientDel error: value '${_.id}' encountered session update error: ${_.err}`; break;
    case -28: message = `Values#_clientDel error: value '${_.id}' encountered value deletion error: ${_.err}`; break;
    case -40: message = `Values#_clientDel error: value '${_.id}' delegation error: ${_.err}`; break;

    // Sync#sanitizeIn
    case -17: message = `syncIn error: duplicate id for the same 'new' sync operation: '${_.id}', omitted last`; break;
    case -18: message = `syncIn error: duplicate id for the same 'set' sync operation: '${_.id}', omitted last`; break;
    case -19: message = `syncIn error: duplicate id for the same 'del' sync operation: '${_.id}', omitted last`; break;

    // Sync#syncIn:new
    case -5: message = `syncIn error: many values of id '${_.id}' already exists!`; break;
    case -6: message = `syncIn error: unknown error when checking existence before creating id '${_.id}': ${_.descr}`; break;
    case -4: message = `syncIn error: value of id '${_.id}' already exists!`; break;

    // Sync#syncIn:set
    case -13: message = `syncIn error: no value of id '${_.id}' found!`; break;
    case -14: message = `syncIn error: many values of id '${_.id}' found!`; break;
    case -15: message = `syncIn error: unknown error when checking existence before setting id '${_.id}': ${_.descr}`; break;

    // Sync#syncIn:del
    case -11: message = `syncIn error: unknown error when deleting id '${_.id}': err`; break;
    case -20: message = `syncIn error: unable to delete, beacuse ${_.id} doesn't exist`; break;

    // Unknown:
    // case -16: message = ''; break;

    default: message = `Values#undefined error code: ${code}`;
    }
    errLogger(`Error code: ${code}, message: ${message}`);
    return {message, code};
  };

  const catchIdReject = (_reject) => {
    return (code, id, descr) => {
      return (err) => {
        _reject(errors(code, {id, err, descr}));
      };
    };
  };

  return {errors, catchIdReject};
};
