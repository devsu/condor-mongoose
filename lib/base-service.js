const CrudBaseService = require('./crud-base-service');
const mongoose = require('mongoose');

module.exports = class extends CrudBaseService {
  constructor(Model) {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('mongoose is not connected');
    }
    super(Model);
  }
};
