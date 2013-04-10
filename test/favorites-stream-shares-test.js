// major-stream-replies-test.js
//
// Test that objects have "replies" stream in */major streams
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
    http = require("http"),
    OAuth = require("oauth-evanp").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair;

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var suite = vows.describe("Test shares items in favorites stream");

var haveShares = function(feed) {
    assert.include(feed, "items");
    assert.isArray(feed.items);
    assert.lengthOf(feed.items, 20);
    _.each(feed.items, function(object) {
        assert.isObject(object);
        assert.include(object, "shares");
        assert.isObject(object.shares);
        assert.include(object.shares, "totalItems");
        assert.include(object.shares, "url");
    });
};

var correctShares = function(feed) {
    assert.include(feed, "items");
    assert.isArray(feed.items);
    assert.lengthOf(feed.items, 20);
    _.each(feed.items, function(object) {
        assert.isObject(object);
        assert.include(object, "shares");
        assert.isObject(object.shares);
        assert.include(object.shares, "totalItems");
        if (object.secretNumber % 2) {
            assert.equal(object.shares.totalItems, 1);
        } else {
            assert.equal(object.shares.totalItems, 0);
        }
    });
};

var haveShared = function(feed) {
    assert.include(feed, "items");
    assert.isArray(feed.items);
    assert.lengthOf(feed.items, 20);
    _.each(feed.items, function(object) {
        assert.isObject(object);
        assert.include(object, "pump_io");
        assert.isObject(object.pump_io);
        assert.include(object.pump_io, "shared");
        assert.isBoolean(object.pump_io.shared);
    });
};

var noShared = function(feed) {
    assert.include(feed, "items");
    assert.isArray(feed.items);
    assert.lengthOf(feed.items, 20);
    _.each(feed.items, function(object) {
        assert.isObject(object);
        assert.isFalse(_.has(object, "pump_io") && _.has(object.pump_io, "shared"));
    });
};

var sharedIs = function(val) {
    return function(feed) {
        assert.include(feed, "items");
        assert.isArray(feed.items);
        assert.lengthOf(feed.items, 20);
        _.each(feed.items, function(object) {
            assert.isObject(object);
            assert.include(object, "pump_io");
            assert.isObject(object.pump_io);
            assert.include(object.pump_io, "shared");
            if (object.secretNumber % 2) {
                assert.equal(object.pump_io.shared, val);
            } else {
                assert.equal(object.pump_io.shared, false);
            }
        });
    };
};

var sameUser = function(url, objects) {

    var ctx = {
        topic: function(pair0, pair1, cl) {
            var callback = this.callback,
                cred = makeCred(cl, pair0);

            Step(
                function() {
                    httputil.getJSON(url, cred, this);
                },
                function(err, feed, response) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, feed);
                    }
                }
            );
        },
        "it works": function(err, feed) {
            assert.ifError(err);
            assert.isObject(feed);
        },
        "and we examine the feed": {
            topic: function(feed) {
                return feed;
            },
            "all items have shares": haveShares,
            "some items have non-empty shares": correctShares,
            "all items have the shared flag": haveShared,
            "all items have shared = false": sharedIs(false)
        }
    };
    
    return ctx;
};

var justClient = function(url, objects) {

    var ctx = {
        topic: function(pair0, pair1, cl) {
            var callback = this.callback,
                cred =  {
                    consumer_key: cl.client_id,
                    consumer_secret: cl.client_secret
                };

            Step(
                function() {
                    httputil.getJSON(url, cred, this);
                },
                function(err, feed, response) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, feed);
                    }
                }
            );
        },
        "it works": function(err, feed) {
            assert.ifError(err);
            assert.isObject(feed);
        },
        "and we examine the feed": {
            topic: function(feed) {
                return feed;
            },
            "all items have shares": haveShares,
            "some items have non-empty shares": correctShares,
            "no items have the shared flag": noShared
        }
    };
    
    return ctx;
};

var otherUser = function(url, objects) {

    var ctx = {
        topic: function(pair0, pair1, cl) {
            var callback = this.callback,
                cred = makeCred(cl, pair1);

            Step(
                function() {
                    httputil.getJSON(url, cred, this);
                },
                function(err, feed, response) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, feed);
                    }
                }
            );
        },
        "it works": function(err, feed) {
            assert.ifError(err);
            assert.isObject(feed);
        },
        "and we examine the feed": {
            topic: function(feed) {
                return feed;
            },
            "all items have shares": haveShares,
            "some items have non-empty shares": correctShares,
            "all items have the shared flag": haveShared,
            "all items have correct shared value": sharedIs(true)
        }
    };
    
    return ctx;
};

// A batch to test favoriting/unfavoriting objects

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
            "and we register two users": {
                topic: function(cl) {
                    var callback = this.callback;

                    Step(
                        function() {
                            newPair(cl, "click", "don't drive like my brother", this.parallel());
                            newPair(cl, "clack", "don't drive like *my* brother", this.parallel());
                        },
                        callback
                    );
                },
                "it works": function(err, pair0, pair1) {
                    assert.ifError(err);
                    assert.isObject(pair0);
                    assert.isObject(pair1);
                },
                "and the first one posts a bunch of notes and the second one shares every other one": {
                    topic: function(pair0, pair1, cl) {
                        var callback = this.callback,
                            cred0 = makeCred(cl, pair0),
                            cred1 = makeCred(cl, pair1),
                            url0 = "http://localhost:4815/api/user/click/feed",
                            url1 = "http://localhost:4815/api/user/clack/feed",
                            posts;

                        Step(
                            function() {
                                var group = this.group();
                                _.times(20, function(i) {
                                    var act = {
                                        to: [pair0.user.profile], 
                                        cc: [{objectType: "collection",
                                              id: "http://activityschema.org/collection/public"}],
                                        verb: "post",
                                        object: {
                                            objectType: "note",
                                            secretNumber: i,
                                            content: "Our fair city " + i
                                        }
                                    };
                                    httputil.postJSON(url0, cred0, act, group());
                                });
                            },
                            function(err, results) {
                                var group = this.group();
                                if (err) throw err;
                                posts = results;
                                _.each(posts, function(post, i) {
                                    var act = {
                                        verb: "like",
                                        object: post.object
                                    };
                                    httputil.postJSON(url0, cred0, act, group());
                                });
                            },
                            function(err, results) {
                                var group = this.group();
                                if (err) throw err;
                                _.each(posts, function(post, i) {
                                    if (i % 2) {
                                        var act = {
                                            verb: "share",
                                            object: post.object
                                        };
                                        httputil.postJSON(url1, cred1, act, group());
                                    }
                                });
                            },
                            function(err, shares) {
                                if (err) {
                                    callback(err);
                                } else {
                                    callback(null);
                                }
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we check their favorites stream with same user credentials": 
                    sameUser("http://localhost:4815/api/user/click/favorites"),
                    "and we check their favorites feed with client credentials":
                    justClient("http://localhost:4815/api/user/click/favorites"),
                    "and we check the first user's favorites feed with different user credentials":
                    otherUser("http://localhost:4815/api/user/click/favorites")
                }
            }
        }
    }
});

suite["export"](module);
