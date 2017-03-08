const TestUtils = require('./test-utils');
const Service = require('./../spec/stubs/services/service');
const Model = require('./../spec/stubs/models/model/model');

describe('TestUtils', () => {
  describe('should work with SampleService', () => {
    beforeAll((done) => {
      TestUtils.initializeMongoose().then(done);
    });

    afterAll((done) => {
      TestUtils.disconnectMongoose().then(done);
    });

    TestUtils.runCommonServiceTests(Service, Model);
  });
});
