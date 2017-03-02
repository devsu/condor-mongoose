const mockgoose = require('mockgoose');
const mongoose = require('mongoose');
const Promise = require('bluebird');
const BaseService = require('./base-service');

mongoose.Promise = Promise;

module.exports = class {
  static initializeMongoose() {
    return mockgoose(mongoose)
      .then(() => {
        return mongoose.connect('mongodb://localhost/db');
      });
  }

  static disconnectMongoose() {
    return mongoose.disconnect();
  }

  static runCommonServiceTests(Service) {
    it('should extend from base service', () => {
      expect(Service.prototype instanceof BaseService).toBeTruthy();
    });

    it('should create instances of Service', () => {
      const service = new Service();
      expect(service instanceof Service).toBeTruthy();
    });
  }
};
