const SampleModel = require('./sample-model');
const BaseService = require('../../module/base-service');

module.exports = class extends BaseService {
  constructor() {
    super(SampleModel);
  }
};
