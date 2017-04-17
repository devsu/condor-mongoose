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
    this._createAdditionalMethods();
  }

  insert(call) {
    const instance = new this.Model(call.request);
    return instance.save().then((created) => {
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
    return this.Model.findOneAndRemove({'_id': call.request.id}).then((model) => {
      return CrudBaseService.validateModel(model);
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

  _createAdditionalMethods() {
    Object.keys(this.Model.schema.paths).forEach((field) => {
      this.type = CrudBaseService.findFieldType(this.Model, field);

      if (this.type) {
        this._addMethods(field);
      }
    });
  }

  _addMethods(field) {
    const name = CrudBaseService.capitalizeFirstLetter(field);
    const singleName = pluralize.singular(CrudBaseService.capitalizeFirstLetter(field));
    const type = this.type;

    CrudBaseService.prototype[`push${name}`] = (call) =>
      this._runRequest(call.request, ActionEnum.PUSH, type);
    CrudBaseService.prototype[`addToSet${name}`] = (call) =>
      this._runRequest(call.request, ActionEnum.ADD_TO_SET, type);
    CrudBaseService.prototype[`remove${name}`] = (call) =>
      this._runRequest(call.request, ActionEnum.REMOVE, type);
    CrudBaseService.prototype[`replace${name}`] = (call) =>
      this._runRequest(call.request, ActionEnum.REPLACE, type);
    CrudBaseService.prototype[`add${singleName}`] = (call) =>
      this._runRequest(call.request, ActionEnum.ADD, type);
    CrudBaseService.prototype[`remove${singleName}`] = (call) =>
      this._runRequest(call.request, ActionEnum.REMOVE_SINGLE, type);

    if (type === 'subdocument') {
      CrudBaseService.prototype[`update${name}`] = (call) =>
        this._runRequest(call.request, ActionEnum.UPDATE, type);
    }
  }

  _runRequest(request, action, type) {
    return CrudBaseService.getModel(this.Model, request.id).then((model) => {
      this._executeAction(request, model, {action, type});
      return CrudBaseService.saveAndReturnEmptyResponse(model);
    });
  }

  _executeAction(request, model, {action, type}) {
    const fieldName = CrudBaseService.getSubDocumentFieldName(request);
    const modelFieldName = pluralize.plural(fieldName.replace('Id', ''));
    const singularFieldName = pluralize.singular(fieldName.replace('Id', ''));
    const data = model[modelFieldName] || model[singularFieldName];

    if (action === ActionEnum.ADD) {
      return data.push(request[fieldName]);
    }

    if (action === ActionEnum.REMOVE_SINGLE) {
      return this._removeSingleAction(request[fieldName], {fieldName, data, type});
    }

    if (action === ActionEnum.REPLACE) {
      model[fieldName] = [];
    }

    request[fieldName].forEach((element) => {
      switch (action) {
        case ActionEnum.PUSH:
        case ActionEnum.REPLACE:
          return model[fieldName].push((type === 'subdocument' ? element : element.id));
        case ActionEnum.ADD_TO_SET:
          return this._addToSetAction(model, {fieldName, type}, element);
        case ActionEnum.UPDATE:
          return this._updateAction(model, fieldName, element);
        case ActionEnum.REMOVE: default:
          return this._removeAction(model, {fieldName, type}, element);
      }
    });
  }

  _addToSetAction(model, {fieldName, type}, element) {
    if (element.id.length > 0) {
      element._id = element.id;
    }
    return model[fieldName].addToSet((type === 'subdocument' ? element : element.id));
  }

  _updateAction(model, fieldName, element) {
    if (!CrudBaseService.existInArray(model[fieldName], element.id)) {
      return CrudBaseService.showNotFoundWarning('child', element.id, fieldName);
    }
    return Object.assign(model[fieldName].id(element.id), element);
  }

  _removeSingleAction(request, {fieldName, data, type}) {
    const warningText = (type === 'subdocument') ? 'child' : 'related model';
    const elementId = request.id || request;
    if (!CrudBaseService.existInArray(data, elementId)) {
      return CrudBaseService.showNotFoundWarning(warningText, elementId, fieldName);
    }
    return (type === 'subdocument') ? data.id(request.id).remove() : data.remove(request);
  }

  _removeAction(model, {fieldName, type}, element) {
    const warningText = (type === 'subdocument') ? 'child' : 'related model';
    if (!CrudBaseService.existInArray(model[fieldName], element.id)) {
      return CrudBaseService.showNotFoundWarning(warningText, element.id, fieldName);
    }

    return (type === 'subdocument') ?
      model[fieldName].id(element.id).remove() :
      model[fieldName].remove(element.id);
  }

  static saveAndReturnEmptyResponse(model) {
    return model.save().then(() => {
      return {};
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

  static showNotFoundWarning(name, childId, fieldName) {
    return console.warn(`${name} id '${childId}' does not exist in '${fieldName}'`);
  }

  static getModel(Model, id) {
    return Model.findOne({'_id': id}).then((model) => {
      CrudBaseService.validateModel(model);
      return model;
    });
  }

  static existInArray(documents, stringObjectId) {
    return _.find(documents, (object) => {
      const objectId = object._id || object;
      return objectId.toString() === stringObjectId;
    });
  }

  static findFieldType(Model, field) {
    const type = Model.schema.paths[field].options.type;
    if (type instanceof Array && type[0] instanceof mongoose.Schema) {
      return 'subdocument';
    }

    if (type instanceof Array && 'type' in type[0] && type[0].type.schemaName === 'ObjectId') {
      return 'related model';
    }
  }

  static capitalizeFirstLetter(string) {
    return string[0].toUpperCase() + string.slice(1);
  }
}

module.exports = CrudBaseService;
