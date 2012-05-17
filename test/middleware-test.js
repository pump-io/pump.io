// middleware-test.js
//
// Test the middleware module
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

vows.describe('middleware module interface').addBatch({
    'When we require the middleware module': {
        topic: function() { 
            return require('../lib/middleware');
        },
        'there is one': function(mw) {
            assert.isObject(mw);
        },
        'and we check its exports': methodContext(['reqUser',
                                                   'sameUser',
                                                   'maybeAuth',
                                                   'mustAuth',
                                                   'noUser',
                                                   'getCurrentUser',
                                                   'getSessionUser',
                                                   'checkCredentials'])
    }
}).export(module);

