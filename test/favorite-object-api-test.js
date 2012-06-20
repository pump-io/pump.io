// favorite-object-api-test.js
//
// Test favoriting a posted object
//
// Copyright 2012, StatusNet Inc.
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
    OAuth = require("oauth").OAuth,
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
    assert.include(doc, "id");
    if (_(count).isNumber()) {
        assert.equal(doc.totalItems, count);
        assert.lengthOf(doc.items, count);
    }
};

var suite = vows.describe("favorite object activity api test");

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
            "and we get the list of favorites for a new user": {
                topic: function(cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            newPair(cl, "marsha", "hair", this);
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
                            newPair(cl, "jan", "marsha", this);
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
                    assert.include(faves, "id");
                    assert.equal(faves.totalItems, 0);
                    assert.lengthOf(faves.items, 0);
                }
            },
            "and one user favorites another user\"s object": {
                topic: function(cl) {
                    var cb = this.callback,
                        pairs = {};

                    Step(
                        function() {
                            newPair(cl, "cindy", "pigtails", this.parallel());
                            newPair(cl, "bobby", "baseball", this.parallel());
                        },
                        function(err, cpair, bpair) {
                            if (err) throw err;
                            pairs.cindy = cpair;
                            pairs.bobby = bpair;

                            var url = "http://localhost:4815/api/user/cindy/feed",
                                act = {
                                    verb: "post",
                                    object: {
                                        objectType: "note",
                                        content: "Let"s play dress-up."
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
                "and we get the user\"s list of favorites": {
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
                        assert.equal(doc.items[0].id, act.object.id);
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
                        assert.include(doc, "id");
                        assert.equal(doc.totalItems, 1);
                        assert.lengthOf(doc.items, 1);
                    },
                    "it includes the actor": function(err, doc, act) {
                        assert.ifError(err);
                        assert.equal(doc.items[0].id, act.actor.id);
                    }
                }
            },
            "and one user double-favorites another user\"s object": {
                topic: function(cl) {
                    var cb = this.callback,
                        pairs = {};

                    Step(
                        function() {
                            newPair(cl, "alice", "backpain", this.parallel());
                            newPair(cl, "sam", "alice", this.parallel());
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
            "and one user favorites then unfavorites another user\"s object": {
                topic: function(cl) {
                    var cb = this.callback,
                        pairs = {};

                    Step(
                        function() {
                            newPair(cl, "greg", "groovy", this.parallel());
                            newPair(cl, "peter", "vengeance", this.parallel());
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
                                        content: "I"m going to build a fort."
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
                "and we get the user\"s list of favorites": {
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
                        assert.include(doc, "id");
                        assert.equal(doc.totalItems, 0);
                        assert.lengthOf(doc.items, 0);
                    }
                }
            },
            "and one user unfavorites another user\"s object they hadn\"t faved before": {
                topic: function(cl) {
                    var cb = this.callback,
                        pairs = {};

                    Step(
                        function() {
                            newPair(cl, "mike", "arch1tecture", this.parallel());
                            newPair(cl, "carol", "mike", this.parallel());
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
                                        content: "We"re going to Hawaii!"
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
                            newPair(cl, "tiger", "fleapowder", this);
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
                "and we get the user\"s list of favorites": {
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
                        assert.equal(doc.items[0].id, act.object.id);
                    }
                }
            }
        }
    }
});

suite["export"](module);
