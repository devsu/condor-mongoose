const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = {
  'name': String,
  'age': Number,
  'married': Boolean,
  'relatedModels': [{'type': Schema.Types.ObjectId, 'ref': 'RelatedModel'}],
};

const SampleModel = mongoose.model('Sample', new mongoose.Schema(schema));

module.exports = SampleModel;
