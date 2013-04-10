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

// A batch for testing the read access to the API

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
            topic: function() {
                newCredentials("bigredchicken", "bokbokbok!", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.isString(cred.consumer_key);
                assert.isString(cred.consumer_secret);
                assert.isString(cred.token);
                assert.isString(cred.token_secret);
            },
            "and we check the feed endpoint": 
            httputil.endpoint("/api/user/bigredchicken/feed", ["GET", "POST"]),
            "and we check the minor feed endpoint": 
            httputil.endpoint("/api/user/bigredchicken/feed/minor", ["GET"]),
            "and we check the major feed endpoint": 
            httputil.endpoint("/api/user/bigredchicken/feed/major", ["GET"]),
            "and we check the inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox", ["GET", "POST"]),
            "and we check the minor inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox/minor", ["GET"]),
            "and we check the major inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox/major", ["GET"]),
            "and we check the direct inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox/direct", ["GET"]),
            "and we check the direct minor inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox/direct/minor", ["GET"]),
            "and we check the direct major inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox/direct/major", ["GET"]),
            "and we get the feed of a new user": 
            sizeFeed("/api/user/bigredchicken/feed", 5),
            "and we get the minor feed of a new user": 
            sizeFeed("/api/user/bigredchicken/feed/minor", 5),
            "and we get the major feed of a new user": 
            emptyFeed("/api/user/bigredchicken/feed/major"),
            "and we get the inbox of a new user": 
            sizeFeed("/api/user/bigredchicken/inbox", 6),
            "and we get the minor inbox of a new user": 
            sizeFeed("/api/user/bigredchicken/inbox/minor", 5),
            "and we get the major inbox of a new user": 
            sizeFeed("/api/user/bigredchicken/inbox/major", 1),
            "and we get the direct inbox of a new user": 
            sizeFeed("/api/user/bigredchicken/inbox/direct", 1),
            "and we get the direct minor inbox of a new user": 
            emptyFeed("/api/user/bigredchicken/inbox/direct/minor"),
            "and we get the direct major inbox of a new user": 
            sizeFeed("/api/user/bigredchicken/inbox/direct/major", 1)
        },
        "and we get more new credentials": {
            topic: function() {
                newCredentials("dora", "v4m0nos!", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.isString(cred.consumer_key);
                assert.isString(cred.consumer_secret);
                assert.isString(cred.token);
                assert.isString(cred.token_secret);
            },
            "and we post a new activity": {
                topic: function(cred) {
                    var cb = this.callback,
                        act = {
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/dora/feed", cred, act, function(err, act, result) {
                        cb(err, act);
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "results look right": function(err, act) {
                    assert.isObject(act);
                    assert.include(act, "id");
                    assert.isString(act.id);
                    assert.include(act, "actor");
                    assert.isObject(act.actor);
                    assert.include(act.actor, "id");
                    assert.isString(act.actor.id);
                    assert.include(act, "verb");
                    assert.isString(act.verb);
                    assert.include(act, "object");
                    assert.isObject(act.object);
                    assert.include(act.object, "id");
                    assert.isString(act.object.id);
                    assert.include(act, "published");
                    assert.isString(act.published);
                    assert.include(act, "updated");
                    assert.isString(act.updated);
                },
                "and we read the feed": {
                    topic: function(act, cred) {
                        var cb = this.callback;

                        httputil.getJSON("http://localhost:4815/api/user/dora/feed", cred, function(err, newf) {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null, {act: act, feed: newf});
                            }
                        });
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has the right members": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "feed");
                        var feed = res.feed;
                        assert.include(feed, "author");
                        assert.include(feed.author, "id");
                        assert.include(feed.author, "displayName");
                        assert.include(feed.author, "objectType");
                        assert.include(feed, "totalItems");
                        assert.include(feed, "items");
                        assert.include(feed, "displayName");
                        assert.include(feed, "url");
                        assert.include(feed, "objectTypes");
                        assert.include(feed.objectTypes, "activity");
                    },
                    "it has six objects": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "feed");
                        var feed = res.feed;
                        assert.equal(feed.totalItems, 6);
                        assert.equal(feed.items.length, 6);
                    },
                    "it has our activity": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "feed");
                        assert.include(res, "act");
                        var feed = res.feed, act = res.act;
                        assert.equal(feed.items[0].id, act.id);
                    }
                },
                "and we read the inbox": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        httputil.getJSON("http://localhost:4815/api/user/dora/inbox", cred, function(err, newb) {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null, {act: act, inbox: newb});
                            }
                        });
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has the right members": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "inbox");
                        var inbox = res.inbox;
                        assert.include(inbox, "author");
                        assert.include(inbox.author, "id");
                        assert.include(inbox.author, "displayName");
                        assert.include(inbox.author, "objectType");
                        assert.include(inbox, "totalItems");
                        assert.include(inbox, "items");
                        assert.include(inbox, "displayName");
                        assert.include(inbox, "url");
                        assert.include(inbox, "objectTypes");
                        assert.include(inbox.objectTypes, "activity");
                    },
                    "it has seven items": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "inbox");
                        var inbox = res.inbox;
                        assert.equal(inbox.totalItems, 7);
                        assert.equal(inbox.items.length, 7);
                    },
                    "it has our activity": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "inbox");
                        assert.include(res, "act");
                        var inbox = res.inbox, act = res.act;
                        assert.equal(inbox.items[0].id, act.id);
                    }
                }
            }
        }
    }
});

suite["export"](module);
