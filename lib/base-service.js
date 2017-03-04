const CrudBaseService = require('./crud-base-service');
const mongoose = require('mongoose');
const Model = require('./model');

class BaseService extends CrudBaseService {
  constructor() {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('mongoose is not connected');
    }
    super(Model);
  }

  static getFieldName(request) {
    let fieldName = '';
    Object.keys(request).forEach((key) => {
      if (key !== 'id') {
        fieldName = key;
      }
    });
    return fieldName;
  }
}

const subDocumentMethods = {
  'push': function(call) {
    return this.Model.findOne({'_id': call.request.id})
      .then((model) => {
        const fieldName = BaseService.getFieldName(call.request);
        call.request[fieldName].forEach((child) => {
          model[fieldName].push(child);
        });
        return model.save();
      }).then(() => {
        return {};
      });
  },
  'addToSet': function(call) {
    return this.Model.findOne({'_id': call.request.id})
      .then((model) => {
        const fieldName = BaseService.getFieldName(call.request);
        call.request[fieldName].forEach((child) => {
          child._id = child.id;
          model[fieldName].addToSet(child);
        });
        return model.save();
      }).then(() => {
        return {};
      });
  },
  'remove': function(call) {
    return this.Model.findOne({'_id': call.request.id})
      .then((model) => {
        const fieldName = BaseService.getFieldName(call.request);
        call.request[fieldName].forEach((child) => {
          model[fieldName].id(child.id).remove();
        });
        return model.save();
      }).then(() => {
        return {};
      });
  },
  'replace': function(call) {
    return this.Model.findOne({'_id': call.request.id})
      .then((model) => {
        const fieldName = BaseService.getFieldName(call.request);
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

Object.keys(Model.schema.paths).forEach((field) => {
  if (isSubDocumentType(field)) {
    Object.keys(subDocumentMethods).forEach((key) => {
      BaseService.prototype[key + capitalizeFirstLetter(field)] = subDocumentMethods[key];
    });
  }
});

function isSubDocumentType(field) {
  const type = Model.schema.paths[field].options.type;
  return type instanceof Array && type[0] instanceof mongoose.Schema;
}

function capitalizeFirstLetter(string) {
  return string[0].toUpperCase() + string.slice(1);
}

module.exports = BaseService;
