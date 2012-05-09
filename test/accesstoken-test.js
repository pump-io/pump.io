// accesstoken-test.js
//
// Test the accesstoken module
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
    AccessToken = require('../lib/model/accesstoken').AccessToken,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

// Need this to make IDs

URLMaker.hostname = "example.net";

// Dummy databank

var params = {schema: {}};

params.schema.accesstoken = AccessToken.schema;

DatabankObject.bank = Databank.get('memory', params);

var suite = vows.describe('access token interface');

var testSchema = {
    pkey: 'token',
    fields: ['token_secret',
             'consumer_key',
             'username',
             'created',
             'updated'],
    indices: ['username', 'consumer_key']
};

var testData = {
    'create': {
        consumer_key: "AAAAAAAAAAAAAAAAAAAAAA",
        callback: "http://example.com/callback"
    },
    'update': {
        username: "evan"
    }
};

suite.addBatch(modelBatch('accesstoken', 'AccessToken', testSchema, testData));

suite.addBatch({
    'When we create a new accesstoken': {
        topic: function() {
            var AccessToken = require('../lib/model/accesstoken').AccessToken;
            AccessToken.create({consumer_key: "AAAAAAAA",
                                callback: "http://example.com/callback"},
                          this.callback);
        },
        'token_secret is automatically created': function(err, accessToken) {
            assert.isString(accessToken.token_secret);
        }
    }
});

suite.export(module);
