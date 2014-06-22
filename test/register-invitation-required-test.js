// register-email-required-test.js
//
// Test behavior when email registration is required
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
    vows = require("vows"),
    _ = require("underscore"),
    oauthutil = require("./lib/oauth"),
    httputil = require("./lib/http"),
    Browser = require("zombie"),
    Step = require("step"),
    http = require("http"),
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    registerInvitation = oauthutil.registerInvitation,
    setupApp = oauthutil.setupApp,
    setupAppConfig = oauthutil.setupAppConfig;

var makeCred = function (cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var suite = vows.describe("registration with invitation");

// A batch to test some of the layout basics

suite.addBatch({
    "When we set up the app": {
        topic: function () {
            var callback = this.callback;
            Step(
                function () {
                    setupAppConfig({hostname: "localhost",
                            port: 4815,
                            requireEmail: false,
                            invitationCode: "123"
                        },
                        this);
                },
                function (err, app) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, app);
                    }
                }
            );
        },
        teardown: function (app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function (err, app) {
            assert.ifError(err);
        },
        "and we get a new client": {
            topic: function (app) {
                newClient(this.callback);
            },
            "it works": function (err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and we try to register a user with no invitation code": {
                topic: function (cl, app) {
                    var callback = this.callback;
                    register(cl, "florida", "good*times", function (err, result, response) {
                        if (err && err.statusCode == 400) {
                            callback(null);
                        } else {
                            callback(new Error("Unexpected success"));
                        }
                    });
                },
                "it fails correctly": function (err) {
                    assert.ifError(err);
                }
            },
            "and we try to register a user with an invalid invitation code": {
                topic: function (cl, app) {
                    var callback = this.callback;
                    registerInvitation(cl, "florida", "good*times", "xyz", function (err, result, response) {
                        if (err && err.statusCode == 400) {
                            callback(null);
                        } else {
                            callback(new Error("Unexpected success"));
                        }
                    });
                },
                "it fails correctly": function (err) {
                    assert.ifError(err);
                }
            },
            "and we register a user with a valid invitation code": {
                topic: function (cl, app) {
                    registerInvitation(cl, "jj", "dyn|o|mite!", "123", this.callback);
                },
                "it works correctly": function (err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                },
                "the invitation code is not included": function (err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                    assert.isFalse(_.include(user, "invitationCode"));
                },
                "and we fetch the user with client credentials": {
                    topic: function (user, cl) {
                        var cred = {
                            consumer_key: cl.client_id,
                            consumer_secret: cl.client_secret
                        };
                        httputil.getJSON("http://localhost:4815/api/user/jj", cred, this.callback);
                    },
                    "it works": function (err, user, response) {
                        assert.ifError(err);
                        assert.isObject(user);
                    },
                    "the invitation code is not included": function (err, user, response) {
                        assert.ifError(err);
                        assert.isObject(user);
                        assert.isFalse(_.has(user, "invitationCode"));
                    }
                },
                "and we fetch the user with user credentials for a different user": {
                    topic: function (jj, cl, app) {
                        var callback = this.callback,
                            james;

                        Step(
                            function () {
                                registerInvitation(cl, "james", "work|hard", "123", this);
                            },
                            function (err, result) {
                                if (err) throw err;
                                james = result;
                                var cred = makeCred(cl, {
                                    token: james.token,
                                    token_secret: james.secret
                                });
                                httputil.getJSON("http://localhost:4815/api/user/jj", cred, this);
                            },
                            function (err, doc, response) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    callback(null, doc);
                                }
                            }
                        );
                    },
                    "it works": function (err, doc) {
                        assert.ifError(err);
                        assert.isObject(doc);
                    },
                    "the invitation code is not included": function (err, doc) {
                        assert.ifError(err);
                        assert.isObject(doc);
                        assert.isFalse(_.has(doc, "invitationCode"));
                    }
                },
                "and we fetch the user with user credentials for the same user": {
                    topic: function (user, cl) {
                        var cred = makeCred(cl, {
                            token: user.token,
                            token_secret: user.secret
                        });
                        httputil.getJSON("http://localhost:4815/api/user/jj", cred, this.callback);
                    },
                    "it works": function (err, user) {
                        assert.ifError(err);
                        assert.isObject(user);
                    },
                    "the invitation code is not included": function (err, user) {
                        assert.ifError(err);
                        assert.isObject(user);
                        assert.isFalse(_.has(user, "invitationCode"));
                    }
                },
                "and we fetch the user feed with client credentials": {
                    topic: function (user, cl) {
                        var cred = {
                            consumer_key: cl.client_id,
                            consumer_secret: cl.client_secret
                        };
                        httputil.getJSON("http://localhost:4815/api/users", cred, this.callback);
                    },
                    "it works": function (err, feed, response) {
                        assert.ifError(err);
                        assert.isObject(feed);
                    },
                    "the invitation code is not included": function (err, feed, response) {
                        var target;
                        assert.ifError(err);
                        assert.isObject(feed);
                        target = _.filter(feed.items, function (user) {
                            return (user.nickname == "jj");
                        });
                        assert.lengthOf(target, 1);
                        assert.isObject(target[0]);
                        assert.isFalse(_.has(target[0], "invitationCode"));
                    }
                },
                "and we fetch the user feed with user credentials for a different user": {
                    topic: function (jj, cl, app) {
                        var callback = this.callback,
                            thelma;

                        Step(
                            function () {
                                registerInvitation(cl, "thelma", "dance4fun", "123", this);
                            },
                            function (err, results) {
                                if (err) throw err;
                                thelma = results;
                                this(null);
                            },
                            function (err) {
                                if (err) throw err;
                                var cred = makeCred(cl, {
                                    token: thelma.token,
                                    token_secret: thelma.secret
                                });
                                httputil.getJSON("http://localhost:4815/api/users", cred, this);
                            },
                            function (err, doc, response) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    callback(null, doc);
                                }
                            }
                        );
                    },
                    "it works": function (err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                    },
                    "the invitation code is not included": function (err, feed) {
                        var target;
                        assert.ifError(err);
                        assert.isObject(feed);
                        target = _.filter(feed.items, function (user) {
                            return (user.nickname == "jj");
                        });
                        assert.lengthOf(target, 1);
                        assert.isObject(target[0]);
                        assert.isFalse(_.has(target[0], "invitationCode"));
                    }
                },
                "and we fetch the user feed with user credentials for the same user": {
                    topic: function (user, cl) {
                        var cred = makeCred(cl, {
                            token: user.token,
                            token_secret: user.secret
                        });
                        httputil.getJSON("http://localhost:4815/api/users", cred, this.callback);
                    },
                    "it works": function (err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                    },
                    "the invitation code is not included": function (err, feed) {
                        var target;
                        assert.ifError(err);
                        assert.isObject(feed);
                        target = _.filter(feed.items, function (user) {
                            return (user.nickname == "jj");
                        });
                        assert.lengthOf(target, 1);
                        assert.isObject(target[0]);
                        assert.isFalse(_.has(target[0], "invitationCode"));
                    }
                }
            }
        }
    }
});

suite["export"](module);
