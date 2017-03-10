const mongoose = require('mongoose');

const schema = {
  'name': String,
  'model': {'type': mongoose.Schema.Types.ObjectId, 'ref': 'Model'},
};

const RelatedModel = mongoose.model('RelatedModel', new mongoose.Schema(schema));

module.exports = RelatedModel;
