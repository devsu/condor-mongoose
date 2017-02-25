const CrudBaseService = require('./crud-base-service');
const BaseService = require('./base-service');
const Model = require('../spec/stubs/models/sample/sample-model');
const TestUtils = require('./test-utils');

describe('Service', () => {
  beforeAll((done) => {
    TestUtils.initializeMongoose().then(done);
  });

  afterAll((done) => {
    TestUtils.disconnectMongoose().then(done);
  });

  it('should extend from CrudBaseService', () => {
    expect(BaseService.prototype instanceof CrudBaseService).toBeTruthy();
  });

  describe('constructor()', () => {
    it('should create instances of BaseService', () => {
      const baseService = new BaseService(Model);
      expect(baseService instanceof BaseService).toBeTruthy();
    });

    describe('when mongoose is not connected', () => {
      beforeEach((done) => {
        TestUtils.disconnectMongoose().then(done);
      });
      it('should throw an error', () => {
        expect(() => {
          /* eslint-disable no-new */
          new BaseService(Model);
        }).toThrowError('mongoose is not connected');
      });
    });
  });
});
