const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = {
  'name': String,
  'age': Number,
  'married': Boolean,
  'roles': [{'type': Schema.Types.ObjectId, 'ref': 'Role'}],
};

const SampleModel = mongoose.model('User', new mongoose.Schema(schema));

module.exports = SampleModel;
