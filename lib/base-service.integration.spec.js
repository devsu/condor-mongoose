const grpc = require('grpc');
const mongoose = require('mongoose');
const Promise = require('bluebird');
const Condor = require('condor-framework');

const CrudBaseService = require('./crud-base-service');
const BaseService = require('./base-service');

const Service = require('./service');
const Model = require('./model');

const TestUtils = require('./test-utils');

mongoose.Promise = Promise;
describe('Base Service', () => {
  let condor, client, model1, child;
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
    child = {'name': 'Pablo'};
    const defaultModel1 = {'name': 'Juan Pablo', 'age': 33, 'married': false,
      'children': [child], 'child': child};
    const newModel = new Model(defaultModel1);
    newModel.save()
      .then((model) => {
        model1 = BaseService.getModelObject(model);
      })
      .then(done);
  });

  afterEach((done) => {
    if (mongoose.connection.readyState === 1) {
      return Model.remove({})
        .then(done);
    }
    TestUtils.initializeMongoose()
      .then(() => {
        return Model.remove({});
      })
      .then(done);
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
  });

  describe('sub document methods', () => {
    describe('pushChildren()', () => {
      let clientPushChildren, childToPush, expectedChildren;

      beforeEach(() => {
        clientPushChildren = Promise.promisify(client.pushChildren,
          {'context': client});
        childToPush = {'name': 'Juan'};
        expectedChildren = [
          jasmine.objectContaining(child),
          jasmine.objectContaining(childToPush),
        ];
      });

      it('should add a new sub-document', (done) => {
        clientPushChildren({'id': model1.id, 'children': childToPush})
          .then(() => {
            return Model.findOne({'_id': model1.id});
          })
          .then((model) => {
            const modelObject = CrudBaseService.getModelObject(model);
            expect(modelObject.children).toEqual(expectedChildren);
          })
          .then(done);
      });
    });

    describe('addToSet()', () => {
      let clientAddToSetChildren, childToAddToSet, expectedChildren;

      beforeEach(() => {
        clientAddToSetChildren = Promise.promisify(client.addToSetChildren,
          {'context': client});
        childToAddToSet = model1.children[0];
        expectedChildren = [
          jasmine.objectContaining(child),
        ];
      });

      it('should be the same sub-documents', (done) => {
        clientAddToSetChildren({'id': model1.id, 'children': childToAddToSet})
          .then(() => {
            return Model.findOne({'_id': model1.id});
          })
          .then((model) => {
            const modelObject = CrudBaseService.getModelObject(model);
            expect(modelObject.children).toEqual(expectedChildren);
          })
          .then(done);
      });
    });

    describe('remove()', () => {
      let clientRemoveChildren, childToRemove, expectedChildren;

      beforeEach(() => {
        clientRemoveChildren = Promise.promisify(client.removeChildren,
          {'context': client});
        childToRemove = model1.children[0];
        expectedChildren = [];
      });

      it('should remove the sub-documents', (done) => {
        clientRemoveChildren({'id': model1.id, 'children': childToRemove})
          .then(() => {
            return Model.findOne({'_id': model1.id});
          })
          .then((model) => {
            const modelObject = CrudBaseService.getModelObject(model);
            expect(modelObject.children).toEqual(expectedChildren);
          })
          .then(done);
      });
    });

    describe('replace()', () => {
      let clientReplaceChildren, childToReplace, expectedChildren;

      beforeEach(() => {
        clientReplaceChildren = Promise.promisify(client.replaceChildren,
          {'context': client});
        childToReplace = {'name': 'Juan'};
        expectedChildren = [
          jasmine.objectContaining(childToReplace),
        ];
      });

      it('should replace the sub-documents', (done) => {
        clientReplaceChildren({'id': model1.id, 'children': childToReplace})
          .then(() => {
            return Model.findOne({'_id': model1.id});
          })
          .then((model) => {
            const modelObject = CrudBaseService.getModelObject(model);
            expect(modelObject.children).toEqual(expectedChildren);
          })
          .then(done);
      });
    });
  });

  function initializeCondorServer() {
    condor = new Condor()
      .addService(protoPath, 'smartmate.SamplesService', new Service())
      .start();
  }

  function initializeCondorClient() {
    const coreProto = grpc.load(protoPath);
    client = new coreProto.smartmate
      .SamplesService('127.0.0.1:3000', grpc.credentials.createInsecure());
  }
});
