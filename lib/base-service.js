const CrudBaseService = require('./crud-base-service');
const mongoose = require('mongoose');

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
      return getModel(Model, call.request.id)
        .then((model) => {
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((child) => {
            model[fieldName].push(child);
          });
          return saveAndReturnEmptyResponse(model);
        });
    },
    'addToSet': function(call) {
      return getModel(Model, call.request.id)
        .then((model) => {
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((child) => {
            if ('id' in child && child.id.length > 0) {
              child._id = child.id;
            }
            model[fieldName].addToSet(child);
          });
          return saveAndReturnEmptyResponse(model);
        });
    },
    'remove': function(call) {
      return getModel(Model, call.request.id)
        .then((model) => {
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((child) => {
            if (!existChild(model[fieldName], child)) {
              console.warn(`sub document id '${child.id}' does not exist in '${fieldName}'`);
              return;
            }
            model[fieldName].id(child.id).remove();
          });
          return saveAndReturnEmptyResponse(model);
        });
    },
    'update': function(call) {
      return getModel(Model, call.request.id)
        .then((model) => {
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((child) => {
            if (!existChild(model[fieldName], child)) {
              console.warn(`sub document id '${child.id}' does not exist in '${fieldName}'`);
              return;
            }
            Object.assign(model[fieldName].id(child.id), child);
          });
          return saveAndReturnEmptyResponse(model);
        });
    },
    'replace': function(call) {
      return getModel(Model, call.request.id)
        .then((model) => {
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          model[fieldName].forEach((child) => {
            model[fieldName].id(child._id).remove();
          });
          call.request[fieldName].forEach((child) => {
            model[fieldName].push(child);
          });
          return saveAndReturnEmptyResponse(model);
        });
    },
  };
}

function getRelatedModelMethods(Model) {
  return {
    'push': function(call) {
      return getModel(Model, call.request.id)
        .then((model) => {
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((relatedModel) => {
            model[fieldName].push(relatedModel.id);
          });
          return saveAndReturnEmptyResponse(model);
        });
    },
    'addToSet': function(call) {
      return getModel(Model, call.request.id)
        .then((model) => {
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((relatedModel) => {
            model[fieldName].addToSet(relatedModel.id);
          });
          return saveAndReturnEmptyResponse(model);
        });
    },
    'remove': function(call) {
      return getModel(Model, call.request.id)
        .then((model) => {
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((relatedModel) => {
            if (!existRelatedModel(model[fieldName], relatedModel)) {
              console.warn(`related model id '${relatedModel.id}' does not exist in 
              '${fieldName}'`);
              return;
            }
            model[fieldName].remove(relatedModel.id);
          });
          return saveAndReturnEmptyResponse(model);
        });
    },
    'replace': function(call) {
      return getModel(Model, call.request.id)
        .then((model) => {
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          model[fieldName] = [];
          call.request[fieldName].forEach((relatedModel) => {
            model[fieldName].push(relatedModel.id);
          });
          return saveAndReturnEmptyResponse(model);
        });
    },
  };
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

function existChild(children, child) {
  let existChild = false;
  children.forEach((modelChild) => {
    if (modelChild._id.toString() === child.id) {
      existChild = true;
    }
  });
  return existChild;
}

function existRelatedModel(relatedModels, relatedModel) {
  let existRelatedModel = false;
  relatedModels.forEach((modelRelatedModel) => {
    if (modelRelatedModel.toString() === relatedModel.id) {
      existRelatedModel = true;
    }
  });
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
