// list-members-api-test.js
//
// Test user collections of people
//
// Copyright 2013, E14N https://e14n.com/
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
    http = require("http"),
    urlparse = require("url").parse,
    OAuth = require("oauth-evanp").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    Queue = require("jankyqueue"),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    register = oauthutil.register;

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var assertValidList = function(doc, count, itemCount) {
    assert.include(doc, "author");
    assert.include(doc.author, "id");
    assert.include(doc.author, "displayName");
    assert.include(doc.author, "objectType");
    assert.include(doc, "totalItems");
    assert.include(doc, "items");
    assert.include(doc, "displayName");
    assert.include(doc, "url");
    if (_(count).isNumber()) {
        assert.equal(doc.totalItems, count);
    }
    if (_(itemCount).isNumber()) {
        assert.lengthOf(doc.items, itemCount);
    }
};

var assertValidActivity = function(act) {
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
};

var suite = vows.describe("list members api test");

// A batch to test following/unfollowing users

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
        "and we register a client": {
            topic: function() {
                newClient(this.callback);
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and a user adds a lot of people to a list": {
                topic: function(cl) {
                    var cb = this.callback,
                        url = "http://localhost:4815/api/user/trent/feed",
                        others,
                        pair,
                        cred,
                        list;

                    Step(
                        function() {
                            newPair(cl, "trent", "Cahp6oat", this.parallel());
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            cred = makeCred(cl, pair);
                            var act = {
                                verb: "create",
                                object: {
                                    objectType: "collection",
                                    displayName: "Homies",
                                    objectTypes: ["person"]
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            var i, group = this.group();
                            if (err) throw err;
                            list = doc.object;
                            for (i = 0; i < 50; i++) {
                                register(cl, "other"+i, "Uloo8Eip", group());
                            }
                        },
                        function(err, users) {
                            var group = this.group();
                            if (err) throw err;
                            others = users;
                            _.each(others, function(other) {
                                var act = {
                                    verb: "add",
                                    object: other.profile,
                                    target: list
                                };
                                httputil.postJSON(url, cred, act, group());
                            });
                        },
                        function(err) {
                            if (err) {
                                cb(err, null, null);
                            } else {
                                cb(null, list, cred);
                            }
                        }
                    );
                },
                "it works": function(err, list) {
                    assert.ifError(err);
                    assert.isObject(list);
                },
                "and we get the members collection": {
                    topic: function(list, cred) {
                        var cb = this.callback;
                        httputil.getJSON(list.members.url, cred, function(err, doc, response) {
                            cb(err, doc);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                        assertValidList(feed, 50, 20);
                    },
                    "it has a next link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed, "links");
                        assert.include(feed.links, "next");
                        assert.include(feed.links.next, "href");
                    },
                    "it has a prev link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed, "links");
                        assert.include(feed.links, "prev");
                        assert.include(feed.links.prev, "href");
                    },
                    "and we get its next link": {
                        topic: function(feed, list, cred) {
                            var cb = this.callback;
                            httputil.getJSON(feed.links.next.href, cred, function(err, doc, response) {
                                cb(err, doc);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assertValidList(feed, 50, 20);
                        },
                        "it has a next link": function(err, feed) {
                            assert.ifError(err);
                            assert.include(feed, "links");
                            assert.include(feed.links, "next");
                            assert.include(feed.links.next, "href");
                        },
                        "it has a prev link": function(err, feed) {
                            assert.ifError(err);
                            assert.include(feed, "links");
                            assert.include(feed.links, "prev");
                            assert.include(feed.links.prev, "href");
                        },
                        "and we get its prev link": {
                            topic: function(middle, feed, list, cred) {
                                var cb = this.callback;
                                httputil.getJSON(middle.links.prev.href, cred, function(err, doc, response) {
                                    cb(err, doc, feed);
                                });
                            },
                            "it works": function(err, feed, orig) {
                                assert.ifError(err);
                                assertValidList(feed, 50, 20);
                            },
                            "it's the same as the current set": function(err, feed, orig) {
                                var i;
                                assert.ifError(err);
                                assert.equal(feed.items.length, orig.items.length);
                                for (i = 0; i < feed.items.length; i++) {
                                    assert.equal(feed.items[i].id, orig.items[i].id);
                                }
                            }
                        },
                        "and we get its next link": {
                            topic: function(middle, feed, list, cred) {
                                var cb = this.callback;
                                httputil.getJSON(middle.links.next.href, cred, function(err, doc, response) {
                                    cb(err, doc);
                                });
                            },
                            "it works": function(err, feed) {
                                assert.ifError(err);
                                assertValidList(feed, 50, 10);
                            }
                        }
                    },
                    "and we get its prev link": {
                        topic: function(feed, list, cred) {
                            var cb = this.callback;
                            httputil.getJSON(feed.links.prev.href, cred, function(err, doc, response) {
                                cb(err, doc);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assertValidList(feed, 50, 0);
                        },
                        "it has no next link": function(err, feed) {
                            assert.ifError(err);
                            assert.include(feed, "links");
                            assert.isFalse(_.has(feed.links, "next"));
                        },
                        "it has no prev link": function(err, feed) {
                            assert.ifError(err);
                            assert.include(feed, "links");
                            assert.isFalse(_.has(feed.links, "prev"));
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
