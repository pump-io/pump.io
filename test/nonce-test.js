// nonce-test.js
//
// Test the nonce module
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

var suite = vows.describe('nonce module interface');

var testSchema = {
    pkey: 'token_nonce',
    fields: ['nonce',
             'access_token',
             'timestamp'],
    indices: ['access_token']
};

var testData = {
    'create': {
        access_token: "AAAAAAAAAAAAAAAAAAAAAAA",
        nonce: "BBBBBB"
    },
    'update': {
        timestamp: Date.now()
    }
};

var mb = modelBatch('nonce', 'Nonce', testSchema, testData);

mb['When we require the nonce module']
  ['and we get its Nonce class export']
  ['and we create a nonce instance']
  ['auto-generated fields are there'] = function(err, created) {
      assert.isString(created.token_nonce);
      assert.isNumber(created.timestamp);
};

mb['When we require the nonce module']
['and we get its Nonce class export']
['and we create a nonce instance']
['and we modify it']
['it is modified'] = function(err, updated) {
    assert.ifError(err);
};

suite.addBatch(mb);

suite.export(module);
