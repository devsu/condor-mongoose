const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = {
  'name': String,
  'sampleId': {'type': Schema.Types.ObjectId, 'ref': 'Sample'},
};

const RelatedSampleModel = mongoose.model('RelatedModel', new mongoose.Schema(schema));

module.exports = RelatedSampleModel;
