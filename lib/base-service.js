const CrudBaseService = require('./crud-base-service');
const mongoose = require('mongoose');
const Model = require(`${getPathToModel()}/model`);

class BaseService extends CrudBaseService {
  constructor() {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('mongoose is not connected');
    }
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

const subDocumentMethods = {
  'push': function(call) {
    return this.Model.findOne({'_id': call.request.id})
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
    return this.Model.findOne({'_id': call.request.id})
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
    return this.Model.findOne({'_id': call.request.id})
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
    return this.Model.findOne({'_id': call.request.id})
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
    return this.Model.findOne({'_id': call.request.id})
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

Object.keys(Model.schema.paths).forEach((field) => {
  if (isSubDocumentType(field)) {
    Object.keys(subDocumentMethods).forEach((key) => {
      BaseService.prototype[key + capitalizeFirstLetter(field)] = subDocumentMethods[key];
    });
  }
});

function existChild(children, child) {
  let existChild = false;
  children.forEach((modelChild) => {
    if (modelChild._id.toString() === child.id) {
      existChild = true;
    }
  });
  return existChild;
}

function isSubDocumentType(field) {
  const type = Model.schema.paths[field].options.type;
  return type instanceof Array && type[0] instanceof mongoose.Schema;
}

function capitalizeFirstLetter(string) {
  return string[0].toUpperCase() + string.slice(1);
}

function getPathToModel() {
  const path = module.parent.filename;
  const dirs = path.split('/');
  dirs.pop();
  return (dirs.reduce((path, folder) => {
    return `${path}/${folder}`;
  }));
}

module.exports = BaseService;
