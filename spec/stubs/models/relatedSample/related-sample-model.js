const mongoose = require('mongoose');
const Promise = require('bluebird');
mongoose.Promise = Promise;

const schema = {
  'name': String,
  'sample': {'type': mongoose.Schema.Types.ObjectId, 'ref': 'Sample'},
};

const RelatedSampleModel = mongoose.model('RelatedModel', new mongoose.Schema(schema));

module.exports = RelatedSampleModel;
