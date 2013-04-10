// user-profile-api-test.js
//
// Test the /api/user/:nickname/profile endpoint
//
// Copyright 2012, E14N https://e14n.com/
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

var assert = require("assert"),
    http = require("http"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("underscore"),
    OAuth = require("oauth-evanp").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    register = oauthutil.register;

var suite = vows.describe("user profile API");

var makeCred = function(cl, pair) {
    return {consumer_key: cl.client_id,
            consumer_secret: cl.client_secret,
            token: pair.token,
            token_secret: pair.token_secret};
};

suite.addBatch({

    "When we set up the app": {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            // sneaky, but we just need it for teardown
                            cl.app = app;
                            cb(err, cl);
                        }
                    });
                }
            });
        },

        "it works": function(err, cl) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (cl.app) {
                cl.app.close();
            }
        },

        "and we register a user": {

            topic: function(cl) {
                newPair(cl, "jamesbond", "sh4ken!stirred", this.callback);
            },

            "it works": function(err, pair) {
                assert.ifError(err);
            },

            "profile ID is correct": function(err, pair) {
                var user;
                assert.ifError(err);
                assert.isObject(pair);
                assert.include(pair, "user");
                user = pair.user;
                assert.isObject(user);
                assert.include(user, "profile");
                assert.isObject(user.profile);
                assert.include(user.profile, "id");
                assert.equal(user.profile.id, "http://localhost:4815/api/user/jamesbond/profile");
            },

            "and we get the options on the user profile api endpoint": 
            httputil.endpoint("/api/user/jamesbond/profile", ["GET", "PUT"]),

            "and we GET the user profile data": {
                topic: function(pair, cl) {
                    var cb = this.callback,
                        user = pair.user;

                    Step(
                        function() {
                            httputil.getJSON("http://localhost:4815/api/user/jamesbond/profile",
                                             makeCred(cl, pair),
                                             this);
                        },
                        function(err, results) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, results);
                            }
                        }
                    );
                },
                "it works": function(err, profile) {
                    assert.ifError(err);
                    assert.isObject(profile);
                    assert.include(profile, "objectType");
                    assert.equal(profile.objectType, "person");
                },
                "and we PUT the user profile data": {
                    topic: function(profile, pair, cl) {
                        var cb = this.callback;
                        Step(
                            function() {
                                profile.displayName = "James Bond";
                                profile.summary = "007";
                                httputil.putJSON("http://localhost:4815/api/user/jamesbond/profile",
                                                 makeCred(cl, pair),
                                                 profile,
                                                 this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    cb(null, results);
                                }
                            }
                        );
                    },
                    "it works": function(err, profile) {
                        assert.ifError(err);
                        assert.isObject(profile);
                        assert.include(profile, "objectType");
                        assert.equal(profile.objectType, "person");
                        assert.equal(profile.displayName, "James Bond");
                        assert.equal(profile.summary, "007");
                    }
                }
            }
        }
    }
});

suite["export"](module);
