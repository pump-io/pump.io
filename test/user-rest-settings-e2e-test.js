// user-rest-test.js
//
// Test the client registration API
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

"use strict";

var assert = require("assert"),
    http = require("http"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("lodash"),
    OAuth = require("oauth-evanp").OAuth,
    version = require("../lib/version").version,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    setupApp = apputil.setupApp,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    register = oauthutil.register;

var suite = vows.describe("user settings REST API");

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var pairOf = function(user) {
    return {token: user.token, token_secret: user.secret};
};

var makeUserCred = function(cl, user) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: user.token,
        token_secret: user.secret
    };
};

var clientCred = function(cl) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret
    };
};

var invert = function(callback) {
    return function(err) {
        if (err) {
            callback(null);
        } else {
            callback(new Error("Unexpected success"));
        }
    };
};

var goodUser = function(err, doc) {

    var profile;

    assert.ifError(err);

    assert.isObject(doc);

    assert.include(doc, "nickname");
    assert.include(doc, "published");
    assert.include(doc, "updated");

    assert.include(doc, "profile");
    assert.isObject(doc.profile);

    profile = doc.profile;

    assert.include(doc.profile, "id");
    assert.include(doc.profile, "objectType");
    assert.equal(doc.profile.objectType, "person");

    assert.include(doc.profile, "favorites");
    assert.include(doc.profile, "followers");
    assert.include(doc.profile, "following");
    assert.include(doc.profile, "lists");

    assert.isFalse(_.has(doc.profile, "_uuid"));
    assert.isFalse(_.has(doc.profile, "_user"));

    assert.isFalse(_.has(doc.profile, "_user"));
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
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        "it works": function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },
        "and we register two users": {
            topic: function(cl) {
                var callback = this.callback;
                Step(
                    function() {
                        register(cl, "ahmose", "theFirst!", this.parallel());
                        register(cl, "tarquin", "of|rome.", this.parallel());
                    },
                    callback
                );
            },
            "it works": function(err, user1, user2) {
                assert.ifError(err);
                assert.isObject(user1);
                assert.isObject(user2);
            },
            "and we set the first user's settings": {
                topic: function(user1, user2, cl) {
                    var callback = this.callback;
                    if (!user1.settings) {
                        user1.settings = {};
                    }
                    if (!user1.settings["pump.io"]) {
                        user1.settings["pump.io"] = {};
                    }
                    user1.settings["pump.io"]["user-rest-test"] = 42;
                    user1.password = "theFirst!";
                    httputil.putJSON("http://localhost:4815/api/user/ahmose",
                                     makeUserCred(cl, user1),
                                     _.omit(user1, "token", "secret"),
                                     function(err, obj) {
                                         callback(err);
                                     });
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we get the first user's settings with its own credentials": {
                    topic: function(user1, user2, cl) {
                        var callback = this.callback;
                        httputil.getJSON("http://localhost:4815/api/user/ahmose",
                                         makeUserCred(cl, user1),
                                         function(err, obj) {
                                             callback(err, obj);
                                         });
                    },
                    "it works": function(err, user) {
                        assert.ifError(err);
                    },
                    "it has our setting": function(err, user) {
                        assert.ifError(err);
                        assert.isObject(user);
                        assert.isObject(user.settings);
                        assert.isObject(user.settings["pump.io"]);
                        assert.isNumber(user.settings["pump.io"]["user-rest-test"]);
                        assert.equal(user.settings["pump.io"]["user-rest-test"], 42);
                    }
                },
                "and we get the first user's settings with the other user's credentials": {
                    topic: function(user1, user2, cl) {
                        var callback = this.callback;
                        httputil.getJSON("http://localhost:4815/api/user/ahmose",
                                         makeUserCred(cl, user2),
                                         function(err, obj) {
                                             callback(err, obj);
                                         });
                    },
                    "it works": function(err, user) {
                        assert.ifError(err);
                    },
                    "it does not have the setting": function(err, user) {
                        assert.ifError(err);
                        assert.isObject(user);
                        assert.isUndefined(user.settings);
                    }
                }
            }
        }
    }
});

suite["export"](module);
