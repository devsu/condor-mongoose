const CrudBaseService = require('./crud-base-service');
const mongoose = require('mongoose');

class BaseService extends CrudBaseService {
  constructor(Model) {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('mongoose is not connected');
    }
    createSubDocumentMethods(Model);
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

function createSubDocumentMethods(Model) {
  Object.keys(Model.schema.paths).forEach((field) => {
    if (isSubDocumentType(Model, field)) {
      const subDocumentMethods = getSubDocumentMethods(Model);
      Object.keys(subDocumentMethods).forEach((key) => {
        BaseService.prototype[key + capitalizeFirstLetter(field)] = subDocumentMethods[key];
      });
    }
    if (isRelatedModelType(Model, field)) {
      const relatedModelMethods = getRelatedModelMethods(Model);
      Object.keys(relatedModelMethods).forEach((key) => {
        BaseService.prototype[key + capitalizeFirstLetter(field)] = relatedModelMethods[key];
      });
    }
  });
}

function getSubDocumentMethods(Model) {
  return {
    'push': function(call) {
      return Model.findOne({'_id': call.request.id})
        .then((model) => {
          if (model === null) {
            CrudBaseService.throwNotFoundError();
          }
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((child) => {
            model[fieldName].push(child);
          });
          return model.save();
        }).then(() => {
          return {};
        });
    },
    'addToSet': function(call) {
      return Model.findOne({'_id': call.request.id})
        .then((model) => {
          if (model === null) {
            CrudBaseService.throwNotFoundError();
          }
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((child) => {
            if ('id' in child && child.id.length > 0) {
              child._id = child.id;
            }
            model[fieldName].addToSet(child);
          });
          return model.save();
        }).then(() => {
          return {};
        });
    },
    'remove': function(call) {
      return Model.findOne({'_id': call.request.id})
        .then((model) => {
          if (model === null) {
            CrudBaseService.throwNotFoundError();
          }
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((child) => {
            if (!existChild(model[fieldName], child)) {
              /* eslint-disable no-console */
              console.warn(`sub document id '${child.id}' does not exist in '${fieldName}'`);
              return;
            }
            model[fieldName].id(child.id).remove();
          });
          return model.save();
        }).then(() => {
          return {};
        });
    },
    'update': function(call) {
      return Model.findOne({'_id': call.request.id})
        .then((model) => {
          if (model === null) {
            CrudBaseService.throwNotFoundError();
          }
          const fieldName = BaseService.getSubDocumentFieldName(call.request);

          call.request[fieldName].forEach((child) => {
            if (!existChild(model[fieldName], child)) {
              /* eslint-disable no-console */
              console.warn(`sub document id '${child.id}' does not exist in '${fieldName}'`);
              return;
            }
            Object.assign(model[fieldName].id(child.id), child);
          });
          return model.save();
        }).then(() => {
          return {};
        });
    },
    'replace': function(call) {
      return Model.findOne({'_id': call.request.id})
        .then((model) => {
          if (model === null) {
            CrudBaseService.throwNotFoundError();
          }
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          model[fieldName].forEach((child) => {
            model[fieldName].id(child._id).remove();
          });
          call.request[fieldName].forEach((child) => {
            model[fieldName].push(child);
          });
          return model.save();
        }).then(() => {
          return {};
        });
    },
  };
}

function getRelatedModelMethods(Model) {
  return {
    'push': function(call) {
      return Model.findOne({'_id': call.request.id})
        .then((model) => {
          if (model === null) {
            CrudBaseService.throwNotFoundError();
          }
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((relatedModel) => {
            model[fieldName].push(relatedModel.id);
          });
          return model.save();
        }).then(() => {
          return {};
        });
    },
    'addToSet': function(call) {
      return Model.findOne({'_id': call.request.id})
        .then((model) => {
          if (model === null) {
            CrudBaseService.throwNotFoundError();
          }
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((relatedModel) => {
            model[fieldName].addToSet(relatedModel.id);
          });
          return model.save();
        }).then(() => {
          return {};
        });
    },
    'remove': function(call) {
      return Model.findOne({'_id': call.request.id})
        .then((model) => {
          if (model === null) {
            CrudBaseService.throwNotFoundError();
          }
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          call.request[fieldName].forEach((relatedModel) => {
            if (!existRelatedModel(model[fieldName], relatedModel)) {
              /* eslint-disable no-console */
              console.warn(`related model id '${relatedModel.id}' does not exist in 
              '${fieldName}'`);
              return;
            }
            model[fieldName].remove(relatedModel.id);
          });
          return model.save();
        }).then(() => {
          return {};
        });
    },
    'replace': function(call) {
      return Model.findOne({'_id': call.request.id})
        .then((model) => {
          if (model === null) {
            CrudBaseService.throwNotFoundError();
          }
          const fieldName = BaseService.getSubDocumentFieldName(call.request);
          model[fieldName] = [];
          call.request[fieldName].forEach((relatedModel) => {
            model[fieldName].push(relatedModel.id);
          });
          return model.save();
        }).then(() => {
          return {};
        });
    },
  };
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
  let existantRelatedModel = false;
  relatedModels.forEach((modelRelatedModel) => {
    if (modelRelatedModel.toString() === relatedModel.id) {
      existantRelatedModel = true;
    }
  });
  return existantRelatedModel;
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
