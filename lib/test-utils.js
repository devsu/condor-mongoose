const mockgoose = require('mockgoose');
const mongoose = require('mongoose');
const Promise = require('bluebird');

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

  static runCommonServiceTests(Service, Model) {
    it('should create instances of Service', () => {
      const service = new Service(Model);
      expect(service instanceof Service).toBeTruthy();
    });
  }
};
