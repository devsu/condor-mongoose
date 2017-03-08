const Model = require('./model/model');
const BaseService = require('./base-service');

module.exports = class extends BaseService {
  constructor() {
    super(Model);
  }
};
