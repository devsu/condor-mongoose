const condorMongoose = require('./index');
const CrudBaseService = require('./lib/crud-base-service');
const TestUtils = require('./lib/test-utils');

describe('condor-mongoose', () => {
  it('should expose CrudBaseService', () => {
    expect(condorMongoose.CrudBaseService).toBe(CrudBaseService);
  });

  it('should expose TestUtils', () => {
    expect(condorMongoose.TestUtils).toBe(TestUtils);
  });
});
