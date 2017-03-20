const BaseService = require('./../../../lib/crud-base-service-full');
const Model = require('../models/model/model');
module.exports = class extends BaseService {
  constructor() {
    super(Model);
  }
};
