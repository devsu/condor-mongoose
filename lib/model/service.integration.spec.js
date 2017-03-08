const mockgoose = require('mockgoose');
const mongoose = require('mongoose');

const Service = require('./service');
const Model = require('../model');

describe('service', () => {
  beforeAll((done) => {
    mockgoose(mongoose)
      .then(() => {
        return mongoose.connect('mongodb://localhost/db');
      })
      .then(done);
  });

  afterAll((done) => {
    mongoose.disconnect()
      .then(done);
  });

  describe('instance.Model', () => {
    it('should be Model from folder', () => {
      const service = new Service();
      expect(service.Model).toEqual(Model);
    });
  });
});
