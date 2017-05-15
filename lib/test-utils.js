const mongoose = require('mongoose');
const Mockgoose = require('mockgoose').Mockgoose;
const mockgoose = new Mockgoose(mongoose);
const Promise = require('bluebird');

mongoose.Promise = Promise;

module.exports = class {
  static initializeMongoose() {
    return mockgoose.prepareStorage()
      .then(() => {
        mongoose.connect('mongodb://localhost/db');
        return mongoose.connection.on('connected', () => {
          console.log('db connection is now open');
        });
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
