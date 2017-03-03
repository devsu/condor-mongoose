const mongoose = require('mongoose');
const _ = require('lodash');

// const GRPC_STATUS_NOT_FOUND = 5;

module.exports = class CrudBaseService {
  constructor(Model) {
    this.Model = Model;
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
      // if (model === null) {
      //   CrudBaseService.throwNotFoundError();
      // }
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
      .then(() => {
        // if (result.result.n === 0) {
        //   CrudBaseService.throwNotFoundError();
        // }
        return {};
      });
  }

  get(call) {
    return this.Model.findOne({'_id': call.request.id})
      .populate(call.request.populate)
      .then((model) => {
        // if (model === null) {
        //   CrudBaseService.throwNotFoundError();
        // }
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

  static getModelObject(model, populate) {
    const object = model.toObject();
    Object.keys(object).forEach((key) => {
      if (object[key] instanceof mongoose.Types.ObjectId) {
        object[key] = object[key].toString();
      }
      if (object[key] instanceof Array) {
        CrudBaseService.replaceModelArrayWithObjectArray(model, object, key);
      }
    });
    (populate || []).forEach((populateItem) => {
      object[populateItem] = model[populateItem];
      if (object[populateItem] instanceof Array) {
        CrudBaseService.replaceModelArrayWithObjectArray(model, object, populateItem);
      }
    });
    object.id = object._id;
    delete object._id;
    delete object.__v; // eslint-disable-line no-underscore-dangle
    return object;
  }

  static replaceModelArrayWithObjectArray(model, object, key) {
    const array = CrudBaseService.getModelObjectArray(model[key]);
    object[key] = [];
    array.forEach((item) => {
      object[key].push(item);
    });
  }

  static getModelObjectArray(models) {
    const array = _.clone(models);
    models.forEach((model, index) => {
      array.splice(index, 1, CrudBaseService.getModelObject(model));
    });
    return array;
  }

  // static throwNotFoundError() {
  //   const error = new Error('Not found');
  //   error.code = GRPC_STATUS_NOT_FOUND;
  //   throw error;
  // }
};
