// stream-test.js
//
// Test the stream module
//
// Copyright 2012, StatusNet Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var assert = require('assert'),
    vows = require('vows'),
    databank = require('databank'),
    URLMaker = require('../lib/urlmaker').URLMaker,
    modelBatch = require('./lib/model').modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe('stream interface');

// XXX: check other types

var testSchema = {
    pkey: "name",
    fields: [],
    indices: []
};

var testData = {
    create: {
        name: "evan-inbox"
    },
    update: {
        something: "value" // Not clear what we update here
    }
};

// XXX: hack hack hack
// modelBatch hard-codes ActivityObject-style

var mb = modelBatch('stream', 'Stream', testSchema, testData);

// This class has a weird schema format

mb['When we require the stream module']
  ['and we get its Stream class export']
  ['and we get its schema']
  ['topic'] = function(Stream) {
          return Stream.schema.stream || null;
      };

mb['When we require the stream module']
  ['and we get its Stream class export']
  ['and we create a stream instance']
  ['auto-generated fields are there'] = function(err, created) {
      // No auto-gen fields, so...
      assert.isTrue(true);
  };

suite.addBatch(mb);

suite.export(module);

