const Model = require('./sample-model');
const BaseService = require('../../../../lib/base-service');

module.exports = class extends BaseService {
  constructor() {
    super(Model);
  }
};
