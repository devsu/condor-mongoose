/* eslint-disable max-lines */
const grpc = require('grpc');
const mongoose = require('mongoose');
const Promise = require('bluebird');
const Condor = require('condor-framework');
const _ = require('lodash');

const Service = require('./base-service');
const Model = require('./../spec/stubs/models/model/model');
const RelatedModel = require('../spec/stubs/models/related-model/related-model');
const TestUtils = require('./test-utils');

mongoose.Promise = Promise;

describe('Crud Base Service', () => {
  let condor, model1, model2, model3, relatedModel1, relatedModel2, relatedModel3, client;
  const defaultChild = {'name': 'uniqueChild'};
  const protoPath = './spec/stubs/proto/sample.proto';
  const modelNotStored = {'id': '5894e68edfe69eb5159c5665'};
  const expectedError = jasmine.objectContaining({
    'code': grpc.status.NOT_FOUND,
    'message': 'Not found',
  });

  beforeAll((done) => {
    TestUtils.initializeMongoose()
      .then(() => {
        initializeCondorServer();
        initializeCondorClient();
        done();
      });
  });

  beforeEach((done) => {
    let newModel, newRelatedModel, mongooseModel1, mongooseModel2;

    const defaultModel1 = {'name': 'Juan Pablo', 'age': 33, 'married': false,
      'children': [], 'child': defaultChild, 'tags': ['tag1', 'tag2']};
    const defaultModel2 = {'name': 'Juan Diego', 'age': 33, 'married': true,
      'children': [], 'child': defaultChild, 'tags': ['tag1', 'tag2']};
    const defaultModel3 = {'name': 'Jorge Eduardo', 'age': 29, 'married': true,
      'children': [], 'child': defaultChild, 'tags': ['tag1', 'tag2']};

    const defaultRelatedModel1 = {'name': 'related1'};
    const defaultRelatedModel2 = {'name': 'related2'};
    const defaultRelatedModel3 = {'name': 'related3'};

    newModel = new Model(defaultModel1);
    newModel.save()
      .then((model) => {
        mongooseModel1 = model;
        model1 = Service.getModelObject(model);
        newModel = new Model(defaultModel2);
        return newModel.save();
      }).then((model) => {
        mongooseModel2 = model;
        model2 = Service.getModelObject(model);
        newModel = new Model(defaultModel3);
        return newModel.save();
      }).then((model) => {
        model3 = Service.getModelObject(model);
        defaultRelatedModel1.model = model1.id;
        newRelatedModel = new RelatedModel(defaultRelatedModel1);
        return newRelatedModel.save();
      }).then((relatedModel) => {
        relatedModel1 = Service.getModelObject(relatedModel);
        mongooseModel1.relatedModels = [relatedModel1.id];
        return mongooseModel1.save();
      }).then((model) => {
        mongooseModel1 = model;
        defaultRelatedModel2.model = model1.id;
        newRelatedModel = new RelatedModel(defaultRelatedModel2);
        return newRelatedModel.save();
      }).then((relatedModel) => {
        relatedModel2 = Service.getModelObject(relatedModel);
        return mongooseModel1.save();
      }).then((model) => {
        model1 = Service.getModelObject(model);
        defaultRelatedModel3.model = model2.id;
        newRelatedModel = new RelatedModel(defaultRelatedModel3);
        return newRelatedModel.save();
      }).then((relatedModel) => {
        relatedModel3 = Service.getModelObject(relatedModel);
        mongooseModel2.relatedModels = [relatedModel2.id, relatedModel3.id];
        return mongooseModel2.save();
      }).then((model) => {
        model2 = Service.getModelObject(model);
      }).then(done);
  });

  afterEach((done) => {
    RelatedModel.remove({})
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

  describe('insert()', () => {
    let newModel, expectedModel, clientInsert;

    beforeEach(() => {
      newModel = {'name': 'Gaby', 'age': 23, 'married': false,
        'children': [], 'child': defaultChild, 'tags': ['tag1', 'tag2']};
      expectedModel = _.clone(newModel);
      expectedModel.child = jasmine.objectContaining(defaultChild);
      clientInsert = Promise.promisify(client.insert, {'context': client});
    });

    it('should add a new document in the database', (done) => {
      Model.count({})
        .then((initialCount) => {
          expect(initialCount).toEqual(3);
          return clientInsert(newModel);
        })
        .then(() => {
          return Model.count({});
        })
        .then((count) => {
          expect(count).toEqual(4);
        })
        .then(done);
    });

    it('should return a registry with the id', (done) => {
      clientInsert(newModel)
        .then((response) => {
          expect(response.id.length).not.toEqual(0);
          expect(response).toEqual(jasmine.objectContaining(expectedModel));
          done();
        });
    });
  });

  describe('delete()', () => {
    let modelToDelete, clientDelete;

    beforeEach(() => {
      modelToDelete = model1;
      clientDelete = Promise.promisify(client.delete, {'context': client});
    });

    it('should delete a document in the database', (done) => {
      Model.count({})
        .then((initialCount) => {
          expect(initialCount).toEqual(3);
          return clientDelete(modelToDelete.id);
        })
        .then(() => {
          return Model.count({});
        })
        .then((count) => {
          expect(count).toEqual(2);
        })
        .then(done);
    });

    describe('registry not found', () => {
      it('should return model not found error', (done) => {
        clientDelete(modelNotStored.id)
          .catch((error) => {
            expect(error).toEqual(expectedError);
            done();
          });
      });
    });

    describe('when deletion fails', () => {
      it('should throw an error', () => {
        clientDelete({}).catch((error) => {
          expect(error).toEqual(jasmine.any(Object));
        });
      });
    });
  });

  describe('update()', () => {
    let modelUpdate, modelToUpdate, modelExpected, clientUpdate;
    beforeEach(() => {
      console.warn = jasmine.createSpy('warn');

      modelExpected = _.clone(model1);
      modelExpected.name = 'updatedModel';
      modelExpected.virtualRelatedModels = [];
      modelExpected.relatedModels = [];
      modelExpected.relatedModels = [jasmine.objectContaining({'id': relatedModel1.id})];

      modelToUpdate = model1;
      modelUpdate = {
        'id': modelToUpdate.id,
        'fields': ['name', 'invalidField', 'anotherInvalidField'],
        'data': modelToUpdate,
      };
      clientUpdate = Promise.promisify(client.update, {'context': client});
    });

    it('should update the document in the database', (done) => {
      modelToUpdate.name = 'updatedModel';

      clientUpdate(modelUpdate)
        .then((updatedModel) => {
          expect(updatedModel).toEqual(modelExpected);
          expect(console.warn).toHaveBeenCalledTimes(2);
        })
        .then(done);
    });

    describe('registry not found', () => {
      it('should return model not found error', (done) => {
        clientUpdate(modelNotStored.id)
          .catch((error) => {
            expect(error).toEqual(expectedError);
            done();
          });
      });
    });
  });

  describe('get()', () => {
    let modelToQuery, clientGet;

    beforeEach(() => {
      model1.relatedModels.forEach((item, index, array) => {
        array.splice(index, 1, jasmine.objectContaining(item));
      });
      modelToQuery = model1;
      modelToQuery.virtualRelatedModels = [];
      clientGet = Promise.promisify(client.get, {'context': client});
    });

    it('should get the queried document from the database', (done) => {
      clientGet(modelToQuery.id)
        .then((response) => {
          expect(response).toEqual(jasmine.objectContaining(modelToQuery));
        })
        .then(done);
    });

    describe('getRequest with populate', () => {
      beforeEach(() => {
        modelToQuery.virtualRelatedModels = [relatedModel1, relatedModel2];
      });

      it('should get the queried document from the database with related model', (done) => {
        clientGet({'id': modelToQuery.id,
          'populate': ['virtualRelatedModels', 'invalidRelatedField']})
          .then((response) => {
            expect(response).toEqual(jasmine.objectContaining(modelToQuery));
          })
          .then(done);
      });
    });

    describe('registry not found', () => {
      it('should return model not found error', (done) => {
        clientGet(modelNotStored.id)
          .catch((error) => {
            expect(error).toEqual(expectedError);
            done();
          });
      });
    });
  });

  describe('list()', () => {
    let expectedModels, queryRequest, emptyQueryRequest, clientList;

    beforeEach(() => {
      model1.virtualRelatedModels = [];
      model1.relatedModels.forEach((item, index, array) => {
        array.splice(index, 1, jasmine.objectContaining(item));
      });
      model2.virtualRelatedModels = [];
      model2.relatedModels.forEach((item, index, array) => {
        array.splice(index, 1, jasmine.objectContaining(item));
      });
      model3.virtualRelatedModels = [];
      model3.relatedModels.forEach((item, index, array) => {
        array.splice(index, 1, jasmine.objectContaining(item));
      });
      expectedModels = [model1];
      queryRequest = {};
      emptyQueryRequest = {};
      clientList = Promise.promisify(client.list, {'context': client});
    });

    describe('queryRequest empty', () => {
      beforeEach(() => {
        expectedModels = [
          model1,
          model2,
          model3,
        ];
      });

      it('should get all documents from the database', (done) => {
        clientList(emptyQueryRequest)
          .then((response) => {
            expect(getContentObj(response)).toEqual(expectedModels);
            expect(getContentObj(response).length).toEqual(3);
          })
          .then(done);
      });
    });

    describe('queryRequest with populate defined', () => {
      beforeEach(() => {
        model1.virtualRelatedModels = [relatedModel1, relatedModel2];
        model2.virtualRelatedModels = [relatedModel3];
        model3.virtualRelatedModels = [];
        expectedModels = [model1, model2, model3];
        queryRequest.populate = ['virtualRelatedModels'];
      });

      it('should get documents with limit', (done) => {
        clientList(queryRequest).then((response) => {
          expect(getContentObj(response)).toEqual(expectedModels);
          expect(getContentObj(response).length).toEqual(3);
        })
          .then(done);
      });
    });

    describe('queryRequest with limit defined', () => {
      beforeEach(() => {
        queryRequest.limit = 1;
      });

      it('should get documents with limit', (done) => {
        clientList(queryRequest)
          .then((response) => {
            expect(getContentObj(response)).toEqual(expectedModels);
            expect(getContentObj(response).length).toEqual(1);
          })
          .then(done);
      });
    });

    describe('queryRequest with skip defined', () => {
      beforeEach(() => {
        expectedModels = [jasmine.objectContaining(model2), jasmine.objectContaining(model3)];
        queryRequest.skip = 1;
      });

      it('should get documents with limit', (done) => {
        clientList(queryRequest)
          .then((response) => {
            expect(getContentObj(response)).toEqual(expectedModels);
            expect(getContentObj(response).length).toEqual(2);
          })
          .then(done);
      });
    });

    describe('queryRequest with sort defined', () => {
      beforeEach(() => {
        expectedModels = [
          jasmine.objectContaining(model2),
          jasmine.objectContaining(model1),
          jasmine.objectContaining(model3),
        ];
        queryRequest.sort = [{'field': 'age', 'value': -1}, {'field': 'name', 'value': 1}];
      });

      it('should get sorted documents', (done) => {
        clientList(queryRequest)
          .then((response) => {
            expect(getContentObj(response)).toEqual(expectedModels);
            expect(getContentObj(response).length).toEqual(3);
          })
          .then(done);
      });
    });

    describe('queryRequest with fields defined', () => {
      beforeEach(() => {
        model1.age = 0;
        model2.age = 0;
        model3.age = 0;
        expectedModels = [
          jasmine.objectContaining(model1),
          jasmine.objectContaining(model2),
          jasmine.objectContaining(model3),
        ];
        queryRequest.fields = ['name', 'married', 'child', 'tags', 'roleId', 'relatedModels'];
      });

      it('should get documents with defined fields', (done) => {
        clientList(queryRequest)
          .then((response) => {
            expect(getContentObj(response)).toEqual(expectedModels);
            expect(getContentObj(response).length).toEqual(3);
          })
          .then(done);
      });
    });

    describe('queryRequest with where filter defined', () => {
      beforeEach(() => {
        expectedModels = [jasmine.objectContaining(model2)];
      });

      describe('without matcher', () => {
        beforeEach(() => {
          queryRequest.where = [
            {'field': 'name', 'value': 'Juan Diego'},
          ];
        });

        it('should return the documents that match with the passed parameters', (done) => {
          clientList(queryRequest)
            .then((response) => {
              expect(getContentObj(response)).toEqual(expectedModels);
              expect(getContentObj(response).length).toEqual(1);
            })
            .then(done);
        });
      });

      describe('with STRING matcher', () => {
        beforeEach(() => {
          queryRequest.where = [
           {'field': 'name', 'value': 'Juan Diego', 'matcher': 'STRING'},
          ];
        });

        it('should return the documents that match with the passed parameters', (done) => {
          clientList(queryRequest)
            .then((response) => {
              expect(getContentObj(response)).toEqual(expectedModels);
              expect(getContentObj(response).length).toEqual(1);
            })
            .then(done);
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
            clientList(queryRequest)
              .then((response) => {
                expect(getContentObj(response)).toEqual(expectedModels);
                expect(getContentObj(response).length).toEqual(1);
              })
              .then(done);
          });
        });

        describe('type between', () => {
          beforeEach(() => {
            queryRequest.where = [
              {'field': 'age', 'value': '{ "$gt": 30, "$lt":40 }', 'matcher': 'OBJECT'},
            ];
            expectedModels = [jasmine.objectContaining(model1), jasmine.objectContaining(model2)];
          });

          it('should return the documents that match with the passed parameters', (done) => {
            clientList(queryRequest)
              .then((response) => {
                expect(getContentObj(response)).toEqual(expectedModels);
                expect(getContentObj(response).length).toEqual(2);
              })
              .then(done);
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
            clientList(queryRequest)
              .then((response) => {
                expect(getContentObj(response)).toEqual(expectedModels);
                expect(getContentObj(response).length).toEqual(1);
              })
              .then(done);
          });
        });

        describe('with format /exp/', () => {
          beforeEach(() => {
            queryRequest.where = [
              {'field': 'name', 'value': '/Juan Diego/', 'matcher': 'REGEX'},
            ];
          });

          it('should return the documents that match with the passed parameters', (done) => {
            clientList(queryRequest)
              .then((response) => {
                expect(getContentObj(response)).toEqual(expectedModels);
                expect(getContentObj(response).length).toEqual(1);
              })
              .then(done);
          });
        });

        describe('with format /exp/flag', () => {
          beforeEach(() => {
            queryRequest.where = [
              {'field': 'name', 'value': '/Juan Diego/ig', 'matcher': 'REGEX'},
            ];
          });

          it('should return the documents that match with the passed parameters', (done) => {
            clientList(queryRequest)
              .then((response) => {
                expect(getContentObj(response)).toEqual(expectedModels);
                expect(getContentObj(response).length).toEqual(1);
              })
              .then(done);
          });
        });
      });
    });
  });

  function initializeCondorServer() {
    condor = new Condor()
      .addService(protoPath, 'smartmate.SamplesService', new Service(Model))
      .start();
  }

  function initializeCondorClient() {
    const coreProto = grpc.load(protoPath);
    client = new coreProto.smartmate
      .SamplesService('127.0.0.1:3000', grpc.credentials.createInsecure());
  }

  function getContentObj(object) {
    return object[Object.keys(object)];
  }
});
