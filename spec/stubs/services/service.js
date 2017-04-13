const BaseService = require('./../../../lib/crud-base-service');
const Model = require('../models/model/model');
module.exports = class extends BaseService {
  constructor() {
    super(Model);
  }
};
