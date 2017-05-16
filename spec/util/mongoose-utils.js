const mongoose = require('mongoose');
const mockgoose = require('mockgoose');
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
};
