/* eslint-disable max-lines */
const grpc = require('grpc');
const Condor = require('condor-framework');
const _ = require('lodash');

const CrudBaseService = require('./crud-base-service');
const AlternativeService = require('./../spec/stubs/services/alternativeService');
const Service = require('../spec/stubs/services/service');
const AlternativeModel = require('./../spec/stubs/models/model/alternativeModel');
const Model = require('../spec/stubs/models/model/model');
const RelatedModel = require('../spec/stubs/models/related-model/related-model');
const TestUtils = require('./test-utils');

describe('Crud Base Service', () => {
  let condor, model1, model2, model3, relatedModel1, relatedModel2, relatedModel3, client,
    alternativeClient;

  const invalidId = '5894e68edfe69eb5159c5665';
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

  afterEach((done) => {
    Promise.all([
      Model.remove({}),
      AlternativeModel.remove({}),
      RelatedModel.remove({}),
    ]).then(done);
  });

  afterAll((done) => {
    condor.stop()
      .then(() => {
        return TestUtils.disconnectMongoose();
      })
      .then(done);
  });

  describe('Basic CRUD', () => {
    beforeEach((done) => {
      let newModel, newRelatedModel, mongooseModel1, mongooseModel2;

      const defaultModel1 = {'name': 'Juan Pablo', 'age': 33, 'married': false,
        'children': [], 'subDoc': defaultChild, 'tags': ['tag1', 'tag2']};
      const defaultModel2 = {'name': 'Juan Diego', 'age': 33, 'married': true,
        'children': [], 'subDoc': defaultChild, 'tags': ['tag1', 'tag2']};
      const defaultModel3 = {'name': 'Jorge Eduardo', 'age': 29, 'married': true,
        'children': [], 'subDoc': defaultChild, 'tags': ['tag1', 'tag2']};

      const defaultRelatedModel1 = {'name': 'related1'};
      const defaultRelatedModel2 = {'name': 'related2'};
      const defaultRelatedModel3 = {'name': 'related3'};

      newModel = new Model(defaultModel1);
      newModel.save().then((model) => {
        mongooseModel1 = model;
        model1 = CrudBaseService.getModelObject(model);
        newModel = new Model(defaultModel2);
        return newModel.save();
      }).then((model) => {
        mongooseModel2 = model;
        model2 = CrudBaseService.getModelObject(model);
        newModel = new Model(defaultModel3);
        return newModel.save();
      }).then((model) => {
        model3 = CrudBaseService.getModelObject(model);
        defaultRelatedModel1.model = model1.id;
        newRelatedModel = new RelatedModel(defaultRelatedModel1);
        return newRelatedModel.save();
      }).then((relatedModel) => {
        relatedModel1 = CrudBaseService.getModelObject(relatedModel);
        mongooseModel1.relatedModels = [relatedModel1.id];
        return mongooseModel1.save();
      }).then((model) => {
        mongooseModel1 = model;
        defaultRelatedModel2.model = model1.id;
        newRelatedModel = new RelatedModel(defaultRelatedModel2);
        return newRelatedModel.save();
      }).then((relatedModel) => {
        relatedModel2 = CrudBaseService.getModelObject(relatedModel);
        return mongooseModel1.save();
      }).then((model) => {
        model1 = CrudBaseService.getModelObject(model);
        defaultRelatedModel3.model = model2.id;
        newRelatedModel = new RelatedModel(defaultRelatedModel3);
        return newRelatedModel.save();
      }).then((relatedModel) => {
        relatedModel3 = CrudBaseService.getModelObject(relatedModel);
        mongooseModel2.relatedModels = [relatedModel2.id, relatedModel3.id];
        return mongooseModel2.save();
      }).then((model) => {
        model2 = CrudBaseService.getModelObject(model);
      }).then(done);
    });

    describe('insert()', () => {
      let newModel, expectedModel, clientInsert;

      beforeEach(() => {
        newModel = {'name': 'Gaby', 'age': 23, 'married': false,
          'children': [], 'subDoc': defaultChild, 'tags': ['tag1', 'tag2']};
        expectedModel = _.clone(newModel);
        expectedModel.subDoc = jasmine.objectContaining(defaultChild);
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
          queryRequest.fields = ['name', 'married', 'subDoc', 'tags', 'roleId', 'relatedModels'];
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
  });

  describe('Extended Methods', () => {
    let child, expectedChildren;

    beforeEach((done) => {
      new CrudBaseService(Model); // eslint-disable-line
      child = {'name': 'Pablo'};
      const defaultRelatedModel1 = {'name': 'defaultRelatedModel1'};
      const newRelatedModel = new RelatedModel(defaultRelatedModel1);

      return newRelatedModel.save().then((relatedModel) => {
        relatedModel1 = CrudBaseService.getModelObject(relatedModel);
        const defaultRelatedModel2 = {'name': 'defaultRelatedModel2'};
        const newRelatedModel = new RelatedModel(defaultRelatedModel2);
        return newRelatedModel.save();
      }).then((relatedModel) => {
        relatedModel2 = CrudBaseService.getModelObject(relatedModel);
        const defaultModel1 = {'name': 'Juan Pablo', 'age': 33, 'married': false,
          'children': [child], 'subDoc': child, 'relatedModels': [relatedModel1.id]};
        const newModel = new Model(defaultModel1);
        return newModel.save();
      }).then((model) => {
        model1 = CrudBaseService.getModelObject(model);
      }).then(done);
    });

    describe('sub document methods', () => {
      describe('addChild()', () => {
        let clientAddChild;
        const childToPush = {'name': 'Juan'};

        beforeEach(() => {
          clientAddChild = Promise.promisify(client.addChild, {'context': client});
          expectedChildren = [
            jasmine.objectContaining(child),
            jasmine.objectContaining(childToPush),
          ];
        });

        it('should add a new sub-document', (done) => {
          clientAddChild({'id': model1.id, 'child': {'name': 'Juan'}})
            .then(() => Model.findOne({'_id': model1.id}))
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.children).toEqual(expectedChildren);
              done();
            })
            .catch(done.fail);
        });

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientAddChild({'id': invalidId, 'child': {'name': 'Juan'}})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });
      });

      describe('removeChild()', () => {
        let clientRemoveChild, childToRemove;

        beforeEach(() => {
          clientRemoveChild = Promise.promisify(client.removeChild, {'context': client});
          childToRemove = model1.children[0];
          expectedChildren = [];
        });

        it('should remove the sub-documents', (done) => {
          clientRemoveChild({'id': model1.id, 'child': childToRemove})
            .then(() => Model.findOne({'_id': model1.id}))
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.children).toEqual(expectedChildren);
              done();
            }).catch(done.fail);
        });

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientRemoveChild({'id': invalidId, 'child': childToRemove})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });

        describe('with invalid child id', () => {
          let invalidChild;

          beforeEach(() => {
            console.warn = jasmine.createSpy('warn');
            invalidChild = _.clone(childToRemove);
            invalidChild.id = invalidId;
          });

          it('should log child not found warning', (done) => {
            clientRemoveChild({'id': model1.id, 'child': invalidChild}).then(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
              done();
            });
          });
        });
      });

      describe('pushChildren()', () => {
        let clientPushChildren;
        const childToPush = {'name': 'Juan'};

        beforeEach(() => {
          clientPushChildren = Promise.promisify(client.pushChildren,
            {'context': client});
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

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientPushChildren({'id': invalidId, 'children': childToPush})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });
      });

      describe('addToSetChildren()', () => {
        let clientAddToSetChildren, childrenToAddToSet;

        beforeEach(() => {
          clientAddToSetChildren = Promise.promisify(client.addToSetChildren,
            {'context': client});
          const defaultChild = model1.children[0];
          const childToBeAdded = {'name': 'Juan'};
          childrenToAddToSet = [
            defaultChild,
            childToBeAdded,
          ];
          expectedChildren = [
            defaultChild,
            jasmine.objectContaining(childToBeAdded),
          ];
        });

        it('should add a sub-document', (done) => {
          clientAddToSetChildren({'id': model1.id, 'children': childrenToAddToSet})
            .then(() => {
              return Model.findOne({'_id': model1.id});
            })
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.children).toEqual(expectedChildren);
            })
            .then(done);
        });

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientAddToSetChildren({'id': invalidId, 'children': childrenToAddToSet})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });
      });

      describe('removeChildren()', () => {
        let clientRemoveChildren, childToRemove;

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

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientRemoveChildren({'id': invalidId, 'children': childToRemove})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });

        describe('with invalid child id', () => {
          let invalidChild;

          beforeEach(() => {
            console.warn = jasmine.createSpy('warn');
            invalidChild = _.clone(childToRemove);
            invalidChild.id = invalidId;
          });

          it('should log child not found warning', (done) => {
            clientRemoveChildren({'id': model1.id, 'children': invalidChild})
              .then(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
                done();
              });
          });
        });
      });

      describe('updateChildren()', () => {
        let clientUpdateChildren, childToUpdate;

        beforeEach(() => {
          console.warn = jasmine.createSpy('warn');
          clientUpdateChildren = Promise.promisify(client.updateChildren,
            {'context': client});
          childToUpdate = _.clone(model1.children[0]);
          childToUpdate.name = 'updatedName';
          expectedChildren = [
            childToUpdate,
          ];
        });

        it('should update the sub-document', (done) => {
          clientUpdateChildren({'id': model1.id, 'children': childToUpdate})
            .then(() => {
              return Model.findOne({'_id': model1.id});
            })
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.children).toEqual(expectedChildren);
            })
            .then(done);
        });

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientUpdateChildren({'id': invalidId, 'children': childToUpdate})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });

        describe('with invalid child id', () => {
          let invalidChild;

          beforeEach(() => {
            console.warn = jasmine.createSpy('warn');
            invalidChild = _.clone(childToUpdate);
            invalidChild.id = invalidId;
          });

          it('should log child not found warning', (done) => {
            clientUpdateChildren({'id': model1.id, 'children': invalidChild})
              .then(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
                done();
              });
          });
        });
      });

      describe('replaceChildren()', () => {
        let clientReplaceChildren, childToReplace;

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

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientReplaceChildren({'id': invalidId, 'children': childToReplace})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });
      });
    });

    describe('related model methods', () => {
      let expectedRelatedModels;

      describe('addRelatedModel()', () => {
        let clientAddRelatedModel, relatedModelToAdd;

        beforeEach(() => {
          relatedModelToAdd = relatedModel2;
          clientAddRelatedModel = Promise.promisify(client.addRelatedModel, {'context': client});
          expectedRelatedModels = [
            jasmine.objectContaining({'id': relatedModel1.id}),
            jasmine.objectContaining({'id': relatedModelToAdd.id}),
          ];
        });

        it('should add a new relatedModel', (done) => {
          clientAddRelatedModel({'id': model1.id, 'relatedModelId': relatedModelToAdd.id})
            .then(() => Model.findOne({'_id': model1.id}))
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.relatedModels).toEqual(expectedRelatedModels);
              done();
            })
            .catch(done.fail);
        });

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientAddRelatedModel({'id': invalidId, 'relatedModelId': relatedModelToAdd.id})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });
      });

      describe('removeRelatedModel()', () => {
        let clientRemoveRelatedModel, relatedModelToRemove;

        beforeEach(() => {
          delete relatedModel1.name;
          clientRemoveRelatedModel = Promise.promisify(client.removeRelatedModel,
            {'context': client});
          relatedModelToRemove = relatedModel1.id;
          expectedRelatedModels = [];
        });

        it('should remove the relatedModel', (done) => {
          clientRemoveRelatedModel({'id': model1.id, 'relatedModelId': relatedModelToRemove})
            .then(() => Model.findOne({'_id': model1.id}))
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.relatedModels).toEqual(expectedRelatedModels);
              done();
            });
        });

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientRemoveRelatedModel({'id': invalidId, 'relatedModelId': relatedModelToRemove})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });

        describe('with invalid relatedModel id', () => {
          beforeEach(() => {
            console.warn = jasmine.createSpy('warn');
          });

          it('should log related model not found warning', (done) => {
            clientRemoveRelatedModel({'id': model1.id, 'relatedModelId': invalidId})
              .then(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
                done();
              })
              .catch(done.fail);
          });
        });
      });

      describe('pushRelatedModels()', () => {
        let clientPushRelatedModels, relatedModelToPush;

        beforeEach(() => {
          relatedModelToPush = relatedModel2;
          clientPushRelatedModels = Promise.promisify(client.pushRelatedModels,
            {'context': client});
          delete relatedModel1.name;
          delete relatedModelToPush.name;
          expectedRelatedModels = [
            jasmine.objectContaining(relatedModel1),
            jasmine.objectContaining(relatedModelToPush),
          ];
        });

        it('should add a new relatedModel', (done) => {
          clientPushRelatedModels({'id': model1.id, 'relatedModels': relatedModelToPush})
            .then(() => {
              return Model.findOne({'_id': model1.id});
            })
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.relatedModels).toEqual(expectedRelatedModels);
            })
            .then(done);
        });

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientPushRelatedModels({'id': invalidId, 'relatedModels': relatedModelToPush})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });
      });

      describe('addToSetRelatedModels()', () => {
        let clientAddToSetRelatedModels, relatedModelsToAddToSet;

        beforeEach(() => {
          delete relatedModel1.name;
          delete relatedModel2.name;
          relatedModelsToAddToSet = [relatedModel1, relatedModel2];
          clientAddToSetRelatedModels = Promise.promisify(client.addToSetRelatedModels,
            {'context': client});
          expectedRelatedModels = [
            jasmine.objectContaining(relatedModel1),
            jasmine.objectContaining(relatedModel2),
          ];
        });

        it('should add a relatedModel', (done) => {
          clientAddToSetRelatedModels({'id': model1.id, 'relatedModels': relatedModelsToAddToSet})
            .then(() => {
              return Model.findOne({'_id': model1.id});
            })
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.relatedModels).toEqual(expectedRelatedModels);
            })
            .then(done);
        });

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientAddToSetRelatedModels({'id': invalidId, 'relatedModels': relatedModelsToAddToSet})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });
      });

      describe('removeRelatedModels()', () => {
        let clientRemoveRelatedModels, relatedModelToRemove;

        beforeEach(() => {
          delete relatedModel1.name;
          clientRemoveRelatedModels = Promise.promisify(client.removeRelatedModels,
            {'context': client});
          relatedModelToRemove = relatedModel1;
          expectedRelatedModels = [];
        });

        it('should remove the relatedModel', (done) => {
          clientRemoveRelatedModels({'id': model1.id, 'relatedModels': relatedModelToRemove})
            .then(() => {
              return Model.findOne({'_id': model1.id});
            })
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.relatedModels).toEqual(expectedRelatedModels);
            })
            .then(done);
        });

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientRemoveRelatedModels({'id': invalidId, 'relatedModels': relatedModelToRemove})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });

        describe('with invalid relatedModel id', () => {
          let invalidRelatedModel;

          beforeEach(() => {
            console.warn = jasmine.createSpy('warn');
            invalidRelatedModel = _.clone(relatedModelToRemove);
            invalidRelatedModel.id = invalidId;
          });

          it('should log related model not found warning', (done) => {
            clientRemoveRelatedModels({'id': model1.id, 'relatedModels': invalidRelatedModel})
              .then(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
                done();
              });
          });
        });
      });

      describe('replaceRelatedModel()', () => {
        let clientReplaceRelatedModels, relatedModelToReplace;

        beforeEach(() => {
          delete relatedModel2.name;
          clientReplaceRelatedModels = Promise.promisify(client.replaceRelatedModels,
            {'context': client});
          relatedModelToReplace = relatedModel2;
          expectedRelatedModels = [relatedModel2];
        });

        it('should replace the relatedModel', (done) => {
          clientReplaceRelatedModels({'id': model1.id, 'relatedModels': relatedModelToReplace})
            .then(() => {
              return Model.findOne({'_id': model1.id});
            })
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.relatedModels).toEqual(expectedRelatedModels);
            })
            .then(done);
        });

        describe('with invalid model id', () => {
          it('should return model not found error', (done) => {
            clientReplaceRelatedModels({'id': invalidId, 'relatedModels': relatedModelToReplace})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });
      });
    });

    describe('with alternative service', () => {
      let alternativeModel;

      beforeEach((done) => {
        new CrudBaseService(AlternativeModel); // eslint-disable-line
        child = {'name': 'Pablo'};
        const defaultModel1 = {'name': 'Juan Pablo', 'age': 33, 'married': false,
          'child': [child], 'relatedModel': [relatedModel1.id]};
        const newModel = new AlternativeModel(defaultModel1);
        newModel.save().then((model) => {
          alternativeModel = CrudBaseService.getModelObject(model);
        }).then(done);
      });

      describe('should add sub document methods', () => {
        let addChild, removeChild, subdocument, pushChildren, addToSetChildren, removeChildren,
          replaceChildren, updateChildren;

        beforeEach(() => {
          subdocument = {'name': 'Juan'};
          addChild = Promise.promisify(alternativeClient.addChild, {'context': alternativeClient});
          removeChild = Promise.promisify(alternativeClient.removeChild,
            {'context': alternativeClient});
          pushChildren = Promise.promisify(alternativeClient.pushChildren,
            {'context': alternativeClient});
          addToSetChildren = Promise.promisify(alternativeClient.addToSetChildren,
            {'context': alternativeClient});
          removeChildren = Promise.promisify(alternativeClient.removeChildren,
            {'context': alternativeClient});
          updateChildren = Promise.promisify(alternativeClient.updateChildren,
            {'context': alternativeClient});
          replaceChildren = Promise.promisify(alternativeClient.replaceChildren,
            {'context': alternativeClient});
          expectedChildren = [jasmine.objectContaining(child)];
        });

        it('should add and remove the models', (done) => {
          addChild({'id': alternativeModel.id, 'child': subdocument})
            .then(() => {
              return AlternativeModel.findOne({'_id': alternativeModel.id});
            })
            .then((model) => {
              const childToRemove = CrudBaseService.getModelObject(model).child[1];
              return removeChild({'id': alternativeModel.id, 'child': childToRemove});
            })
            .then(() => {
              return AlternativeModel.findOne({'_id': alternativeModel.id});
            })
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.child).toEqual(expectedChildren);
              done();
            }).catch(done.fail);
        });

        it('should have all methods', (done) => {
          pushChildren({'id': model1.id, 'children': subdocument})
            .then(() => removeChildren({'id': model1.id, 'children': subdocument}))
            .then(() => addToSetChildren({'id': model1.id, 'children': subdocument}))
            .then(() => updateChildren({'id': model1.id, 'children': subdocument}))
            .then(() => replaceChildren({'id': model1.id, 'children': subdocument}))
            .then(done);
        });
      });

      describe('should add related model methods', () => {
        let addRelatedModel, removeRelatedModel, removeRelatedModels, pushRelatedModels,
          addToSetRelatedModels, replaceRelatedModel, relatedModel;

        beforeEach(() => {
          addRelatedModel = Promise.promisify(alternativeClient.addRelatedModel,
            {'context': alternativeClient});
          removeRelatedModel = Promise.promisify(alternativeClient.removeRelatedModel,
            {'context': alternativeClient});
          pushRelatedModels = Promise.promisify(alternativeClient.pushRelatedModels,
            {'context': alternativeClient});
          addToSetRelatedModels = Promise.promisify(alternativeClient.addToSetRelatedModels,
            {'context': alternativeClient});
          removeRelatedModels = Promise.promisify(alternativeClient.removeRelatedModels,
            {'context': alternativeClient});
          replaceRelatedModel = Promise.promisify(alternativeClient.replaceRelatedModels,
            {'context': alternativeClient});
          relatedModel = {'id': relatedModel1.id};
          expectedChildren = [jasmine.objectContaining(relatedModel)];
        });

        it('should add and remove the models', (done) => {
          addRelatedModel({'id': alternativeModel.id, 'relatedModelId': model1.id})
            .then(() => {
              return AlternativeModel.findOne({'_id': alternativeModel.id});
            })
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              return removeRelatedModel({
                'id': alternativeModel.id, 'relatedModelId': modelObject.relatedModel[1].id,
              });
            })
            .then(() => {
              return AlternativeModel.findOne({'_id': alternativeModel.id});
            })
            .then((model) => {
              const modelObject = CrudBaseService.getModelObject(model);
              expect(modelObject.relatedModel).toEqual(expectedChildren);
              done();
            }).catch(done.fail);
        });

        it('should have all methods', (done) => {
          pushRelatedModels({'id': model1.id, 'relatedModels': relatedModel})
            .then(() => removeRelatedModels({'id': model1.id, 'relatedModels': relatedModel}))
            .then(() => addToSetRelatedModels({'id': model1.id, 'relatedModels': relatedModel}))
            .then(() => replaceRelatedModel({'id': model1.id, 'relatedModels': relatedModel}))
            .then(done)
            .catch(done.fail);
        });
      });
    });
  });

  function initializeCondorServer() {
    condor = new Condor()
      .addService(protoPath, 'smartmate.SamplesService', new Service())
      .addService(protoPath, 'smartmate.AlternativeService', new AlternativeService())
      .start();
  }

  function initializeCondorClient() {
    const coreProto = grpc.load(protoPath);
    const creds = grpc.credentials.createInsecure();
    client = new coreProto.smartmate.SamplesService('127.0.0.1:3000', creds);
    alternativeClient = new coreProto.smartmate.AlternativeService('127.0.0.1:3000', creds);
  }

  function getContentObj(object) {
    return object[Object.keys(object)];
  }
});
