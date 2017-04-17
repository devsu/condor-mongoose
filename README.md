# condor-mongoose
Utils to work with mongoose and condor GRPC framework

## How to use
1. Define the proto file.

```proto
syntax = "proto3";
package bussiness;

message Where {
  string field = 1;
  string value = 2;
  Matcher matcher = 3;
}
message Sort {
  string field = 1;
  int32 value = 2;
}

enum Matcher {
  STRING = 0;
  REGEX = 1;
  OBJECT = 2;
}

message QueryRequest {
  repeated Where where = 1;   // empty => all
  repeated string fields = 2; // empty => all
  int32 limit = 3;            // 0 => unlimited
  int32 skip = 4;             // 0 => none
  repeated Sort sort = 5;
}

message PersonUpdate {
  string id = 1;
  repeated string fields = 2;
  Person data = 3;
}

message Empty {}

message IdRequest {
  string id = 1;
}

message Person {
  string id = 1;
  string name = 2;
  int32 age = 3;
}

service PersonsService {
  rpc List (QueryRequest) returns (Person) {}
  rpc Insert (Person) returns (Person) {}
  rpc Update (PersonUpdate) returns (Person) {}
  rpc Get (IdRequest) returns (Person) {}
  rpc Delete (IdRequest) returns (Empty) {}
}
```
2. Create a service that extends from **CrudBaseService**.
 
```js
const CrudBaseService = require('condor-mongoose');
const mongoose = require('mongoose');

const personSchema = {
    'name': String,
    'age': Number,
};

const Person = mongoose.model('Person', new mongoose.Schema(personSchema));

module.exports = class extends CrudBaseService {
  constructor() {
    super(Person);
  }
};
```
**Note:** **CrudBaseService** contains **base** methods (insert, update, delete, get, list), 
**sub documents** methods (push, addToSet, remove, update and replace) and **related models** 
methods (push, addToSet, remove and replace).

3. Initialize the service.
```js
const mongoose = require('mongoose');
const Condor = require('condor-framework');
const Promise = require('bluebird');
const PersonService = require('./models/personService');

mongoose.Promise = Promise;
mongoose.connect('mongodb://localhost/business');

const protoPath = './bussiness.proto';
condor = new Condor()
  .addService(protoPath, 'business.PersonService', new PersonService())
  .start();
```

## Installation
```bash
npm install --save condor-mongoose
```

## License and Credits

MIT License. Copyright 2017 [Devsu LLC](https://devsu.com)
