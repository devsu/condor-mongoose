const BaseService = require('./../../../lib/crud-base-service-full');
const Model = require('../models/model/alternativeModel');
module.exports = class extends BaseService {
  constructor() {
    super(Model);
  }
};
