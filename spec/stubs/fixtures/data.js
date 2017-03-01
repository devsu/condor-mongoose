const mongoose = require('mongoose');
const Promise = require('bluebird');

const defaultData = require('./data.json');
const Model = require('../models/sample/sample-model');
const RelatedModel = require('../models/relatedSample/related-sample-model');
const CrudBaseService = require('../../../lib/crud-base-service');

mongoose.Promise = Promise;

module.exports(init());

function init() {
  let newModel, newRelatedModel, data, mongooseModel1, mongooseModel2;

  newModel = new Model(defaultData.models.defaultModel1);
  newModel.save()
    .then((model) => {
      mongooseModel1 = model;
      data.models.model1 = CrudBaseService.getModelObject(model);
      newModel = new Model(defaultData.models.defaultModel2);
      return newModel.save();
    }).then((model) => {
      mongooseModel2 = model;
      data.models.model2 = CrudBaseService.getModelObject(model);
      newModel = new Model(defaultData.models.defaultModel3);
      return newModel.save();
    }).then((model) => {
      data.models.model3 = CrudBaseService.getModelObject(model);
      defaultData.relatedModels.defaultRelatedModel1.sample = data.model1.id;
      newRelatedModel = new RelatedModel(defaultData.relatedModels.defaultRelatedModel1);
      return newRelatedModel.save();
    }).then((relatedModel) => {
      data.relatedModels.relatedModel1 = CrudBaseService.getModelObject(relatedModel);
      return mongooseModel1.save();
    }).then((model) => {
      mongooseModel1 = model;
      defaultData.relatedModels.defaultRelatedModel2.sample = data.model1.id;
      newRelatedModel = new RelatedModel(defaultData.relatedModels.defaultRelatedModel2);
      return newRelatedModel.save();
    }).then((relatedModel) => {
      data.relatedModels.relatedModel2 = CrudBaseService.getModelObject(relatedModel);
      return mongooseModel1.save();
    }).then((model) => {
      data.relatedModels.model1 = CrudBaseService.getModelObject(model);
      defaultData.relatedModels.defaultRelatedModel3.sample = data.model2.id;
      newRelatedModel = new RelatedModel(defaultData.relatedModels.defaultRelatedModel3);
      return newRelatedModel.save();
    }).then((relatedModel) => {
      data.relatedModels.relatedModel3 = CrudBaseService.getModelObject(relatedModel);
      return mongooseModel2.save();
    }).then((model) => {
      data.relatedModels.model2 = CrudBaseService.getModelObject(model);
    });
}
