const grpc = require('grpc');
const mongoose = require('mongoose');
const Promise = require('bluebird');
const Condor = require('condor-framework');

const CrudBaseService = require('./crud-base-service');
const BaseService = require('./base-service');
const TestUtils = require('./test-utils');

const Model = require('../spec/stubs/models/sample/sample-model');

mongoose.Promise = Promise;
fdescribe('Base Service', () => {
  let condor, client;
  const protoPath = './spec/stubs/proto/sample.proto';

  beforeAll((done) => {
    TestUtils.initializeMongoose()
      .then(() => {
        initializeCondorServer();
        initializeCondorClient();
        done();
      });
  });

  beforeEach((done) => {
    let newModel, model1, model2, model3;
    const defaultModel1 = {'name': 'Juan Pablo', 'age': 33, 'married': false};
    const defaultModel2 = {'name': 'Juan Diego', 'age': 33, 'married': true};
    const defaultModel3 = {'name': 'Jorge Eduardo', 'age': 29, 'married': true};
    newModel = new Model(defaultModel1);
    newModel.save()
      .then((model) => {
        model1 = BaseService.getModelObject(model);
        newModel = new Model(defaultModel2);
        return newModel.save();
      })
      .then((model) => {
        model2 = BaseService.getModelObject(model);
        newModel = new Model(defaultModel3);
        return newModel.save();
      })
      .then((model) => {
        model3 = BaseService.getModelObject(model);
        done();
      });
  });

  afterEach((done) => {
    if (mongoose.connection.readyState === 1) {
      Model.remove({})
        .then(done);
    }
    done();
  });

  afterAll((done) => {
    condor.stop()
      .then(() => {
        return TestUtils.disconnectMongoose();
      })
      .then(done);
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

    xdescribe('subdocument methods', () => {
      describe('push', () => {
        it('should add a new sub-document', () => {

        });
      });
    });
  });

  function initializeCondorServer() {
    condor = new Condor()
      .addService(protoPath, 'smartmate.SamplesService', new BaseService())
      .start();
  }

  function initializeCondorClient() {
    const coreProto = grpc.load(protoPath);
    client = new coreProto.smartmate
      .SamplesService('127.0.0.1:3000', grpc.credentials.createInsecure());
  }
});
