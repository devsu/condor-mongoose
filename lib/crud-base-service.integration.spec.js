const grpc = require('grpc');
const mongoose = require('mongoose');
const mockgoose = require('mockgoose');
const Promise = require('bluebird');
const Condor = require('condor-framework');
const _ = require('lodash');

const Service = require('../spec/stubs/sample-service');
const Model = require('../spec/stubs/sample-model');

mongoose.Promise = Promise;

describe('base service', () => {
  let condor, model1, model2, model3, modelNotStored, client, expectedError;
  const protoPath = './spec/stubs/sample.proto';

  beforeAll((done) => {
    initializeMongoose().then(() => {
      initializeCondorServer();
      initializeCondorClient();
      done();
    });
    expectedError = jasmine.objectContaining({
      'code': grpc.status.NOT_FOUND,
      'message': 'Not found',
    });
  });

  afterAll((done) => {
    condor.stop().then(() => {
      done();
    });
  });

  beforeEach((done) => {
    const defaultModel1 = {'name': 'Juan Pablo', 'age': 33, 'married': false};
    const defaultModel2 = {'name': 'Juan Diego', 'age': 33, 'married': true};
    const defaultModel3 = {'name': 'Jorge Eduardo', 'age': 29, 'married': true};

    modelNotStored = {'id': '5894e68edfe69eb5159c5665'};
    let newModel;
    newModel = new Model(defaultModel1);
    newModel.save()
      .then((model) => {
        model1 = getModelObject(model);
        newModel = new Model(defaultModel2);
        return newModel.save();
      }).then((model) => {
        model2 = getModelObject(model);
        newModel = new Model(defaultModel3);
        return newModel.save();
      }).then((model) => {
        model3 = getModelObject(model);
        done();
      });
  });

  afterEach((done) => {
    Model.remove({}).then(() => {
      done();
    });
  });

  describe('insert()', () => {
    let newModel;

    beforeEach(() => {
      newModel = {'name': 'Gaby', 'age': 23, 'married': false};
    });

    it('should add a new document in the database', (done) => {
      Model.count({}).then((initialCount) => {
        expect(initialCount).toEqual(3);
        client.insert(newModel, () => {
          Model.count({}).then((count) => {
            expect(count).toEqual(4);
            done();
          });
        });
      });
    });

    it('should return a registry with the id', (done) => {
      client.insert(newModel, (error, response) => {
        expect(response.id.length).not.toEqual(0);
        expect(response).toEqual(jasmine.objectContaining(newModel));
        done();
      });
    });
  });

  describe('delete()', () => {
    let modelToDelete;

    beforeEach(() => {
      modelToDelete = model1;
    });

    it('should delete a document in the database', (done) => {
      Model.count({})
        .then((initialCount) => {
          expect(initialCount).toEqual(3);
          client.delete(modelToDelete.id, () => {
            Model.count({})
              .then((count) => {
                expect(count).toEqual(2);
                done();
              });
          });
        });
    });

    xdescribe('registry not found', () => {
      it('should return model not found error', (done) => {
        client.delete(modelNotStored.id, (error, response) => {
          expect(error).toEqual(expectedError);
          expect(response).toBeUndefined();
          done();
        });
      });
    });

    describe('when deletion fails', () => {
      it('should throw an error', () => {
        expect(() => {
          client.delete({});
        }).toThrowError();
      });
    });
  });

  describe('update()', () => {
    let modelUpdate, modelToUpdate, modelExpected;
    beforeEach(() => {
      /* eslint-disable no-console */
      console.warn = jasmine.createSpy('warn');
      modelToUpdate = model1;
      modelUpdate = {
        'id': modelToUpdate.id,
        'fields': ['name', 'invalidField', 'anotherInvalidField'],
        'data': modelToUpdate,
      };
      modelExpected = _.clone(model1);
      modelExpected.name = 'updatedModel';
    });

    it('should update the document in the database', (done) => {
      modelToUpdate.name = 'updatedModel';
      client.update(modelUpdate, (error, updatedModel) => {
        expect(updatedModel).toEqual(modelExpected);
        expect(console.warn).toHaveBeenCalledTimes(2);
        done();
      });
    });

    xdescribe('registry not found', () => {
      it('should return model not found error', (done) => {
        client.update(modelNotStored.id, (error, response) => {
          expect(error).toEqual(expectedError);
          expect(response).toBeUndefined();
          done();
        });
      });
    });
  });

  describe('get()', () => {
    let modelToQuery;

    beforeEach(() => {
      modelToQuery = model1;
    });

    it('should get the queried document from the database', (done) => {
      client.get(modelToQuery.id, (error, response) => {
        expect(response).toEqual(modelToQuery);
        done();
      });
    });

    xdescribe('registry not found', () => {
      it('should return model not found error', (done) => {
        client.get(modelNotStored.id, (error, response) => {
          expect(error).toEqual(expectedError);
          expect(response).toBeUndefined();
          done();
        });
      });
    });
  });

  describe('list()', () => {
    let expectedModels, queryRequest, emptyQueryRequest;
    beforeEach(() => {
      expectedModels = [model1];
      queryRequest = {};
      emptyQueryRequest = {};
    });

    describe('queryRequest empty', () => {
      beforeEach(() => {
        expectedModels = [model1, model2, model3];
      });

      it('should get all documents from the database', (done) => {
        client.list(emptyQueryRequest, (error, response) => {
          expect(getContentObj(response)).toEqual(expectedModels);
          expect(getContentObj(response).length).toEqual(3);
          done();
        });
      });
    });

    describe('queryRequest with limit defined', () => {
      beforeEach(() => {
        queryRequest.limit = 1;
      });

      it('should get documents with limit', (done) => {
        client.list(queryRequest, (error, response) => {
          expect(getContentObj(response)).toEqual(expectedModels);
          expect(getContentObj(response).length).toEqual(1);
          done();
        });
      });
    });

    describe('queryRequest with skip defined', () => {
      beforeEach(() => {
        expectedModels = [model2, model3];
        queryRequest.skip = 1;
      });

      it('should get documents with limit', (done) => {
        client.list(queryRequest, (error, response) => {
          expect(getContentObj(response)).toEqual(expectedModels);
          expect(getContentObj(response).length).toEqual(2);
          done();
        });
      });
    });

    describe('queryRequest with sort defined', () => {
      beforeEach(() => {
        expectedModels = [model2, model1, model3];
        queryRequest.sort = [{'field': 'age', 'value': -1}, {'field': 'name', 'value': 1}];
      });

      it('should get sorted documents', (done) => {
        client.list(queryRequest, (error, response) => {
          expect(getContentObj(response)).toEqual(expectedModels);
          expect(getContentObj(response).length).toEqual(3);
          done();
        });
      });
    });

    describe('queryRequest with fields defined', () => {
      beforeEach(() => {
        model1.age = 0;
        model2.age = 0;
        model3.age = 0;
        expectedModels = [model1, model2, model3];
        queryRequest.fields = ['name', 'married'];
      });

      it('should get documents with defined fields', (done) => {
        client.list(queryRequest, (error, response) => {
          expect(getContentObj(response)).toEqual(expectedModels);
          expect(getContentObj(response).length).toEqual(3);
          done();
        });
      });
    });

    describe('queryRequest with where filter defined', () => {
      beforeEach(() => {
        expectedModels = [model2];
      });

      describe('without matcher', () => {
        beforeEach(() => {
          queryRequest.where = [
            {'field': 'name', 'value': 'Juan Diego'},
          ];
        });

        it('should return the documents that match with the passed parameters', (done) => {
          client.list(queryRequest, (error, response) => {
            expect(getContentObj(response)).toEqual(expectedModels);
            expect(getContentObj(response).length).toEqual(1);
            done();
          });
        });
      });

      describe('with STRING matcher', () => {
        beforeEach(() => {
          queryRequest.where = [
           {'field': 'name', 'value': 'Juan Diego', 'matcher': 'STRING'},
          ];
        });

        it('should return the documents that match with the passed parameters', (done) => {
          client.list(queryRequest, (error, response) => {
            expect(getContentObj(response)).toEqual(expectedModels);
            expect(getContentObj(response).length).toEqual(1);
            done();
          });
        });
      });

      describe('with OBJECT matcher', () => {
        describe('type in', () => {
          beforeEach(() => {
            queryRequest.where = [
              {'field': 'name', 'value': '{ "$in": ["Juan Diego"] }', 'matcher': 'OBJECT'},
            ];
          });

          it('should return the documents that match with the passed parameters', (done) => {
            client.list(queryRequest, (error, response) => {
              expect(getContentObj(response)).toEqual(expectedModels);
              expect(getContentObj(response).length).toEqual(1);
              done();
            });
          });
        });

        describe('type between', () => {
          beforeEach(() => {
            queryRequest.where = [
              {'field': 'age', 'value': '{ "$gt": 30, "$lt":40 }', 'matcher': 'OBJECT'},
            ];
            expectedModels = [model1, model2];
          });

          it('should return the documents that match with the passed parameters', (done) => {
            client.list(queryRequest, (error, response) => {
              expect(getContentObj(response)).toEqual(expectedModels);
              expect(getContentObj(response).length).toEqual(2);
              done();
            });
          });
        });
      });

      describe('with REGEX matcher', () => {
        describe('without format', () => {
          beforeEach(() => {
            queryRequest.where = [
              {'field': 'name', 'value': 'Juan Diego', 'matcher': 'REGEX'},
            ];
          });

          it('should return the documents that match with the passed parameters', (done) => {
            client.list(queryRequest, (error, response) => {
              expect(getContentObj(response)).toEqual(expectedModels);
              expect(getContentObj(response).length).toEqual(1);
              done();
            });
          });
        });

        describe('with format /exp/', () => {
          beforeEach(() => {
            queryRequest.where = [
              {'field': 'name', 'value': '/Juan Diego/', 'matcher': 'REGEX'},
            ];
          });

          it('should return the documents that match with the passed parameters', (done) => {
            client.list(queryRequest, (error, response) => {
              expect(getContentObj(response)).toEqual(expectedModels);
              expect(getContentObj(response).length).toEqual(1);
              done();
            });
          });
        });

        describe('with format /exp/flag', () => {
          beforeEach(() => {
            queryRequest.where = [
              {'field': 'name', 'value': '/Juan Diego/ig', 'matcher': 'REGEX'},
            ];
          });

          it('should return the documents that match with the passed parameters', (done) => {
            client.list(queryRequest, (error, response) => {
              expect(getContentObj(response)).toEqual(expectedModels);
              expect(getContentObj(response).length).toEqual(1);
              done();
            });
          });
        });
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

  function initializeMongoose() {
    return mockgoose(mongoose).then(function() {
      return mongoose.connect('mongodb://localhost/smartmate-core');
    });
  }

  function getModelObject(model) {
    const object = model.toObject();
    object.id = object._id.toString();
    delete object.__v;
    delete object._id;
    return object;
  }

  function getContentObj(object) {
    return object[Object.keys(object)];
  }
});
