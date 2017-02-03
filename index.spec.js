const Service = require('./index');
const BaseService = require('./module/base-service');

describe('condor-mongoose', () => {
  it('should expose base-service', () => {
    expect(Service).toBe(BaseService);
  });
});
