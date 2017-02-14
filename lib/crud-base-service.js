const mongoose = require('mongoose');
const Promise = require('bluebird');
const grpc = require('grpc');

mongoose.Promise = Promise;

module.exports = class CrudBaseService {
  constructor(Model) {
    this.Model = Model;
    if (mongoose.connection.readyState !== 1) {
      throw new Error('mongoose is not connected');
    }
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
      if (model === null) {
        CrudBaseService.throwNotFoundError();
      }
      call.request.fields.forEach((field) => {
        if (field in this.Model.schema.obj) {
          model[field] = call.request.data[field];
          return;
        }
        /* eslint-disable no-console */
        console.warn(`field ${field} is not exist in the schema`);
      });
      return model.save();
    }).then((model) => {
      return CrudBaseService.getModelObject(model);
    });
  }

  delete(call) {
    return this.Model.remove({'_id': call.request.id})
      .then((result) => {
        if (result.result.n === 0) {
          CrudBaseService.throwNotFoundError();
        }
        return {};
      });
  }

  get(call) {
    return this.Model.findOne({'_id': call.request.id})
      .then((model) => {
        if (model === null) {
          CrudBaseService.throwNotFoundError();
        }
        return CrudBaseService.getModelObject(model);
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
      .populate(call.request.includes)
      .then((documents) => {
        return documents.map((document) => {
          return CrudBaseService.getModelObject(document, call.request.includes);
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

  static getModelObject(model, includes) {
    const object = model.toObject();
    Object.keys(object).forEach((key) => {
      if (object[key] instanceof mongoose.Types.ObjectId) {
        object[key] = object[key].toString();
      }

      /* on update, the saved model return an array with relatedModel
      we have to remove them, because the proto has another return type */
      if (model[key] instanceof Array &&
        model[key].length > 0 &&
        model[key][0] instanceof mongoose.Types.ObjectId) {
        object[key] = [];
      }
    });

    (includes || []).forEach((include) => {
      if (object[include] instanceof Array) {
        model[include].forEach((relatedModel, index) => {
          object[include].splice(index, 1, CrudBaseService.getModelObject(relatedModel, []));
        });
      }
    });

    object.id = object._id;
    delete object._id;
    delete object.__v; // eslint-disable-line no-underscore-dangle
    return object;
  }

  static throwNotFoundError() {
    const error = new Error('Not found');
    error.code = grpc.status.NOT_FOUND;
    throw error;
  }
};
