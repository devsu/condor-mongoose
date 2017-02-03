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
        return this.getModelObject(created);
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
      return this.getModelObject(model);
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
        return this.getModelObject(model);
      });
  }

  list(call) {
    const sort = this.transformSortArray(call.request.sort);
    const select = this.transformFieldsArray(call.request.fields);
    const whereFilter = this.transformWhereArray(call.request.where);
    return this.Model.find(whereFilter)
      .limit(call.request.limit)
      .skip(call.request.skip)
      .sort(sort)
      .select(select)
      .then((documents) => {
        return documents.map((document) => {
          return this.getModelObject(document);
        });
      });
  }

  transformSortArray(data) {
    const result = {};
    data.forEach((obj) => {
      result[obj.field] = obj.value;
    });
    return result;
  }

  transformFieldsArray(data) {
    const result = {};
    data.forEach((field) => {
      result[field] = 1;
    });
    return result;
  }

  transformWhereArray(data) {
    const result = {};
    data.forEach((object) => {
      result[object.field] = this.getWhereValue(object);
    });
    return result;
  }

  getWhereValue(object) {
    if (object.matcher === 'OBJECT') {
      return JSON.parse(object.value);
    }
    if (object.matcher === 'REGEX') {
      return this.getRegexValue(object.value);
    }
    return object.value;
  }

  getRegexValue(value) {
    let flags = value.replace(/.*\/([gimy]*)$/, '$1');
    const pattern = value.replace(new RegExp(`^/(.*?)/${flags}$`), '$1');
    if (flags === value) {
      flags = '';
    }
    return new RegExp(pattern, flags);
  }

  getModelObject(model) {
    const object = model.toObject();
    object.id = object._id.toString();
    delete object.__v;
    delete object._id;
    return object;
  }

  static throwNotFoundError() {
    const error = new Error('Not found');
    error.code = grpc.status.NOT_FOUND;
    throw error;
  }
};
