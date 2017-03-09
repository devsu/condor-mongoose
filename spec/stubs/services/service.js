const BaseService = require('./../../../lib/base-service');
const Model = require('../models/model/model');
module.exports = class extends BaseService {
  constructor() {
    super(Model);
  }
};
