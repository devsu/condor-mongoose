const mongoose = require('mongoose');
const _ = require('lodash');
const pluralize = require('pluralize');
const CrudBaseService = require('./crud-base-service');

const ActionEnum = Object.freeze(
  {
    'PUSH': 0, 'ADD_TO_SET': 1, 'REMOVE': 2, 'REPLACE': 3, 'UPDATE': 4, 'ADD': 5,
    'REMOVE_SINGLE': 6,
  }
);

class CrudBaseServiceFull extends CrudBaseService {
  constructor(Model) {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('mongoose is not connected');
    }
    createAdditionalMethods(Model);
    super(Model);
  }

  static getSubDocumentFieldName(request) {
    let fieldName = '';
    Object.keys(request).forEach((key) => {
      if (key !== 'id') {
        fieldName = key;
      }
    });
    return fieldName;
  }
}

function createAdditionalMethods(Model) {
  Object.keys(Model.schema.paths).forEach((field) => {
    if (isSubDocumentType(Model, field)) {
      addMethods(getSubDocumentMethods(Model), field);
      addSingleMethods(getSubDocumentSingleMethods(Model), field);
    }
    if (isRelatedModelType(Model, field)) {
      addMethods(getRelatedModelMethods(Model), field);
      addSingleMethods(getRelatedModelSingleMethods(Model), field);
    }
  });
}

function addSingleMethods(methods, field) {
  Object.keys(methods).forEach((key) => {
    const singleName = pluralize.singular(field);
    CrudBaseServiceFull.prototype[key + capitalizeFirstLetter(singleName)] = methods[key];
  });
}

function addMethods(methods, field) {
  Object.keys(methods).forEach((key) => {
    CrudBaseServiceFull.prototype[key + capitalizeFirstLetter(field)] = methods[key];
  });
}

function getSubDocumentSingleMethods(Model) {
  return {
    'add': (call) => runSubDocumentRequest(Model, call.request, ActionEnum.ADD),
    'remove': (call) => runSubDocumentRequest(Model, call.request, ActionEnum.REMOVE_SINGLE),
  };
}

function getRelatedModelSingleMethods(Model) {
  return {
    'add': (call) => runRelatedModelRequest(Model, call.request, ActionEnum.ADD),
    'remove': (call) => runRelatedModelRequest(Model, call.request, ActionEnum.REMOVE_SINGLE),
  };
}

function getSubDocumentMethods(Model) {
  return {
    'push': (call) => runSubDocumentRequest(Model, call.request, ActionEnum.PUSH),
    'addToSet': (call) => runSubDocumentRequest(Model, call.request, ActionEnum.ADD_TO_SET),
    'remove': (call) => runSubDocumentRequest(Model, call.request, ActionEnum.REMOVE),
    'update': (call) => runSubDocumentRequest(Model, call.request, ActionEnum.UPDATE),
    'replace': (call) => runSubDocumentRequest(Model, call.request, ActionEnum.REPLACE),
  };
}

function getRelatedModelMethods(Model) {
  return {
    'push': (call) => runRelatedModelRequest(Model, call.request, ActionEnum.PUSH),
    'addToSet': (call) => runRelatedModelRequest(Model, call.request, ActionEnum.ADD_TO_SET),
    'remove': (call) => runRelatedModelRequest(Model, call.request, ActionEnum.REMOVE),
    'replace': (call) => runRelatedModelRequest(Model, call.request, ActionEnum.REPLACE),
  };
}

function runSubDocumentRequest(Model, request, action) {
  return getModel(Model, request.id).then((model) => {
    executeSubDocumentAction(request, model, action);
    return saveAndReturnEmptyResponse(model);
  });
}

function runRelatedModelRequest(Model, request, action) {
  return getModel(Model, request.id).then((model) => {
    executeRelatedModelAction(request, model, action);
    return saveAndReturnEmptyResponse(model);
  });
}

function executeSubDocumentAction(request, model, action) {
  const fieldName = CrudBaseServiceFull.getSubDocumentFieldName(request);

  if (action === ActionEnum.ADD) {
    const pluralFieldName = pluralize.plural(fieldName);
    model[pluralFieldName].push(request[fieldName]);
    return;
  }

  if (action === ActionEnum.REMOVE_SINGLE) {
    const pluralFieldName = pluralize.plural(fieldName);
    if (!existInArray(model[pluralFieldName], request.child.id)) {
      return console.warn(`child id '${request.child.id}' does not exist in '${fieldName}'`);
    }
    model[pluralFieldName].id(request.child.id).remove();
    return;
  }

  if (action === ActionEnum.REPLACE) {
    model[fieldName] = [];
  }
  request[fieldName].forEach((child) => {
    if (action === ActionEnum.PUSH || action === ActionEnum.REPLACE) {
      model[fieldName].push(child);
    }
    if (action === ActionEnum.ADD_TO_SET) {
      if (child.id.length > 0) {
        child._id = child.id;
      }
      model[fieldName].addToSet(child);
    }
    if (action === ActionEnum.REMOVE) {
      if (!existInArray(model[fieldName], child.id)) {
        return console.warn(`child id '${child.id}' does not exist in '${fieldName}'`);
      }
      model[fieldName].id(child.id).remove();
    }
    if (action === ActionEnum.UPDATE) {
      if (!existInArray(model[fieldName], child.id)) {
        return console.warn(`child id '${child.id}' does not exist in '${fieldName}'`);
      }
      Object.assign(model[fieldName].id(child.id), child);
    }
  });
}

function executeRelatedModelAction(request, model, action) {
  const fieldName = CrudBaseServiceFull.getSubDocumentFieldName(request);

  if (action === ActionEnum.ADD) {
    const pluralFieldName = pluralize.plural(fieldName.replace('Id', ''));
    model[pluralFieldName].push(request[fieldName]);
    return;
  }

  if (action === ActionEnum.REMOVE_SINGLE) {
    const fieldName = CrudBaseServiceFull.getSubDocumentFieldName(request);
    const pluralFieldName = pluralize.plural(fieldName.replace('Id', ''));
    if (!existInArray(model[pluralFieldName], request[fieldName])) {
      console.warn(`related model id '${request[fieldName]}' does not exist in '${fieldName}'`);
    }
    model[pluralFieldName].remove(request[fieldName]);
    return;
  }

  if (action === ActionEnum.REPLACE) {
    model[fieldName] = [];
  }
  request[fieldName].forEach((relatedModel) => {
    if (action === ActionEnum.PUSH || action === ActionEnum.REPLACE) {
      model[fieldName].push(relatedModel.id);
    }
    if (action === ActionEnum.ADD_TO_SET) {
      model[fieldName].addToSet(relatedModel.id);
    }
    if (action === ActionEnum.REMOVE) {
      if (!existInArray(model[fieldName], relatedModel.id)) {
        console.warn(`related model id '${relatedModel.id}' does not exist in '${fieldName}'`);
      }
      model[fieldName].remove(relatedModel.id);
    }
  });
}

function getModel(Model, id) {
  return Model.findOne({'_id': id})
    .then((model) => {
      CrudBaseService.validateModel(model);
      return model;
    });
}

function saveAndReturnEmptyResponse(model) {
  return model.save()
    .then(() => {
      return {};
    });
}

function existInArray(documents, stringObjectId) {
  return _.find(documents, (object) => {
    const objectId = object._id || object;
    return objectId.toString() === stringObjectId;
  });
}

function isSubDocumentType(Model, field) {
  const type = Model.schema.paths[field].options.type;
  return type instanceof Array && type[0] instanceof mongoose.Schema;
}

function isRelatedModelType(Model, field) {
  const type = Model.schema.paths[field].options.type;
  return type instanceof Array && 'type' in type[0] && type[0].type.schemaName === 'ObjectId';
}

function capitalizeFirstLetter(string) {
  return string[0].toUpperCase() + string.slice(1);
}

module.exports = CrudBaseServiceFull;
