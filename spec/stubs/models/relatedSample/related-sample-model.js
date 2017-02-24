const mongoose = require('mongoose');

const schema = {
  'name': String,
  'sample': {'type': mongoose.Schema.Types.ObjectId, 'ref': 'Sample'},
};

const RelatedSampleModel = mongoose.model('RelatedModel', new mongoose.Schema(schema));

module.exports = RelatedSampleModel;
