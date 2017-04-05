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
  'subDoc': ChildSchema,
  'tags': [String],
  'relatedModels': [{'type': mongoose.Schema.Types.ObjectId, 'ref': 'RelatedModel'}],
  'relatedModel': {'type': mongoose.Schema.Types.ObjectId, 'ref': 'RelatedModel'},
};
const ParentSchema = new mongoose.Schema(parentSchema);

ParentSchema.virtual('virtualRelatedModels', {
  'ref': 'RelatedModel',
  'localField': '_id',
  'foreignField': 'model',
});

const Model = mongoose.model('Model', ParentSchema);

module.exports = Model;
