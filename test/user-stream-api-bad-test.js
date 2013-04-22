// user-stream-api-test.js
//
// Test user streams API
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
    Step = require("step"),
    _ = require("underscore"),
    querystring = require("querystring"),
    http = require("http"),
    OAuth = require("oauth-evanp").OAuth,
    Browser = require("zombie"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    newPair = oauthutil.newPair,
    newCredentials = oauthutil.newCredentials;

var ignore = function(err) {};

var suite = vows.describe("User stream API test");

var sizeFeed = function(endpoint, size) {
    return {
        topic: function(cred) {
            var full = "http://localhost:4815" + endpoint,
                callback = this.callback;

            httputil.getJSON(full, cred, callback);
        },
        "it works": function(err, feed, resp) {
            assert.ifError(err);
        },
        "it looks like a feed": function(err, feed, resp) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "totalItems");
            assert.include(feed, "items");
        },
        "it is empty": function(err, feed, resp) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "totalItems");
            assert.equal(feed.totalItems, size);
            assert.include(feed, "items");
            assert.isArray(feed.items);
            assert.equal(feed.items.length, size);
        }
    };
};

var emptyFeed = function(endpoint) {
    return {
        topic: function(cred) {
            var full = "http://localhost:4815" + endpoint,
                callback = this.callback;

            httputil.getJSON(full, cred, callback);
        },
        "it works": function(err, feed, resp) {
            assert.ifError(err);
        },
        "it looks like a feed": function(err, feed, resp) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "totalItems");
            assert.include(feed, "items");
        },
        "it is empty": function(err, feed, resp) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "totalItems");
            assert.equal(feed.totalItems, 0);
            assert.include(feed, "items");
            assert.isEmpty(feed.items);
        }
    };
};

// Test some "bad" kinds of activity

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we get new credentials": {
            topic: function(app) {
                newCredentials("diego", "to*the*rescue", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.isString(cred.consumer_key);
                assert.isString(cred.consumer_secret);
                assert.isString(cred.token);
                assert.isString(cred.token_secret);
            },
            "and we try to post an activity with a different actor": {
                topic: function(cred, app) {
                    var cb = this.callback,
                        act = {
                            actor: {
                                id: "urn:uuid:66822a4d-9f72-4168-8d5a-0b1319afeeb1",
                                objectType: "person",
                                displayName: "Not Diego"
                            },
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "To the rescue!"
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/diego/feed", cred, act, function(err, feed, result) {
                        if (err) {
                            cb(null);
                        } else if (result.statusCode < 400 || result.statusCode >= 500) {
                            cb(new Error("Unexpected result"));
                        } else {
                            cb(null);
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we try to post an activity with no object": {
                topic: function(cred, app) {
                    var cb = this.callback,
                        act = {
                            verb: "noop"
                        };
                    httputil.postJSON("http://localhost:4815/api/user/diego/feed", cred, act, function(err, feed, result) {
                        if (err) {
                            cb(null);
                        } else if (result.statusCode < 400 || result.statusCode >= 500) {
                            cb(new Error("Unexpected result"));
                        } else {
                            cb(null);
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we try to post an activity as a different user": {
                topic: function(cred, app) {
                    var cb = this.callback,
                        cl = {client_id: cred.consumer_key,
                              client_secret: cred.consumer_secret},
                        act = {
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "To the rescue!"
                            }
                        };
                    Step(
                        function() {
                            newPair(cl, "boots", "b4nanazz", this);
                        },
                        function(err, pair) {
                            var nuke;
                            if (err) {
                                cb(err);
                            } else {
                                nuke = _(cred).clone();
                                _(nuke).extend(pair);

                                httputil.postJSON("http://localhost:4815/api/user/diego/feed", nuke, act, function(err, feed, result) {
                                    if (err) {
                                        cb(null);
                                    } else if (result.statusCode < 400 || result.statusCode >= 500) {
                                        cb(new Error("Unexpected result"));
                                    } else {
                                        cb(null);
                                    }
                                });
                            }
                        }
                    );
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we try to post an activity with a default verb": {
                topic: function(cred, app) {
                    var cb = this.callback,
                        act = {
                            object: {
                                objectType: "note",
                                content: "Hello, llama!"
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/diego/feed", cred, act, function(err, posted, result) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, posted);
                        }
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "it has the right verb": function(err, act) {
                    assert.equal(act.verb, "post");
                }
            }
        }
    }
});

suite["export"](module);
