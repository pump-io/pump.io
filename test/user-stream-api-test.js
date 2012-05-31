// user-stream-api.js
//
// Test user streams
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
    querystring = require('querystring'),
    http = require('http'),
    OAuth = require('oauth').OAuth,
    Browser = require('zombie'),
    httputil = require('./lib/http'),
    oauthutil = require('./lib/oauth'),
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials;

var ignore = function(err) {};

var suite = vows.describe('User stream API test');

// A batch to test lots of parallel access token requests

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
        'and we get new credentials': {
            topic: function() {
                newCredentials("dora", "v4m0nos", this.callback);
            },
            'it works': function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.isString(cred.consumer_key);
                assert.isString(cred.consumer_secret);
                assert.isString(cred.token);
                assert.isString(cred.token_secret);
            },
            'and we check the feed endpoint': 
            httputil.endpoint('/api/user/dora/feed', ['GET', 'POST']),
            'and we check the inbox endpoint': 
            httputil.endpoint('/api/user/dora/inbox', ['GET', 'POST']),
            'and we get the feed of a new user': {
                topic: function(cred) {
                    httputil.getJSON('http://localhost:4815/api/user/dora/feed', cred, this.callback);
                },
                'it works': function(err, feed) {
                    assert.ifError(err);
                },
                'it has the right members': function(err, feed) {
                    assert.include(feed, 'author');
                    assert.include(feed.author, 'id');
                    assert.include(feed.author, 'displayName');
                    assert.include(feed.author, 'objectType');
                    assert.include(feed, 'totalCount');
                    assert.include(feed, 'items');
                    assert.include(feed, 'displayName');
                    assert.include(feed, 'id');
                    assert.include(feed, 'objectTypes');
                    assert.include(feed.objectTypes, 'activity');
                },
                'it is empty': function(err, feed) {
                    assert.equal(feed.totalCount, 0);
                    assert.isEmpty(feed.items);
                },
                'and we get the inbox of a new user': {
                    topic: function(cred) {
                        httputil.getJSON('http://localhost:4815/api/user/dora/inbox', cred, this.callback);
                    },
                    'it works': function(err, feed) {
                        assert.ifError(err);
                    },
                    'it has the right members': function(err, feed) {
                        assert.include(feed, 'author');
                        assert.include(feed.author, 'id');
                        assert.include(feed.author, 'displayName');
                        assert.include(feed.author, 'objectType');
                        assert.include(feed, 'totalCount');
                        assert.include(feed, 'items');
                        assert.include(feed, 'displayName');
                        assert.include(feed, 'id');
                        assert.include(feed, 'objectTypes');
                        assert.include(feed.objectTypes, 'activity');
                    },
                    'it is empty': function(err, feed) {
                        assert.equal(feed.totalCount, 0);
                        assert.isEmpty(feed.items);
                    }
                }
            }
        }
    }
});

suite['export'](module);