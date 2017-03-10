const CrudBaseService = require('./crud-base-service');
const mongoose = require('mongoose');
const ActionEnum = Object.freeze(
    {'PUSH': 0, 'ADD_TO_SET': 1, 'REMOVE': 2, 'REPLACE': 3, 'UPDATE': 4}
  );

class BaseService extends CrudBaseService {
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
    }
    if (isRelatedModelType(Model, field)) {
      addMethods(getRelatedModelMethods(Model), field);
    }
  });
}

function addMethods(methods, field) {
  Object.keys(methods).forEach((key) => {
    BaseService.prototype[key + capitalizeFirstLetter(field)] = methods[key];
  });
}

function getSubDocumentMethods(Model) {
  return {
    'push': function(call) {
      return runSubDocumentRequest(Model, call.request, ActionEnum.PUSH);
    },
    'addToSet': function(call) {
      return runSubDocumentRequest(Model, call.request, ActionEnum.ADD_TO_SET);
    },
    'remove': function(call) {
      return runSubDocumentRequest(Model, call.request, ActionEnum.REMOVE);
    },
    'update': function(call) {
      return runSubDocumentRequest(Model, call.request, ActionEnum.UPDATE);
    },
    'replace': function(call) {
      return runSubDocumentRequest(Model, call.request, ActionEnum.REPLACE);
    },
  };
}

function getRelatedModelMethods(Model) {
  return {
    'push': function(call) {
      return runRelatedModelRequest(Model, call.request, ActionEnum.PUSH);
    },
    'addToSet': function(call) {
      return runRelatedModelRequest(Model, call.request, ActionEnum.ADD_TO_SET);
    },
    'remove': function(call) {
      return runRelatedModelRequest(Model, call.request, ActionEnum.REMOVE);
    },
    'replace': function(call) {
      return runRelatedModelRequest(Model, call.request, ActionEnum.REPLACE);
    },
  };
}

function runSubDocumentRequest(Model, request, action) {
  return getModel(Model, request.id)
    .then((model) => {
      executeSubDocumentAction(request, model, action);
      return saveAndReturnEmptyResponse(model);
    });
}

function runRelatedModelRequest(Model, request, action) {
  return getModel(Model, request.id)
    .then((model) => {
      executeRelatedModelAction(request, model, action);
      return saveAndReturnEmptyResponse(model);
    });
}

function executeSubDocumentAction(request, model, action) {
  const fieldName = BaseService.getSubDocumentFieldName(request);
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
      if (existChild(model[fieldName], child, fieldName)) {
        model[fieldName].id(child.id).remove();
      }
    }
    if (action === ActionEnum.UPDATE) {
      if (existChild(model[fieldName], child, fieldName)) {
        Object.assign(model[fieldName].id(child.id), child);
      }
    }
  });
}

function executeRelatedModelAction(request, model, action) {
  const fieldName = BaseService.getSubDocumentFieldName(request);
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
      if (existRelatedModel(model[fieldName], relatedModel, fieldName)) {
        model[fieldName].remove(relatedModel.id);
      }
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

function existChild(children, child, fieldName) {
  let existChild = false;
  children.forEach((modelChild) => {
    if (modelChild._id.toString() === child.id) {
      existChild = true;
    }
  });
  if (!existChild) {
    console.warn(`child id '${child.id}' does not exist in 
              '${fieldName}'`);
  }
  return existChild;
}

function existRelatedModel(relatedModels, relatedModel, fieldName) {
  let existRelatedModel = false;
  relatedModels.forEach((modelRelatedModel) => {
    if (modelRelatedModel.toString() === relatedModel.id) {
      existRelatedModel = true;
    }
  });
  if (!existRelatedModel) {
    console.warn(`related model id '${relatedModel.id}' does not exist in 
              '${fieldName}'`);
  }
  return existRelatedModel;
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

module.exports = BaseService;
