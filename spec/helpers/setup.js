console.log('Setting up bluebird promises globally'); // eslint-disable-line
console.log('Setting up mongoose.Promise'); // eslint-disable-line
global.Promise = require('bluebird');
const mongoose = require('mongoose');
mongoose.Promise = Promise;
