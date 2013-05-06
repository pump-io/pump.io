// favorite-object-api-test.js
//
// Test favoriting a posted object
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

var ignore = function(err) {};
var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var assertValidList = function(doc, count) {
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
        assert.lengthOf(doc.items, count);
    }
};

var suite = vows.describe("favorite object activity api test");

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
            "and we get the list of favorites for a new user": {
                topic: function(cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            newPair(cl, "marsha", "oh! my nose!", this);
                        },
                        function(err, pair) {
                            if (err) throw err;
                            var cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/marsha/favorites";

                            httputil.getJSON(url, cred, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc);
                        }
                    );
                },
                "it exists": function(err, doc) {
                    assert.ifError(err);
                },
                "it looks correct": function(err, doc) {
                    assert.ifError(err);
                    assertValidList(doc, 0);
                }
            },
            "and we get the list of favorites for a brand-new object": {
                topic: function(cl) {
                    var cb = this.callback,
                        cred;
                    Step(
                        function() {
                            newPair(cl, "jan", "marsha, marsha, marsha!", this);
                        },
                        function(err, pair) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/jan/feed",
                                act = {
                                    verb: "post",
                                    object: {
                                        objectType: "note",
                                        content: "MARSHA MARSHA MARSHA"
                                    }
                                };

                            cred = makeCred(cl, pair);
                                
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var url = doc.object.likes.url;
                            httputil.getJSON(url, cred, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc);
                        }
                    );
                },
                "it exists": function(err, faves) {
                    assert.ifError(err);
                },
                "it is empty": function(err, faves) {
                    assert.ifError(err);
                    assert.include(faves, "totalItems");
                    assert.include(faves, "items");
                    assert.include(faves, "displayName");
                    assert.equal(faves.totalItems, 0);
                    assert.lengthOf(faves.items, 0);
                }
            },
            "and one user favorites another user's object": {
                topic: function(cl) {
                    var cb = this.callback,
                        pairs = {};

                    Step(
                        function() {
                            newPair(cl, "cindy", "pig*tails", this.parallel());
                            newPair(cl, "bobby", "base*ball", this.parallel());
                        },
                        function(err, cpair, bpair) {
                            if (err) throw err;
                            pairs.cindy = cpair;
                            pairs.bobby = bpair;

                            var url = "http://localhost:4815/api/user/cindy/feed",
                                act = {
                                    verb: "post",
                                    to: [pairs.bobby.user.profile],
                                    object: {
                                        objectType: "note",
                                        content: "Let's play dress-up."
                                    }
                                };

                            var cred = makeCred(cl, pairs.cindy);
                                
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/bobby/feed",
                                act = {
                                    verb: "favorite",
                                    object: {
                                        objectType: doc.object.objectType,
                                        id: doc.object.id
                                    }
                                },
                                cred = makeCred(cl, pairs.bobby);
                            
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc, pairs);
                        }
                    );
                },
                "it works": function(err, act, pairs) {
                    assert.ifError(err);
                },
                "and we get the user's list of favorites": {
                    topic: function(act, pairs, cl) {
                        var cred = makeCred(cl, pairs.bobby),
                            url = "http://localhost:4815/api/user/bobby/favorites",
                            cb = this.callback;

                            httputil.getJSON(url, cred, function(err, doc, response) {
                                cb(err, doc, act);
                            });
                    },
                    "it works": function(err, doc, act) {
                        assert.ifError(err);
                        assertValidList(doc, 1);
                    },
                    "it includes the object": function(err, doc, act) {
                        assert.ifError(err);
                        assert.greater(doc.items.length, 0);
                        assert.equal(doc.items[0].id, act.object.id);
                    }
                },
                "and we get the object with the liker's credentials": {
                    topic: function(act, pairs, cl) {
                        var cred = makeCred(cl, pairs.bobby),
                            url = act.object.links.self.href,
                            cb = this.callback;

                            httputil.getJSON(url, cred, function(err, doc) {
                                cb(err, doc);
                            });
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                        assert.isObject(doc);
                    },
                    "it includes the 'liked' flag": function(err, doc) {
                        assert.ifError(err);
                        assert.include(doc, 'liked');
                        assert.isTrue(doc.liked);
                    }
                },
                "and we get the list of likes of the object": {
                    topic: function(act, pairs, cl) {
                        var cred = makeCred(cl, pairs.cindy),
                            url = act.object.likes.url,
                            cb = this.callback;

                            httputil.getJSON(url, cred, function(err, doc, response) {
                                cb(err, doc, act);
                            });
                    },
                    "it works": function(err, doc, act) {
                        assert.ifError(err);
                        assert.include(doc, "totalItems");
                        assert.include(doc, "items");
                        assert.include(doc, "displayName");
                        assert.include(doc, "url");
                        assert.equal(doc.totalItems, 1);
                        assert.lengthOf(doc.items, 1);
                    },
                    "it includes the actor": function(err, doc, act) {
                        assert.ifError(err);
                        assert.greater(doc.items.length, 0);
                        assert.equal(doc.items[0].id, act.actor.id);
                    }
                }
            },
            "and one user double-favorites another user's object": {
                topic: function(cl) {
                    var cb = this.callback,
                        pairs = {};

                    Step(
                        function() {
                            newPair(cl, "alice", "back|pain", this.parallel());
                            newPair(cl, "sam", "alice+the+maid", this.parallel());
                        },
                        function(err, apair, spair) {
                            if (err) throw err;
                            pairs.alice = apair;
                            pairs.sam = spair;

                            var url = "http://localhost:4815/api/user/alice/feed",
                                act = {
                                    verb: "post",
                                    object: {
                                        objectType: "note",
                                        content: "Pot roast tonight."
                                    }
                                };

                            var cred = makeCred(cl, pairs.alice);
                                
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/sam/feed",
                                act = {
                                    verb: "favorite",
                                    object: {
                                        objectType: doc.object.objectType,
                                        id: doc.object.id
                                    }
                                },
                                cred = makeCred(cl, pairs.sam);
                            
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/sam/feed",
                                act = {
                                    verb: "favorite",
                                    object: {
                                        objectType: doc.object.objectType,
                                        id: doc.object.id
                                    }
                                },
                                cred = makeCred(cl, pairs.sam);
                            
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and one user favorites then unfavorites another user's object": {
                topic: function(cl) {
                    var cb = this.callback,
                        pairs = {};

                    Step(
                        function() {
                            newPair(cl, "greg", "groovy*pad", this.parallel());
                            newPair(cl, "peter", "vengeance!", this.parallel());
                        },
                        function(err, gpair, ppair) {
                            if (err) throw err;
                            pairs.greg = gpair;
                            pairs.peter = ppair;

                            var url = "http://localhost:4815/api/user/peter/feed",
                                act = {
                                    verb: "post",
                                    object: {
                                        objectType: "note",
                                        content: "I'm going to build a fort."
                                    }
                                };

                            var cred = makeCred(cl, pairs.peter);
                            
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/greg/feed",
                                act = {
                                    verb: "favorite",
                                    object: {
                                        objectType: doc.object.objectType,
                                        id: doc.object.id
                                    }
                                },
                                cred = makeCred(cl, pairs.greg);
                            
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/greg/feed",
                                act = {
                                    verb: "unfavorite",
                                    object: {
                                        objectType: doc.object.objectType,
                                        id: doc.object.id
                                    }
                                },
                                cred = makeCred(cl, pairs.greg);
                            
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc, pairs);
                        }
                    );
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "and we get the user's list of favorites": {
                    topic: function(act, pairs, cl) {
                        var cred = makeCred(cl, pairs.greg),
                            url = "http://localhost:4815/api/user/greg/favorites",
                            cb = this.callback;

                            httputil.getJSON(url, cred, function(err, doc, response) {
                                cb(err, doc, act);
                            });
                    },
                    "it works": function(err, doc, act) {
                        assert.ifError(err);
                        assertValidList(doc, 0);
                    }
                },
                "and we get the list of favorites of the object": {
                    topic: function(act, pairs, cl) {
                        var cred = makeCred(cl, pairs.peter),
                            url = act.object.likes.url,
                            cb = this.callback;

                            httputil.getJSON(url, cred, function(err, doc, response) {
                                cb(err, doc);
                            });
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                        assert.include(doc, "totalItems");
                        assert.include(doc, "items");
                        assert.include(doc, "displayName");
                        assert.include(doc, "url");
                        assert.equal(doc.totalItems, 0);
                        assert.lengthOf(doc.items, 0);
                    }
                }
            },
            "and one user unfavorites another user's object they hadn't faved before": {
                topic: function(cl) {
                    var cb = this.callback,
                        pairs = {};

                    Step(
                        function() {
                            newPair(cl, "mike", "arch1tecture", this.parallel());
                            newPair(cl, "carol", "i{heart}mike", this.parallel());
                        },
                        function(err, mpair, cpair) {
                            if (err) throw err;
                            pairs.mike = mpair;
                            pairs.carol = cpair;

                            var url = "http://localhost:4815/api/user/mike/feed",
                                act = {
                                    verb: "post",
                                    object: {
                                        objectType: "note",
                                        content: "We're going to Hawaii!"
                                    }
                                };

                            var cred = makeCred(cl, pairs.mike);
                            
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/carol/feed",
                                act = {
                                    verb: "unfavorite",
                                    object: {
                                        objectType: doc.object.objectType,
                                        id: doc.object.id
                                    }
                                },
                                cred = makeCred(cl, pairs.carol);
                            
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and one user favorites an unknown or arbitrary object": {
                topic: function(cl) {
                    var cb = this.callback,
                        pairs = {};

                    Step(
                        function() {
                            newPair(cl, "tiger", "new flea powder", this);
                        },
                        function(err, pair) {
                            if (err) throw err;
                            pairs.tiger = pair;

                            var url = "http://localhost:4815/api/user/tiger/feed",
                                act = {
                                    verb: "favorite",
                                    object: {
                                        objectType: "image",
                                        id: "urn:uuid:30b3f9aa-6e20-4e2a-8325-b72cfbccb4d0"
                                    }
                                };

                            var cred = makeCred(cl, pairs.tiger);
                                
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc, pairs);
                        }
                    );
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "and we get the user's list of favorites": {
                    topic: function(act, pairs, cl) {
                        var cred = makeCred(cl, pairs.tiger),
                            url = "http://localhost:4815/api/user/tiger/favorites",
                            cb = this.callback;

                        httputil.getJSON(url, cred, function(err, doc, response) {
                            cb(err, doc, act);
                        });
                    },
                    "it works": function(err, doc, act) {
                        assert.ifError(err);
                        assertValidList(doc, 1);
                    },
                    "it includes our object": function(err, doc, act) {
                        assert.ifError(err);
                        assert.greater(doc.items.length, 0);
                        assert.equal(doc.items[0].id, act.object.id);
                    }
                }
            },
            "and a user favorites an object by posting to their favorites stream": {
                topic: function(cl) {
                    var cb = this.callback,
                        pair;

                    Step(
                        function() {
                            newPair(cl, "cousinoliver", "jump*the*shark", this);
                        },
                        function(err, result) {
                            if (err) throw err;
                            pair = result;
                            var url = "http://localhost:4815/api/user/cousinoliver/favorites",
                                obj = {
                                    objectType: "image",
                                    id: "urn:uuid:ab70a4c0-ed3a-11e1-965f-0024beb67924"
                                };

                            var cred = makeCred(cl, pair);
                            httputil.postJSON(url, cred, obj, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc, pair);
                        }
                    );
                },
                "it works": function(err, obj, pair) {
                    assert.ifError(err);
                },
                "result is the object": function(err, obj, pair) {
                    assert.ifError(err);
                    assert.isObject(obj);
                    assert.include(obj, "id");
                    assert.equal("urn:uuid:ab70a4c0-ed3a-11e1-965f-0024beb67924", obj.id);
                },
                "and we get the user's list of favorites": {
                    topic: function(act, pair, cl) {
                        var cb = this.callback,
                            url = "http://localhost:4815/api/user/cousinoliver/favorites",
                            cred = makeCred(cl, pair);
                                
                        httputil.getJSON(url, cred, function(err, feed, resp) {
                            cb(err, feed);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it includes our object": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.greater(feed.items.length, 0);
                        assert.isObject(feed.items[0]);
                        assert.include(feed.items[0], "id");
                        assert.equal("urn:uuid:ab70a4c0-ed3a-11e1-965f-0024beb67924", feed.items[0].id); 
                    }
                },
                "and we get the user's feed": {
                    topic: function(act, pair, cl) {
                        var cb = this.callback,
                            url = "http://localhost:4815/api/user/cousinoliver/feed",
                            cred = makeCred(cl, pair);
                                
                        httputil.getJSON(url, cred, function(err, feed, resp) {
                            cb(err, feed);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it includes our favorite activity": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.greater(feed.items.length, 0);
                        assert.isObject(feed.items[0]);
                        assert.include(feed.items[0], "verb");
                        assert.equal("favorite", feed.items[0].verb);
                        assert.include(feed.items[0], "object");
                        assert.isObject(feed.items[0].object);
                        assert.include(feed.items[0].object, "id");
                        assert.equal("urn:uuid:ab70a4c0-ed3a-11e1-965f-0024beb67924", feed.items[0].object.id);
                    }
                }
            },
            "and a user tries to post to someone else's favorites stream": {
                topic: function(cl) {
                    var cb = this.callback;

                    Step(
                        function() {
                            newPair(cl, "doug", "nose*ball", this.parallel());
                            newPair(cl, "rachel", "dare,you", this.parallel());
                        },
                        function(err, pair1, pair2) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/rachel/favorites",
                                obj = {
                                    objectType: "image",
                                    id: "urn:uuid:79ba04b8-ed3e-11e1-a70b-0024beb67924"
                                };

                            var cred = makeCred(cl, pair1);
                            httputil.postJSON(url, cred, obj, this);
                        },
                        function(err, doc, response) {
                            if (err && err.statusCode == 401) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success!"));
                            }
                        }
                    );
                },
                "it fails with a 401 Forbidden": function(err) {
                    assert.ifError(err);
                }
            },
            "and one user reads someone else's favorites stream which includes private objects": {
                topic: function(cl) {
                    var callback = this.callback,
                        pairs    = {};

                    // XXX: scraping the bottom of the barrel on
                    // http://en.wikipedia.org/wiki/List_of_The_Brady_Bunch_characters

                    Step(
                        function() {
                            newPair(cl, "paula", "likes2draw", this.parallel());
                            newPair(cl, "mrrandolph", "im|the|principal", this.parallel());
                            newPair(cl, "mrsdenton", "hippo|potamus", this.parallel());
                        },
                        function(err, pair1, pair2, pair3) {
                            if (err) throw err;
                            pairs.paula      = pair1;
                            pairs.mrrandolph = pair2;
                            pairs.mrsdenton  = pair3;
                            var url = "http://localhost:4815/api/user/mrrandolph/feed",
                                act = {
                                    verb: "follow",
                                    object: {
                                        objectType: "person",
                                        id: "http://localhost:4815/api/user/paula"
                                    }
                                };

                            var cred = makeCred(cl, pairs.mrrandolph);
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, act) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/paula/feed",
                                post = {
                                    verb: "post",
                                    to: [{objectType: "collection",
                                          id: "http://localhost:4815/api/user/paula/followers"}],
                                    object: {
                                        objectType: "image",
                                        displayName: "Mrs. Denton or hippopotamus?",
                                        url: "http://localhost:4815/images/mrsdenton.jpg"
                                    }
                                };

                            var cred = makeCred(cl, pairs.paula);
                            httputil.postJSON(url, cred, post, this);
                        },
                        function(err, post) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/mrrandolph/feed",
                                like = {
                                    verb: "favorite",
                                    object: post.object
                                };

                            var cred = makeCred(cl, pairs.mrrandolph);
                            httputil.postJSON(url, cred, like, this);
                        },
                        function(err, like) {
                            if (err) throw err;
                            var url = "http://localhost:4815/api/user/mrrandolph/favorites";

                            var cred = makeCred(cl, pairs.mrsdenton);
                            httputil.getJSON(url, cred, this);
                        },
                        function(err, likes) {
                            if (err) {
                                callback(err, null);
                            } else {
                                callback(null, likes);
                            }
                        }
                    );
                },
                "it works": function(err, likes) {
                    assert.ifError(err);
                    assert.isObject(likes);
                },
                "it is empty": function(err, likes) {
                    assert.ifError(err);
                    assert.include(likes, "items");
                    assert.isArray(likes.items);
                    assert.lengthOf(likes.items, 0);
                }
            }
        }
    }
});

suite["export"](module);
