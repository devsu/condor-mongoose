/* eslint max-lines: "off" */
const mongoose = require('mongoose');
const _ = require('lodash');
const pluralize = require('pluralize');
const GRPC_STATUS_NOT_FOUND = 5;

const ActionEnum = Object.freeze(
  {
    'PUSH': 0, 'ADD_TO_SET': 1, 'REMOVE': 2, 'REPLACE': 3, 'UPDATE': 4,
    'ADD': 5, 'REMOVE_SINGLE': 6,
  }
);

class CrudBaseService {
  constructor(Model) {
    this.Model = Model;
    createAdditionalMethods(Model);
  }

  insert(call) {
    const instance = new this.Model(call.request);
    return instance.save()
      .then((created) => {
        return CrudBaseService.getModelObject(created);
      });
  }

  update(call) {
    return this.Model.findById(call.request.id).then((model) => {
      CrudBaseService.validateModel(model);
      call.request.fields.forEach((field) => {
        if (field in this.Model.schema.obj) {
          model[field] = call.request.data[field];
          return;
        }
        console.warn(`field ${field} is not exist in the schema`);
      });
      return model.save();
    }).then((model) => {
      return CrudBaseService.getModelObject(model);
    });
  }

  delete(call) {
    return this.Model.findOneAndRemove({'_id': call.request.id})
      .then((model) => {
        CrudBaseService.validateModel(model);
      });
  }

  get(call) {
    return this.Model.findOne({'_id': call.request.id})
      .populate(call.request.populate)
      .then((model) => {
        CrudBaseService.validateModel(model);
        return CrudBaseService.getModelObject(model, call.request.populate);
      });
  }

  list(call) {
    const sort = CrudBaseService.transformSortArray(call.request.sort);
    const select = CrudBaseService.transformFieldsArray(call.request.fields);
    const whereFilter = CrudBaseService.transformWhereArray(call.request.where);
    return this.Model.find(whereFilter)
      .limit(call.request.limit)
      .skip(call.request.skip)
      .sort(sort)
      .select(select)
      .populate(call.request.populate)
      .then((documents) => {
        return documents.map((document) => {
          return CrudBaseService.getModelObject(document, call.request.populate);
        });
      });
  }

  static transformSortArray(data) {
    const result = {};
    data.forEach((obj) => {
      result[obj.field] = obj.value;
    });
    return result;
  }

  static transformFieldsArray(data) {
    const result = {};
    data.forEach((field) => {
      result[field] = 1;
    });
    return result;
  }

  static transformWhereArray(data) {
    const result = {};
    data.forEach((object) => {
      result[object.field] = CrudBaseService.getWhereValue(object);
    });
    return result;
  }

  static getWhereValue(object) {
    if (object.matcher === 'OBJECT') {
      return JSON.parse(object.value);
    }
    if (object.matcher === 'REGEX') {
      return CrudBaseService.getRegexValue(object.value);
    }
    return object.value;
  }

  static getRegexValue(value) {
    let flags = value.replace(/.*\/([gimy]*)$/, '$1');
    const pattern = value.replace(new RegExp(`^/(.*?)/${flags}$`), '$1');
    if (flags === value) {
      flags = '';
    }
    return new RegExp(pattern, flags);
  }

  static isSchemaArray(array) {
    if (array.length > 0) {
      return CrudBaseService.isSchemaObject(array[0]);
    }
    return false;
  }

  static isSchemaObject(object) {
    return object instanceof Object && '_id' in object;
  }

  static isObjectIdArray(array) {
    if (array.length > 0) {
      return CrudBaseService.isObjectId(array[0]);
    }
    return false;
  }

  static isObjectId(object) {
    return object instanceof mongoose.Types.ObjectId;
  }

  static getModelObject(model, populate) {
    const object = model.toObject();
    Object.keys(object).forEach((key) => {
      if (CrudBaseService.isObjectId(object[key])) {
        object[key] = object[key].toString();
      }
      if (object[key] instanceof Array) {
        if (CrudBaseService.isSchemaArray(model[key])) {
          object[key].forEach((item, index, array) => {
            array.splice(index, 1, CrudBaseService.getModelObject(model[key][index]));
          });
        }
        if (CrudBaseService.isObjectIdArray(model[key])) {
          object[key].forEach((item, index, array) => {
            array.splice(index, 1, {'id': item.toString()});
          });
        }
      }
      if (CrudBaseService.isSchemaObject(model[key])) {
        object[key] = CrudBaseService.getModelObject(model[key]);
      }
    });
    (populate || []).forEach((populateItem) => {
      object[populateItem] = model[populateItem];
      if (object[populateItem] instanceof Array) {
        object[populateItem].forEach((item, index, array) => {
          array.splice(index, 1, CrudBaseService.getModelObject(model[populateItem][index]));
        });
      }
    });
    object.id = object._id;
    delete object._id;
    delete object.__v; // eslint-disable-line no-underscore-dangle
    return object;
  }

  static validateModel(model) {
    if (model === null) {
      const error = new Error('Not found');
      error.code = GRPC_STATUS_NOT_FOUND;
      throw error;
    }
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
    CrudBaseService.prototype[key + capitalizeFirstLetter(singleName)] = methods[key];
  });
}

function addMethods(methods, field) {
  Object.keys(methods).forEach((key) => {
    CrudBaseService.prototype[key + capitalizeFirstLetter(field)] = methods[key];
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

function showNotFoundWarning(name, childId, fieldName) {
  return console.warn(`${name} id '${childId}' does not exist in '${fieldName}'`);
}

function executeSubDocumentAction(request, model, action) {
  const fieldName = CrudBaseService.getSubDocumentFieldName(request);

  if (action === ActionEnum.ADD) {
    return addAction(fieldName, model, request);
  }

  if (action === ActionEnum.REMOVE_SINGLE) {
    const modelFieldName = pluralize.plural(fieldName.replace('Id', ''));
    const singularFieldName = pluralize.singular(fieldName.replace('Id', ''));
    const data = model[modelFieldName] || model[singularFieldName];

    if (!existInArray(data, request[fieldName].id)) {
      return showNotFoundWarning('child', request[fieldName].id, fieldName);
    }
    data.id(request[fieldName].id).remove();
    return;
  }

  if (action === ActionEnum.REPLACE) {
    model[fieldName] = [];
  }

  request[fieldName].forEach((child) => {
    if (action === ActionEnum.PUSH || action === ActionEnum.REPLACE) {
      return model[fieldName].push(child);
    }

    if (action === ActionEnum.ADD_TO_SET) {
      if (child.id.length > 0) {
        child._id = child.id;
      }
      return model[fieldName].addToSet(child);
    }

    if (action === ActionEnum.UPDATE) {
      if (!existInArray(model[fieldName], child.id)) {
        return showNotFoundWarning('child', child.id, fieldName);
      }
      return Object.assign(model[fieldName].id(child.id), child);
    }

    if (!existInArray(model[fieldName], child.id)) {
      return showNotFoundWarning('child', child.id, fieldName);
    }
    return model[fieldName].id(child.id).remove();
  });
}

function executeRelatedModelAction(request, model, action) {
  const fieldName = CrudBaseService.getSubDocumentFieldName(request);
  if (action === ActionEnum.ADD) {
    return addAction(fieldName, model, request);
  }

  if (action === ActionEnum.REMOVE_SINGLE) {
    const modelFieldName = pluralize.plural(fieldName.replace('Id', ''));
    const singularFieldName = pluralize.singular(fieldName.replace('Id', ''));
    const data = model[modelFieldName] || model[singularFieldName];
    if (!existInArray(data, request[fieldName])) {
      return showNotFoundWarning('related model', request[fieldName], fieldName);
    }
    return data.remove(request[fieldName]);
  }

  if (action === ActionEnum.REPLACE) {
    model[fieldName] = [];
  }
  request[fieldName].forEach((relatedModel) => {
    if (action === ActionEnum.PUSH || action === ActionEnum.REPLACE) {
      return model[fieldName].push(relatedModel.id);
    }

    if (action === ActionEnum.ADD_TO_SET) {
      return model[fieldName].addToSet(relatedModel.id);
    }

    if (!existInArray(model[fieldName], relatedModel.id)) {
      return showNotFoundWarning('related model', relatedModel.id, fieldName);
    }
    model[fieldName].remove(relatedModel.id);
  });
}

function addAction(fieldName, model, request) {
  const modelFieldName = pluralize.plural(fieldName.replace('Id', ''));
  const singularFieldName = pluralize.singular(fieldName.replace('Id', ''));
  const data = model[modelFieldName] || model[singularFieldName];
  data.push(request[fieldName]);
}

function getModel(Model, id) {
  return Model.findOne({'_id': id}).then((model) => {
    CrudBaseService.validateModel(model);
    return model;
  });
}

function saveAndReturnEmptyResponse(model) {
  return model.save() .then(() => {
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

module.exports = CrudBaseService;
