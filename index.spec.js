const condorMongoose = require('./index');
const CrudBaseService = require('./lib/crud-base-service');

describe('condor-mongoose', () => {
  it('should expose CrudBaseService', () => {
    expect(condorMongoose.CrudBaseService).toBe(CrudBaseService);
  });
});
