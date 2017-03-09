/* eslint-disable max-lines */
const grpc = require('grpc');
const mongoose = require('mongoose');
const Promise = require('bluebird');
const Condor = require('condor-framework');
const proxyquire = require('proxyquire');
const _ = require('lodash');

const CrudBaseService = require('./crud-base-service');
const BaseService = require('./base-service');
const Model = require('./../spec/stubs/models/model/model');
const RelatedModel = require('./../spec/stubs/models/related-model/related-model');
const Service = require('./../spec/stubs/services/service');

const TestUtils = proxyquire('./test-utils', {'BaseService': BaseService});

mongoose.Promise = Promise;

describe('Base Service', () => {
  let condor, client, model1, relatedModel1, relatedModel2, child;
  const protoPath = './spec/stubs/proto/sample.proto';
  const invalidId = '5894e68edfe69eb5159c5665';
  const expectedError = jasmine.objectContaining({
    'code': grpc.status.NOT_FOUND,
    'message': 'Not found',
  });

  beforeAll((done) => {
    TestUtils.initializeMongoose()
      .then(() => {
        initializeCondorServer();
        initializeCondorClient();
      })
      .then(done);
  });

  beforeEach((done) => {
    child = {'name': 'Pablo'};
    const defaultRelatedModel1 = {'name': 'defaultRelatedModel1'};
    const newRelatedModel = new RelatedModel(defaultRelatedModel1);
    return newRelatedModel.save()
    .then((relatedModel) => {
      relatedModel1 = BaseService.getModelObject(relatedModel);
      const defaultRelatedModel2 = {'name': 'defaultRelatedModel2'};
      const newRelatedModel = new RelatedModel(defaultRelatedModel2);
      return newRelatedModel.save();
    }).then((relatedModel) => {
      relatedModel2 = BaseService.getModelObject(relatedModel);
      const defaultModel1 = {'name': 'Juan Pablo', 'age': 33, 'married': false,
        'children': [child], 'child': child, 'relatedModels': [relatedModel1.id]};
      const newModel = new Model(defaultModel1);
      return newModel.save();
    }).then((model) => {
      model1 = BaseService.getModelObject(model);
    }).then(done);
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
          new BaseService();
        }).toThrowError('mongoose is not connected');
      });
    });
  });

  describe('sub document methods', () => {
    describe('pushChildren()', () => {
      let clientPushChildren, expectedChildren;
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

    describe('addToSet()', () => {
      let clientAddToSetChildren, childrenToAddToSet, expectedChildren;

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

      it('should be add a sub-document', (done) => {
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
          /* eslint-disable no-console */
          console.warn = jasmine.createSpy('warn');
          invalidChild = _.clone(childToRemove);
          invalidChild.id = invalidId;
        });

        it('should return child not found error', (done) => {
          clientRemoveChildren({'id': model1.id, 'children': invalidChild})
            .then(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
              done();
            });
        });
      });
    });

    describe('update()', () => {
      let clientUpdateChildren, childToUpdate, expectedChildren;

      beforeEach(() => {
        /* eslint-disable no-console */
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
          /* eslint-disable no-console */
          console.warn = jasmine.createSpy('warn');
          invalidChild = _.clone(childToUpdate);
          invalidChild.id = invalidId;
        });

        it('should return child not found error', (done) => {
          clientUpdateChildren({'id': model1.id, 'children': invalidChild})
            .then(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
              done();
            });
        });
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

    describe('related model methods', () => {
      describe('pushRelatedModels()', () => {
        let clientPushRelatedModels, relatedModelToPush, expectedRelatedModels;

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
    });

    describe('related model methods', () => {
      describe('pushRelatedModels()', () => {
        let clientPushRelatedModels, relatedModelToPush, expectedRelatedModels;

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
        let clientAddToSetRelatedModels, relatedModelsToAddToSet, expectedRelatedModels;

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

      describe('removeRelatedModel()', () => {
        let clientRemoveRelatedModel, relatedModelToRemove, expectedRelatedModels;

        beforeEach(() => {
          delete relatedModel1.name;
          clientRemoveRelatedModel = Promise.promisify(client.removeRelatedModels,
            {'context': client});
          relatedModelToRemove = relatedModel1;
          expectedRelatedModels = [];
        });

        it('should remove the relatedModel', (done) => {
          clientRemoveRelatedModel({'id': model1.id, 'relatedModels': relatedModelToRemove})
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
            clientRemoveRelatedModel({'id': invalidId, 'relatedModels': relatedModelToRemove})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
          });
        });

        describe('with invalid relatedModel id', () => {
          let invalidRelatedModel;

          beforeEach(() => {
            /* eslint-disable no-console */
            console.warn = jasmine.createSpy('warn');
            invalidRelatedModel = _.clone(relatedModelToRemove);
            invalidRelatedModel.id = invalidId;
          });

          it('should return related model not found error', (done) => {
            clientRemoveRelatedModel({'id': model1.id, 'relatedModels': invalidRelatedModel})
              .then(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
                done();
              });
          });
        });
      });

      describe('replaceRelatedModel()', () => {
        let clientReplaceRelatedModel, relatedModelToReplace, expectedRelatedModels;

        beforeEach(() => {
          delete relatedModel2.name;
          clientReplaceRelatedModel = Promise.promisify(client.replaceRelatedModels,
            {'context': client});
          relatedModelToReplace = relatedModel2;
          expectedRelatedModels = [relatedModel2];
        });

        it('should replace the relatedModel', (done) => {
          clientReplaceRelatedModel({'id': model1.id, 'relatedModels': relatedModelToReplace})
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
            clientReplaceRelatedModel({'id': invalidId, 'relatedModels': relatedModelToReplace})
              .catch((error) => {
                expect(error).toEqual(expectedError);
                done();
              });
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
});
