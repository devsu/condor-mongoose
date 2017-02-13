const SampleModel = require('./sample-model');
const CrudBaseService = require('../../../../lib/crud-base-service');

module.exports = class extends CrudBaseService {
  constructor() {
    super(SampleModel);
  }
};
