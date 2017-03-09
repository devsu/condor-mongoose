# condor-mongoose
Utils to work with mongoose and condor GRPC framework

## How to use
for each service you have to create a container folder, like
```
─ sample.proto      // proto
─ first-service     // folder
  └─ model.js
  └─ service.js
─ second-service    // folder
  └─ model.js
  └─ service.js
─ another-service   // folder
  └─ model.js
  └─ service.js
```

1. Define the proto file like **business.proto**

business.proto
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
2. Create the service that extends from **condor-mongoose** like **person-service.js**
```js
const CrudBaseService = require('condor-mongoose').CrudBaseService;
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

3. Initialize the service
```js
const mongoose = require('mongoose');
const Condor = require('condor-framework');
const Promise = require('bluebird');

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
