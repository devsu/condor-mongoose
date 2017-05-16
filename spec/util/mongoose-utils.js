const mongoose = require('mongoose');
const Mockgoose = require('mockgoose').Mockgoose;
const mockgoose = new Mockgoose(mongoose);

module.exports = class {
  static initializeMongoose() {
    return mockgoose.prepareStorage()
      .then(() => {
        return mongoose.connect('mongodb://localhost/db');
      });
  }

  static disconnectMongoose() {
    return mongoose.disconnect();
  }
};
