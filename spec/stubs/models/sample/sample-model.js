const mongoose = require('mongoose');
const Promise = require('bluebird');
mongoose.Promise = Promise;

const schema = {
  'name': String,
  'age': Number,
  'married': Boolean,
};

const SampleModelSchema = new mongoose.Schema(schema);

SampleModelSchema.virtual('relatedModels', {
  'ref': 'RelatedModel',
  'localField': '_id',
  'foreignField': 'sample',
});

const SampleModel = mongoose.model('Sample', SampleModelSchema);

module.exports = SampleModel;
