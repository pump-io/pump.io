// major-stream-likes-test.js
//
// Test that liked objects have "liked" flag in */major streams
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
    Browser = require("zombie"),
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

var suite = vows.describe("Test likers array in major streams and favorites");

var sameUser = function(url, objects) {

    var ctx = {
        topic: function(pair, cl) {
            var callback = this.callback,
                cred = makeCred(cl, pair);

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
        }
    };

    if (objects) {
        ctx["all objects have 'likes' property with non-empty items array"] = function(err, feed) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "items");
            assert.isArray(feed.items);
            assert.lengthOf(feed.items, 10);
            _.each(feed.items, function(object) {
                assert.isObject(object);
                assert.include(object, "likes");
                assert.isObject(object.likes);
                assert.include(object.likes, "items");
                assert.isArray(object.likes.items);
                assert.lengthOf(object.likes.items, 1);
            });
        };
    } else {
        ctx["all objects have 'likes' property with non-empty items array"] = function(err, feed) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "items");
            assert.isArray(feed.items);
            assert.lengthOf(feed.items, 20);
            _.each(feed.items, function(activity, i) {
                assert.isObject(activity);
                assert.include(activity, "object");
                assert.isObject(activity.object);
                assert.include(activity.object, "likes");
                if (activity.object.secretNumber % 2 == 0) {
                    assert.include(activity.object.likes, "items");
                    assert.isArray(activity.object.likes.items);
                    assert.lengthOf(activity.object.likes.items, 1);
                } else {
                    assert.isFalse(_.has(activity.object.likes, "items"));
                }
            });
        };
    }
    
    return ctx;
};

var justClient = function(url, objects) {

    var ctx = {
        topic: function(pair, cl) {
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
        }
    };

    if (objects) {
        ctx["all objects have 'likes' property with non-empty items array"] = function(err, feed) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "items");
            assert.isArray(feed.items);
            assert.lengthOf(feed.items, 10);
            _.each(feed.items, function(object) {
                assert.isObject(object);
                assert.include(object, "likes");
                assert.isObject(object.likes);
                assert.include(object.likes, "items");
                assert.isArray(object.likes.items);
                assert.lengthOf(object.likes.items, 1);
            });
        };
    } else {
        ctx["all objects have 'likes' property with non-empty items array"] = function(err, feed) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "items");
            assert.isArray(feed.items);
            assert.lengthOf(feed.items, 20);
            _.each(feed.items, function(activity, i) {
                assert.isObject(activity);
                assert.include(activity, "object");
                assert.isObject(activity.object);
                assert.include(activity.object, "likes");
                if (activity.object.secretNumber % 2 == 0) {
                    assert.include(activity.object.likes, "items");
                    assert.isArray(activity.object.likes.items);
                    assert.lengthOf(activity.object.likes.items, 1);
                } else {
                    assert.isFalse(_.has(activity.object.likes, "items"));
                }
            });
        };
    }
    
    return ctx;
};

var otherUser = function(url, objects) {

    var ctx = {
        topic: function(pair, ignore, cl) {
            var callback = this.callback,
                cred = makeCred(cl, pair);

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
        }
    };

    if (objects) {
        ctx["all objects have 'likes' property with non-empty items array"] = function(err, feed) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "items");
            assert.isArray(feed.items);
            assert.lengthOf(feed.items, 10);
            _.each(feed.items, function(object) {
                assert.isObject(object);
                assert.include(object, "likes");
                assert.isObject(object.likes);
                assert.include(object.likes, "items");
                assert.isArray(object.likes.items);
                assert.lengthOf(object.likes.items, 1);
            });
        };
    } else {
        ctx["all objects have 'likes' property with non-empty items array"] = function(err, feed) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "items");
            assert.isArray(feed.items);
            assert.lengthOf(feed.items, 20);
            _.each(feed.items, function(activity, i) {
                assert.isObject(activity);
                assert.include(activity, "object");
                assert.isObject(activity.object);
                assert.include(activity.object, "likes");
                if (activity.object.secretNumber % 2 == 0) {
                    assert.include(activity.object.likes, "items");
                    assert.isArray(activity.object.likes.items);
                    assert.lengthOf(activity.object.likes.items, 1);
                } else {
                    assert.isFalse(_.has(activity.object.likes, "items"));
                }
            });
        };
    }
    
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
            "and we register a user": {
                topic: function(cl) {
                    newPair(cl, "humbaba", "a*giant!", this.callback);
                },
                "it works": function(err, pair) {
                    assert.ifError(err);
                    assert.isObject(pair);
                },
                "and they posts a bunch of notes and like them all": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            cred = makeCred(cl, pair),
                            url = "http://localhost:4815/api/user/humbaba/feed";

                        Step(
                            function() {
                                var group = this.group();
                                _.times(20, function(i) {
                                    var act = {
                                        to: [pair.user.profile], 
                                        cc: [{objectType: "collection",
                                              id: "http://activityschema.org/collection/public"}],
                                        verb: "post",
                                        object: {
                                            objectType: "note",
                                            secretNumber: i,
                                            content: "Hello, world! " + i
                                        }
                                    };
                                    httputil.postJSON(url, cred, act, group());
                                });
                            },
                            function(err, posts) {
                                var group = this.group();
                                if (err) throw err;
                                _.each(posts, function(post, i) {
                                    if (post.object.secretNumber % 2 == 0) {
                                        var act = {
                                            verb: "favorite",
                                            object: post.object
                                        };
                                        httputil.postJSON(url, cred, act, group());
                                    }
                                });
                            },
                            function(err, likes) {
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
                    "and we check their major inbox with same user credentials": 
                    sameUser("http://localhost:4815/api/user/humbaba/inbox/major"),
                    "and we check their major feed with same user credentials": 
                    sameUser("http://localhost:4815/api/user/humbaba/feed/major"),
                    "and we check their major direct inbox with same user credentials":
                    sameUser("http://localhost:4815/api/user/humbaba/inbox/direct/major"),
                    "and we check their favorites with same user credentials": 
                    sameUser("http://localhost:4815/api/user/humbaba/favorites", true),
                    "and we check their major feed with client credentials":
                    justClient("http://localhost:4815/api/user/humbaba/feed/major"),
                    "and we check their favorites with client credentials": 
                    justClient("http://localhost:4815/api/user/humbaba/favorites", true),
                    "and we register another user": {
                        topic: function(pair, cl) {
                            newPair(cl, "grendaline", "giant*of*water", this.callback);
                        },
                        "it works": function(err, pair) {
                            assert.ifError(err);
                            assert.isObject(pair);
                        },
                        "and we check the first user's major feed with different user credentials":
                        otherUser("http://localhost:4815/api/user/humbaba/feed/major"),
                        "and we check the first user's favorites with different user credentials":
                        otherUser("http://localhost:4815/api/user/humbaba/favorites", true)
                    }
                }
            }
        }
    }
});

suite["export"](module);
