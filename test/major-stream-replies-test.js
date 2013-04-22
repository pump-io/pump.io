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

var suite = vows.describe("Test replies items in major streams and favorites");

var goodObjects = function(err, feed) {
    assert.ifError(err);
    assert.isObject(feed);
    assert.include(feed, "items");
    assert.isArray(feed.items);
    assert.lengthOf(feed.items, 20);
    _.each(feed.items, function(object) {
        assert.isObject(object);
        assert.include(object, "objectType");
        assert.equal(object.objectType, "note");
        assert.include(object, "replies");
        assert.isObject(object.replies);
        assert.include(object.replies, "items");
        assert.isArray(object.replies.items);
    });
};

var goodActivities = function(err, feed) {
    assert.ifError(err);
    assert.isObject(feed);
    assert.include(feed, "items");
    assert.isArray(feed.items);
    assert.lengthOf(feed.items, 20);
    _.each(feed.items, function(activity, i) {
        assert.isObject(activity);
        assert.include(activity, "object");
        assert.isObject(activity.object);
        assert.include(activity.object, "replies");
        assert.isObject(activity.object.replies);
        assert.include(activity.object.replies, "items");
        assert.isArray(activity.object.replies.items);
        assert.lengthOf(activity.object.replies.items, 4);
    });
};

var sameUser = function(url, objects) {

    var ctx = {
        topic: function(pair1, pair2, cl) {
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
        }
    };

    if (objects) {
        ctx["all objects have 'replies' feed with 'items' property"] = goodObjects;
    } else {
        ctx["all objects have 'replies' feed with 'items' property"] = goodActivities;
    }
    
    return ctx;
};

var justClient = function(url, objects) {

    var ctx = {
        topic: function(pair1, pair2, cl) {
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
        ctx["all objects have 'replies' feed with 'items' property"] = goodObjects;
    } else {
        ctx["all objects have 'replies' feed with 'items' property"] = goodActivities;
    }
    
    return ctx;
};

var otherUser = function(url, objects) {

    var ctx = {
        topic: function(pair1, pair2, cl) {
            var callback = this.callback,
                cred = makeCred(cl, pair2);

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
        ctx["all objects have 'replies' feed with 'items' property"] = goodObjects;
    } else {
        ctx["all objects have 'replies' feed with 'items' property"] = goodActivities;
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
            "and we register two users": {
                topic: function(cl) {
                    var callback = this.callback;

                    Step(
                        function() {
                            newPair(cl, "gummy", "apple-pie!", this.parallel());
                            newPair(cl, "curiouspete", "i|am|curious", this.parallel());
                        },
                        callback
                    );
                },
                "it works": function(err, pair1, pair2) {
                    assert.ifError(err);
                    assert.isObject(pair1);
                    assert.isObject(pair2);
                },
                "and the first one posts a bunch of notes and likes them all and the second one replies to them all": {
                    topic: function(pair1, pair2, cl) {
                        var callback = this.callback,
                            cred1 = makeCred(cl, pair1),
                            cred2 = makeCred(cl, pair2),
                            url1 = "http://localhost:4815/api/user/gummy/feed",
                            url2 = "http://localhost:4815/api/user/curiouspete/feed",
                            posts;

                        Step(
                            function() {
                                var group = this.group();
                                _.times(20, function(i) {
                                    var act = {
                                        to: [pair1.user.profile], 
                                        cc: [{objectType: "collection",
                                              id: "http://activityschema.org/collection/public"}],
                                        verb: "post",
                                        object: {
                                            objectType: "note",
                                            secretNumber: i,
                                            content: "Hello, world! " + i
                                        }
                                    };
                                    httputil.postJSON(url1, cred1, act, group());
                                });
                            },
                            function(err, results) {
                                var group = this.group();
                                if (err) throw err;
                                posts = results;
                                _.each(posts, function(post, i) {
                                    var act = {
                                        verb: "favorite",
                                        object: post.object
                                    };
                                    httputil.postJSON(url1, cred1, act, group());
                                });
                            },
                            function(err, likes) {
                                var group = this.group();
                                if (err) throw err;
                                _.each(posts, function(post, i) {
                                    _.times(5, function(i) {
                                        var act = {
                                            verb: "post",
                                            object: {
                                                inReplyTo: post.object,
                                                objectType: "comment",
                                                content: "Hello, back! " + i
                                            }
                                        };
                                        httputil.postJSON(url2, cred2, act, group());
                                    });
                                });
                            },
                            function(err, replies) {
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
                    sameUser("http://localhost:4815/api/user/gummy/inbox/major"),
                    "and we check their major feed with same user credentials": 
                    sameUser("http://localhost:4815/api/user/gummy/feed/major"),
                    "and we check their major direct inbox with same user credentials":
                    sameUser("http://localhost:4815/api/user/gummy/inbox/direct/major"),
                    "and we check their favorites with same user credentials": 
                    sameUser("http://localhost:4815/api/user/gummy/favorites", true),
                    "and we check their major feed with client credentials":
                    justClient("http://localhost:4815/api/user/gummy/feed/major"),
                    "and we check their favorites with client credentials": 
                    justClient("http://localhost:4815/api/user/gummy/favorites", true),
                    "and we check the first user's major feed with different user credentials":
                    otherUser("http://localhost:4815/api/user/gummy/feed/major"),
                    "and we check the first user's favorites with different user credentials":
                    otherUser("http://localhost:4815/api/user/gummy/favorites", true)
                }
            }
        }
    }
});

suite["export"](module);
