const condorMongoose = require('./index');
const BaseService = require('./lib/base-service');
const TestUtils = require('./lib/test-utils');

describe('condor-mongoose', () => {
  it('should expose CrudBaseService', () => {
    expect(condorMongoose.CrudBaseService).toBe(BaseService);
  });

  it('should expose TestUtils', () => {
    expect(condorMongoose.TestUtils).toBe(TestUtils);
  });
});
