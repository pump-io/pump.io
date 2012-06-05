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
                    'it allows GET': function(err, allow, res, body) {
                        assert.include(allow, 'GET');
                    },
                    'it allows PUT': function(err, allow, res, body) {
                        assert.include(allow, 'PUT');
                    },
                    'it allows DELETE': function(err, allow, res, body) {
                        assert.include(allow, 'DELETE');
                    }
                },
                'and we GET the activity': {
                    topic: function(posted, cred) {
                        var cb = this.callback;
                        httputil.getJSON(posted.id, cred, function(err, got, result) {
                            cb(err, {got: got, posted: posted});
                        });
                    },
                    'it works': function(err, res) {
                        assert.ifError(err);
                        assert.isObject(res.got);
                    },
                    'results look right': function(err, res) {
                        var got = res.got;
                        assert.isObject(got);
                        assert.include(got, 'id');
                        assert.isString(got.id);
                        assert.include(got, 'actor');
                        assert.isObject(got.actor);
                        assert.include(got.actor, 'id');
                        assert.isString(got.actor.id);
                        assert.include(got, 'verb');
                        assert.isString(got.verb);
                        assert.include(got, 'object');
                        assert.isObject(got.object);
                        assert.include(got.object, 'id');
                        assert.isString(got.object.id);
                        assert.include(got, 'published');
                        assert.isString(got.published);
                        assert.include(got, 'updated');
                        assert.isString(got.updated);
                    },
                    'it has the correct data': function(err, res) {
                        var got = res.got, posted = res.posted;
                        assert.equal(got.id, posted.id);
                        assert.equal(got.verb, posted.verb);
                        assert.equal(got.published, posted.published);
                        assert.equal(got.updated, posted.updated);
                        assert.equal(got.actor.id, posted.actor.id);
                        assert.equal(got.actor.objectType, posted.actor.objectType);
                        assert.equal(got.actor.displayName, posted.actor.displayName);
                        assert.equal(got.object.id, posted.object.id);
                        assert.equal(got.object.objectType, posted.object.objectType);
                        assert.equal(got.object.content, posted.object.content);
                        assert.equal(got.object.published, posted.object.published);
                        assert.equal(got.object.updated, posted.object.updated);
                    },
                    'and we PUT a new version of the activity': {
                        topic: function(got, act, cred) {
                            var cb = this.callback,
                                newact = JSON.parse(JSON.stringify(act));
                            newact['mood'] = {
                                displayName: "Friendly"
                            };
                            // wait 2000 ms to make sure updated != published
                            setTimeout(function() {
                                httputil.putJSON(act.id, cred, newact, function(err, contents, result) {
                                    cb(err, {newact: contents, act: act});
                                });
                            }, 2000);
                        },
                        'it works': function(err, res) {
                            assert.ifError(err);
                            assert.isObject(res.newact);
                        },
                        'results look right': function(err, res) {
                            var newact = res.newact, act = res.act;
                            assert.isObject(newact);
                            assert.include(newact, 'id');
                            assert.isString(newact.id);
                            assert.include(newact, 'actor');
                            assert.isObject(newact.actor);
                            assert.include(newact.actor, 'id');
                            assert.isString(newact.actor.id);
                            assert.include(newact, 'verb');
                            assert.isString(newact.verb);
                            assert.include(newact, 'object');
                            assert.isObject(newact.object);
                            assert.include(newact.object, 'id');
                            assert.isString(newact.object.id);
                            assert.include(newact, 'published');
                            assert.isString(newact.published);
                            assert.include(newact, 'updated');
                            assert.isString(newact.updated);
                            assert.include(newact, 'mood');
                            assert.isObject(newact.mood);
                            assert.include(newact.mood, 'displayName');
                            assert.isString(newact.mood.displayName);
                        },
                        'it has the correct data': function(err, res) {
                            var newact = res.newact, act = res.act;
                            assert.equal(newact.id, act.id);
                            assert.equal(newact.verb, act.verb);
                            assert.equal(newact.published, act.published);
                            assert.notEqual(newact.updated, act.updated);
                            assert.equal(newact.actor.id, act.actor.id);
                            assert.equal(newact.actor.objectType, act.actor.objectType);
                            assert.equal(newact.actor.displayName, act.actor.displayName);
                            assert.equal(newact.object.id, act.object.id);
                            assert.equal(newact.object.objectType, act.object.objectType);
                            assert.equal(newact.object.content, act.object.content);
                            assert.equal(newact.object.published, act.object.published);
                            assert.equal(newact.object.updated, act.object.updated);
                            assert.equal(newact.mood.displayName, "Friendly");
                        },
                        'and we DELETE the activity': {
                            topic: function(put, got, posted, cred) {
                                var cb = this.callback;

                                httputil.delJSON(posted.id, cred, function(err, doc, result) {
                                    cb(err, doc);
                                });
                            },
                            'it works': function(err, doc) {
                                assert.ifError(err);
                                assert.equal(doc, "Deleted");
                            }
                        }
                    }
                }
            }
        }
    }
});

suite['export'](module);