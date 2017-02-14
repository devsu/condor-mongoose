const TestUtils = require('./test-utils');
const Service = require('../spec/stubs/models/sample/sample-service');

describe('TestUtils', () => {
  describe('should work with SampleService', () => {
    beforeAll((done) => {
      TestUtils.initializeMongoose().then(done);
    });

    afterAll((done) => {
      TestUtils.disconnectMongoose().then(done);
    });

    TestUtils.runCommonServiceTests(Service);
  });
});
