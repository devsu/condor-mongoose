const mongoose = require('mongoose');
const schema = require('./sample-schema.json');

const SampleModel = mongoose.model('Model', new mongoose.Schema(schema));

module.exports = SampleModel;
