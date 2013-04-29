// share-object-test.js
//
// Test sharing an activity object
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
    OAuth = require("oauth-evanp").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair;

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var suite = vows.describe("share object activity api test");

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
            "and we register some users": {
                topic: function(cl) {
                    var callback = this.callback;
                    Step(
                        function() {
                            var group = this.group();
                            newPair(cl, "kaufman", "can't take it with you", group());
                            newPair(cl, "benchley", "how-to-sleep", group());
                        },
                        callback
                    );
                },
                "it works": function(err, pairs) {
                    assert.ifError(err);
                    assert.isArray(pairs);
                },
                "and one user posts an object": {
                    topic: function(pairs, cl) {
                        var callback = this.callback;

                        Step(
                            function() {
                                var url, cred, act;
                                url = "http://localhost:4815/api/user/kaufman/feed";
                                cred = makeCred(cl, pairs[0]);
                                act = {
                                    verb: "post",
                                    object: {
                                        objectType: "note",
                                        content: "Shoot her."
                                    }
                                };

                                httputil.postJSON(url, cred, act, this);
                            },
                            function(err, act, response) {
                                callback(err, act);
                            }
                        );
                    },
                    "it works": function(err, act) {
                        assert.ifError(err);
                        assert.isObject(act);
                    },
                    "it has an empty shares member": function(err, act) {
                        assert.ifError(err);
                        assert.isObject(act);
                        assert.include(act, "object");
                        assert.isObject(act.object);
                        assert.include(act.object, "shares");
                        assert.isObject(act.object.shares);
                        assert.include(act.object.shares, "totalItems");
                        assert.isNumber(act.object.shares.totalItems);
                        assert.equal(act.object.shares.totalItems, 0);
                        assert.include(act.object.shares, "url");
                        assert.isString(act.object.shares.url);
                        assert.equal(act.object.shares.url, act.object.id + "/shares");
                    },
                    "and another user shares it": {
                        topic: function(post, pairs, cl) {
                            var callback = this.callback;

                            Step(
                                function() {
                                    var url, cred, act;
                                    url = "http://localhost:4815/api/user/benchley/feed";
                                    cred = makeCred(cl, pairs[1]);
                                    act = {
                                        verb: "share",
                                        object: post.object
                                    };

                                    httputil.postJSON(url, cred, act, this);
                                },
                                function(err, act, response) {
                                    callback(err, act);
                                }
                            );
                        },
                        "it works": function(err, act) {
                            assert.ifError(err);
                            assert.isObject(act);
                        },
                        "it is cc the sharer's followers": function(err, act) {
                            assert.ifError(err);
                            assert.isObject(act);
                            assert.include(act, "cc");
                            assert.isArray(act.cc);
                            assert.lengthOf(act.cc, 1);
                            assert.isObject(act.cc[0]);
                            assert.include(act.cc[0], "objectType");
                            assert.equal(act.cc[0].objectType, "collection");
                            assert.include(act.cc[0], "id");
                            assert.equal(act.cc[0].id, "http://localhost:4815/api/user/benchley/followers");
                        },
                        "and we check the sharer's major feed": {
                            topic: function(share, post, pairs, cl) {
                                var callback = this.callback,
                                    cred = makeCred(cl, pairs[1]),
                                    url = "http://localhost:4815/api/user/benchley/feed/major";

                                httputil.getJSON(url, cred, function(err, doc, result) {
                                    callback(err, doc, share);
                                });
                            },
                            "it works": function(err, doc, share) {
                                assert.ifError(err);
                                assert.isObject(doc);
                            },
                            "it includes the share activity": function(err, doc, share) {
                                assert.ifError(err);
                                assert.isObject(doc);
                                assert.include(doc, "items");
                                assert.isArray(doc.items);
                                assert.lengthOf(doc.items, 1);
                                assert.isObject(doc.items[0]);
                                assert.include(doc.items[0], "id");
                                assert.equal(doc.items[0].id, share.id);
                            }
                        },
                        "and we check the shared object's shares feed": {
                            topic: function(share, post, pairs, cl) {
                                var callback = this.callback,
                                    cred = makeCred(cl, pairs[0]),
                                    url = post.object.shares.url;

                                httputil.getJSON(url, cred, function(err, doc, result) {
                                    callback(err, doc, share.actor);
                                });
                            },
                            "it works": function(err, feed, sharer) {
                                assert.ifError(err, feed);
                                assert.isObject(feed);
                            },
                            "it includes our sharer": function(err, feed, sharer) {
                                assert.ifError(err, feed);
                                assert.isObject(feed);
                                assert.include(feed, "totalItems");
                                assert.isNumber(feed.totalItems);
                                assert.equal(feed.totalItems, 1);
                                assert.include(feed, "items");
                                assert.isArray(feed.items);
                                assert.lengthOf(feed.items, 1);
                                assert.isObject(feed.items[0]);
                                assert.include(feed.items[0], "id");
                                assert.equal(feed.items[0].id, sharer.id);
                            }
                        }
                    }
                }
            },
            "and we register some other users": {
                topic: function(cl) {
                    var callback = this.callback;
                    Step(
                        function() {
                            var group = this.group();
                            newPair(cl, "parker", "enough-rope", group());
                            newPair(cl, "woolcott", "i-came-to-dinner", group());
                        },
                        callback
                    );
                },
                "it works": function(err, pairs) {
                    assert.ifError(err);
                    assert.isArray(pairs);
                },
                "and one user posts something and another user shares then unshares it and we get the feed of shares": {
                    topic: function(pairs, cl) {
                        var callback = this.callback,
                            url0 = "http://localhost:4815/api/user/parker/feed",
                            url1 = "http://localhost:4815/api/user/woolcott/feed",
                            cred0 = makeCred(cl, pairs[0]),
                            cred1 = makeCred(cl, pairs[1]);

                        Step(
                            function() {
                                var act = {
                                        verb: "post",
                                        object: {
                                            objectType: "note",
                                            content: "How could they tell?"
                                        }
                                    };
                                httputil.postJSON(url0, cred0, act, this);
                            },
                            function(err, post, response) {
                                var act;
                                if (err) throw err;
                                act = {
                                    verb: "share",
                                    object: post.object
                                };
                                httputil.postJSON(url1, cred1, act, this);
                            },
                            function(err, share, response) {
                                var act;
                                if (err) throw err;
                                act = {
                                    verb: "unshare",
                                    object: share.object
                                };
                                httputil.postJSON(url1, cred1, act, this);
                            },
                            function(err, unshare, response) {
                                if (err) throw err;
                                httputil.getJSON(unshare.object.shares.url, cred0, this);
                            },
                            function(err, feed, response) {
                                callback(err, feed);
                            }
                        );
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                    },
                    "feed is empty": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                        assert.include(feed, "items");
                        assert.include(feed, "totalItems");
                        assert.equal(feed.totalItems, 0);
                        assert.isEmpty(feed.items);
                    }
                }
            }
        }
    }
});

suite["export"](module);
