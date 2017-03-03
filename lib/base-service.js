const CrudBaseService = require('./crud-base-service');
const mongoose = require('mongoose');

module.exports = class BaseService extends CrudBaseService {
  constructor(Model) {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('mongoose is not connected');
    }
    super(Model);
  }

  pushChildren(call) {
    return this.Model.findOne({'_id': call.request.id})
      .then((model) => {
        const fieldName = BaseService.getFieldName(call.request);
        call.request[fieldName].forEach((child) => {
          delete child._id;
          model[fieldName].push(child);
        });

        return model.save();
      }).then(() => {
        return {};
      });
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
};
