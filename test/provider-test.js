// provider-test.js
//
// Test the provider module
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
    methodContext = require('./lib/methods').methodContext;

vows.describe('provider module interface').addBatch({
    'When we get the provider module': {
        topic: function() { 
            return require('../lib/provider');
        },
        'there is one': function(mod) {
            assert.isObject(mod);
        },
        'and we get its Provider export': {
            topic: function(mod) {
                return mod.Provider;
            },
            'it exists': function(Provider) {
                assert.isFunction(Provider);
            },
            'and we create a new Provider': {
                topic: function(Provider) {
                    return new Provider();
                },
                'it exists': function(provider) {
                    assert.isObject(provider);
                },
                'and we check its methods': methodContext(['previousRequestToken',
                                                           'tokenByConsumer',
                                                           'applicationByConsumerKey',
                                                           'fetchAuthorizationInformation',
                                                           'validToken',
                                                           'tokenByTokenAndVerifier',
                                                           'validateNotReplay',
                                                           'userIdByToken',
                                                           'authenticateUser',
                                                           'associateTokenToUser',
                                                           'generateRequestToken',
                                                           'generateAccessToken',
                                                           'cleanRequestTokens'])
           }
        }
    }
}).export(module);

