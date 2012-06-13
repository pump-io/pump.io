// list-api-test.js
//
// Test user collections of people
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
    Step = require('step'),
    _ = require('underscore'),
    OAuth = require('oauth').OAuth,
    httputil = require('./lib/http'),
    oauthutil = require('./lib/oauth'),
    actutil = require('./lib/activity'),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair;

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var assertValidList = function(doc, count) {
    assert.include(doc, 'author');
    assert.include(doc.author, 'id');
    assert.include(doc.author, 'displayName');
    assert.include(doc.author, 'objectType');
    assert.include(doc, 'totalItems');
    assert.include(doc, 'items');
    assert.include(doc, 'displayName');
    assert.include(doc, 'id');
    if (_(count).isNumber()) {
        assert.equal(doc.totalItems, count);
        assert.lengthOf(doc.items, count);
    }
};

var suite = vows.describe('list api test');

// A batch to test following/unfollowing users

suite.addBatch({
    'When we set up the app': {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        'it works': function(err, app) {
            assert.ifError(err);
        },
        'and we register a client': {
            topic: function() {
                newClient(this.callback);
            },
            'it works': function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            }
        },
        'and we get the list of lists owned by a new user': {
            topic: function() {
            },
            'it works': function(err, lists) {
            },
            'it is empty': function(err, lists) {
            }
        },
        'and a user creates a list': {
            topic: function() {
            },
            'it works': function(err, lists) {
            },
            'and we get the list of lists owned by the user': {
            }
        },
        'and a user creates a lot of lists': {
            topic: function() {
            },
            'it works': function(err, lists) {
            },
            'and we get the list of lists owned by the user': {
                topic: function() {
                },
                'it works': function(err, lists) {
                }
            }
        },
        'and a user deletes a list': {
            topic: function() {
            },
            'it works': function(err, lists) {
            },
            'and we get the list of lists owned by the user': {
                topic: function() {
                },
                'it works': function(err, lists) {
                }
            }
        },
        'and a user deletes a non-existent list': {
            topic: function() {
            },
            'it fails correctly': function(err, lists) {
            }
        },
        'and a user creates a list that already exists': {
            topic: function() {
            },
            'it fails correctly': function(err, lists) {
            }
        },
        'and a user adds another user to a created list': {
            'it works': function(err, lists) {
            },
            'and we get the collection of users in that list': {
                'it works': function(err, lists) {
                },
                'it includes that user': function(err, list, user) {
                },
                'and the user removes the other user from the list': {
                    'it works': function(err, lists) {
                    },
                }
            }
        },
        'and a user adds another user to an implicit list': {
            'it works': function(err, lists) {
            },
            'and we get the collection of users in that list': {
                'it works': function(err, lists) {
                },
                'it includes that user': function(err, list, user) {
                }
            }
        },
        'and a user adds an arbitrary person to a list': {
        },
        'and we get a non-existent list': {
        }
    }
});

suite['export'](module);

        
