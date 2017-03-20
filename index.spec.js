const condorMongoose = require('./index');
const CrudBaseService = require('./lib/crud-base-service');
const CrudBaseServiceFull = require('./lib/crud-base-service-full');
const TestUtils = require('./lib/test-utils');

describe('condor-mongoose', () => {
  it('should expose CrudBaseService', () => {
    expect(condorMongoose.CrudBaseService).toBe(CrudBaseService);
  });

  it('should expose CrudBaseServiceFull', () => {
    expect(condorMongoose.CrudBaseServiceFull).toBe(CrudBaseServiceFull);
  });

  it('should expose TestUtils', () => {
    expect(condorMongoose.TestUtils).toBe(TestUtils);
  });
});
