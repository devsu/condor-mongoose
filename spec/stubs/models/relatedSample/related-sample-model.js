const mongoose = require('mongoose');

const schema = {
  'name': String,
};

const RelatedSampleModel = mongoose.model('Role', new mongoose.Schema(schema));

module.exports = RelatedSampleModel;
