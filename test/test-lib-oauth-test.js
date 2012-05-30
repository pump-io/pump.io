// test-lib-oauth-test.js
//
// Test the test libraries
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
    http = require('http'),
    vows = require('vows'),
    Step = require('step'),
    _ = require('underscore');

var suite = vows.describe('user REST API');

suite.addBatch({
    'When we load the module': {
        topic: function() {
            return require('./lib/oauth');
        },
        'it works': function(oauth) {
            assert.isObject(oauth);
        },
        'it has a requestToken() export': function(oauth) {
            assert.isTrue(_(oauth).has('requestToken'));
            assert.isFunction(oauth.requestToken);
        },
        'it has a newClient() export': function(oauth) {
            assert.isTrue(_(oauth).has('newClient'));
            assert.isFunction(oauth.newClient);
        },
        'it has a register() export': function(oauth) {
            assert.isTrue(_(oauth).has('register'));
            assert.isFunction(oauth.register);
        },
        'it has a newCredentials() export': function(oauth) {
            assert.isTrue(_(oauth).has('newCredentials'));
            assert.isFunction(oauth.newCredentials);
        },
        'it has a accessToken() export': function(oauth) {
            assert.isTrue(_(oauth).has('accessToken'));
            assert.isFunction(oauth.accessToken);
        },
        'it has a setupApp() export': function(oauth) {
            assert.isTrue(_(oauth).has('setupApp'));
            assert.isFunction(oauth.setupApp);
        }
    }
});

suite['export'](module);

