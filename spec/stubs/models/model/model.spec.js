const mongoose = require('mongoose');
const Model = require('./model');

describe('Model', () => {
  it('should return a mongoose model', () => {
    expect(Model).toEqual(mongoose.model('Model'));
  });
});
