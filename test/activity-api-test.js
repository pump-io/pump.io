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
    urlparse = require('url').parse,
    httputil = require('./lib/http'),
    oauthutil = require('./lib/oauth'),
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken,
    newCredentials = oauthutil.newCredentials;

var ignore = function(err) {};

var suite = vows.describe('Activity API test');

// A batch for testing the read access to the API

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
                newCredentials("gerold", "justaguy", this.callback);
            },
            'it works': function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.isString(cred.consumer_key);
                assert.isString(cred.consumer_secret);
                assert.isString(cred.token);
                assert.isString(cred.token_secret);
            },
            'and we post a new activity': {
                topic: function(cred) {
                    var cb = this.callback,
                        act = {
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/gerold/feed", cred, act, function(err, act, response) {
                        cb(err, act);
                    });
                },
                'it works': function(err, act) {
                    assert.ifError(err);
                    assert.isObject(act);
                },
                'and we check the options on the JSON url': {
                    topic: function(act, cred) {
                        var parts = urlparse(act.id);
                        httputil.options('localhost', 4815, parts.path, this.callback);
                    },
                    'it exists': function(err, allow, res, body) {
                        assert.ifError(err);
                        assert.equal(res.statusCode, 200);
                    },
                    'it allows PUT': function(err, allow, res, body) {
                        assert.include(allow, 'PUT');
                    },
                    'it allows DELETE': function(err, allow, res, body) {
                        assert.include(allow, 'DELETE');
                    }
                }
            }
        }
    }
});

suite['export'](module);