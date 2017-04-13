const BaseService = require('./../../../lib/crud-base-service');
const Model = require('../models/model/alternativeModel');
module.exports = class extends BaseService {
  constructor() {
    super(Model);
  }
};
