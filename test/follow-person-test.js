// follow-person-test.js
//
// Test posting an activity to follow a person
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
    actutil = require('./lib/activity'),
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken;

var ignore = function(err) {};
var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var suite = vows.describe('follow person activity test');

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
        'and we register a client': {
            topic: function() {
                newClient(this.callback);
            },
            'it works': function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            'and one user follows another': {
                topic: function(cl) {
                    var cb = this.callback,
                        users = {larry: {}, moe: {}, curly: {}};

                    Step(
                        function() {
                            register(cl, "larry", "wiry1", this.parallel());
                            register(cl, "moe", "bowlcut", this.parallel());
                            register(cl, "curly", "nyuknyuk", this.parallel());
                        },
                        function(err, user1, user2, user3) {
                            if (err) throw err;
                            users.larry.profile = user1.profile;
                            users.moe.profile   = user2.profile;
                            users.curly.profile = user3.profile;
                            accessToken(cl, {nickname: "larry", password: "wiry1"}, this.parallel());
                            accessToken(cl, {nickname: "moe", password: "bowlcut"}, this.parallel());
                            accessToken(cl, {nickname: "curly", password: "nyuknyuk"}, this.parallel());
                        },
                        function(err, pair1, pair2, pair3) {
                            if (err) throw err;
                            users.larry.pair = pair1;
                            users.moe.pair   = pair2;
                            users.curly.pair = pair3;
                            var act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: users.moe.profile.id
                                }
                            },
                                url = 'http://localhost:4815/api/user/larry/feed',
                                cred = makeCred(cl, users.larry.pair);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, posted, result) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, posted);
                            };
                        }
                    );
                },
                'it works': function(err, act) {
                    assert.ifError(err);
                },
                'results are valid': function(err, act) {
                    assert.ifError(err);
                    actutil.validActivity(act);
                },
                'results are correct': function(err, act) {
                    assert.ifError(err);
                    assert.equal(act.verb, "follow");
                }
            },
            'and one user double-follows another': {
                topic: function(cl) {
                    var cb = this.callback,
                        users = {},
                        hpair;

                    Step(
                        function() {
                            register(cl, "heckle", "cigar", this.parallel());
                            register(cl, "jeckle", "hijinks", this.parallel());
                        },
                        function(err, heckle, jeckle) {
                            if (err) throw err;
                            users.heckle = heckle;
                            users.jeckle  = jeckle;
                            accessToken(cl, {nickname: "heckle", password: "cigar"}, this);
                        },
                        function(err, pair) {
                            if (err) throw err;
                            hpair = pair;
                            var act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: users.jeckle.profile.id
                                }
                            },
                                url = 'http://localhost:4815/api/user/heckle/feed',
                                cred = makeCred(cl, users.heckle.pair);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, posted, result) {
                            if (err) throw err;
                            var act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: users.jeckle.profile.id
                                }
                            },
                                url = 'http://localhost:4815/api/user/heckle/feed',
                                cred = makeCred(cl, users.heckle.pair);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, posted, result) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            };
                        }
                    );
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite['export'](module);