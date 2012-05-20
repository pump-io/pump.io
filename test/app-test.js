// app-test.js
//
// Test the app module
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
    Step = require('step'),
    schema = require('../lib/schema'),
    URLMaker = require('../lib/urlmaker').URLMaker,
    randomString = require('../lib/randomstring').randomString,
    Client = require('../lib/model/client').Client,
    RequestToken = require('../lib/model/requesttoken').RequestToken,
    AccessToken = require('../lib/model/accesstoken').AccessToken,
    User = require('../lib/model/user').User,
    methodContext = require('./lib/methods').methodContext,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var ignore = function(err) {};

vows.describe('app module interface').addBatch({

    'When we get the app module': {

        topic: function() { 
            return require('../lib/app');
        },
        'there is one': function(mod) {
            assert.isObject(mod);
        },
        'it has the makeApp() export': function(mod) {
            assert.isFunction(mod.makeApp);
        }
    }
});