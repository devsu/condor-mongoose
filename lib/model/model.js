const mongoose = require('mongoose');

const childSchema = {
  'name': String,
};
const ChildSchema = new mongoose.Schema(childSchema);

const parentSchema = {
  'name': String,
  'age': Number,
  'married': Boolean,
  'children': [ChildSchema],
  'child': ChildSchema,
  'tags': [String],
};
const ParentSchema = new mongoose.Schema(parentSchema);

ParentSchema.virtual('relatedModels', {
  'ref': 'RelatedModel',
  'localField': '_id',
  'foreignField': 'sample',
});

const Model = mongoose.model('Model', ParentSchema);

module.exports = Model;
