// client-test.js
//
// Test the client module
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

var suite = vows.describe('client module interface');

var testSchema = {
    pkey: 'consumer_key',
    fields: ['title',
             'description',
             'host',
             'secret',
             'contacts',
             'logo_url',
             'redirect_uris',
             'type',
             'created',
             'updated'],
    indices: ['title']
};

var testData = {
    'create': {
        title: "MyApp",
        description: "an app I made",
        host: "example.com",
        contacts: ["evan@example.com"],
        type: "web"
    },
    'update': {
        contacts: ["evan@example.com", "jerry@example.com"]
    }
};

var mb = modelBatch('client', 'Client', testSchema, testData);

mb['When we require the client module']
  ['and we get its Client class export']
  ['and we create a client instance']
  ['auto-generated fields are there'] = function(err, created) {
      assert.isString(created.consumer_key);
      assert.isString(created.secret);
      assert.isString(created.created);
      assert.isString(created.updated);
};

suite.addBatch(mb);

suite.export(module);
