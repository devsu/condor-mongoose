const mongoose = require('mongoose');

const childSchema = {
  'name': String,
};
const ChildSchema = new mongoose.Schema(childSchema);

const parentSchema = {
  'name': String,
  'age': Number,
  'married': Boolean,
  'child': [ChildSchema],
  'tags': [String],
  'relatedModel': [{'type': mongoose.Schema.Types.ObjectId, 'ref': 'RelatedModel'}],
};
const ParentSchema = new mongoose.Schema(parentSchema);
const Model = mongoose.model('AlternativeModel', ParentSchema);

module.exports = Model;
