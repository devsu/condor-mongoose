const mongoose = require('mongoose');

const schema = {
  'name': String,
  'age': Number,
  'married': Boolean,
};

const ModelSchema = new mongoose.Schema(schema);

ModelSchema.virtual('relatedModels', {
  'ref': 'RelatedModel',
  'localField': '_id',
  'foreignField': 'sample',
});

const Model = mongoose.model('Sample', ModelSchema);

module.exports = Model;
