const Service = require('./service');
const TestUtils = require('../test-utils');

describe('service', () => {
  beforeAll((done) => {
    TestUtils.initializeMongoose().then(done);
  });

  afterAll((done) => {
    TestUtils.disconnectMongoose().then(done);
  });

  TestUtils.runCommonServiceTests(Service);
});
