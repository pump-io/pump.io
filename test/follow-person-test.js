// follow-person-test.js
//
// Test posting an activity to follow a person
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
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient,
    register = oauthutil.register;

var ignore = function(err) {};
var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};
var pairOf = function(user) {
    return {token: user.token, token_secret: user.secret};
};

var suite = vows.describe("follow person activity test");

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
            "and one user follows another": {
                topic: function(cl) {
                    var cb = this.callback,
                        users = {larry: {}, moe: {}, curly: {}};

                    Step(
                        function() {
                            register(cl, "larry", "wiry1hair", this.parallel());
                            register(cl, "moe", "bowlcutZ|are|cool", this.parallel());
                            register(cl, "curly", "nyuk+nyuk+nyuk", this.parallel());
                        },
                        function(err, user1, user2, user3) {
                            var act, url, cred;
                            if (err) throw err;

                            users.larry.profile = user1.profile;
                            users.moe.profile   = user2.profile;
                            users.curly.profile = user3.profile;

                            users.larry.pair    = pairOf(user1);
                            users.moe.pair      = pairOf(user2);
                            users.curly.pair    = pairOf(user3);

                            act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: users.moe.profile.id
                                }
                            };
                            url = "http://localhost:4815/api/user/larry/feed";
                            cred = makeCred(cl, users.larry.pair);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, posted, result) {
                            if (err) {
                                cb(err, null, null);
                            } else {
                                cb(null, posted, users);
                            }
                        }
                    );
                },
                "it works": function(err, act, users) {
                    assert.ifError(err);
                },
                "results are valid": function(err, act, users) {
                    assert.ifError(err);
                    actutil.validActivity(act);
                },
                "results are correct": function(err, act, users) {
                    assert.ifError(err);
                    assert.equal(act.verb, "follow");
                },
                "and we get the second user's profile with the first user's credentials": {
                    topic: function(act, users, cl) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/moe/profile",
                            cred = makeCred(cl, users.larry.pair);
                        
                        httputil.getJSON(url, cred, function(err, doc, response) {
                            callback(err, doc);
                        });
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                        assert.isObject(doc);
                    },
                    "it includes the 'followed' flag": function(err, doc) {
                        assert.ifError(err);
                        assert.isObject(doc);
                        assert.include(doc, "pump_io");
                        assert.isObject(doc.pump_io);
                        assert.include(doc.pump_io, "followed");
                        assert.isTrue(doc.pump_io.followed);
                    }
                },
                "and we get the second user's profile with some other user's credentials": {
                    topic: function(act, users, cl) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/moe/profile",
                            cred = makeCred(cl, users.curly.pair);
                        
                        httputil.getJSON(url, cred, function(err, doc, response) {
                            callback(err, doc);
                        });
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                        assert.isObject(doc);
                    },
                    "it includes the 'followed' flag": function(err, doc) {
                        assert.ifError(err);
                        assert.isObject(doc);
                        assert.include(doc, "pump_io");
                        assert.isObject(doc.pump_io);
                        assert.include(doc.pump_io, "followed");
                        assert.isFalse(doc.pump_io.followed);
                    }
                }
            },
            "and one user double-follows another": {
                topic: function(cl) {
                    var cb = this.callback,
                        users = {},
                        hpair;

                    Step(
                        function() {
                            register(cl, "heckle", "have a cigar", this.parallel());
                            register(cl, "jeckle", "up to hijinks", this.parallel());
                        },
                        function(err, heckle, jeckle) {
                            var act, url, cred;
                            if (err) throw err;
                            users.heckle = heckle;
                            users.jeckle  = jeckle;
                            hpair = pairOf(heckle);
                            act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: users.jeckle.profile.id
                                }
                            };
                            url = "http://localhost:4815/api/user/heckle/feed";
                            cred = makeCred(cl, users.heckle.pair);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, posted, result) {
                            if (err) throw err;
                            var act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: users.jeckle.profile.id
                                }
                            },
                                url = "http://localhost:4815/api/user/heckle/feed",
                                cred = makeCred(cl, users.heckle.pair);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, posted, result) {
                            if (err) {
                                cb(null);
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
            "and one user follows a remote person": {
                topic: function(cl) {
                    var cb = this.callback;

                    Step(
                        function() {
                            register(cl, "tom", "silent*cat", this);
                        },
                        function(err, tom) {
                            var act, url, cred, pair;
                            if (err) throw err;
                            pair = pairOf(tom);
                            act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: "urn:uuid:6e621028-cdbc-4550-a593-4268e0f729f5",
                                    displayName: "Jerry"
                                }
                            };
                            url = "http://localhost:4815/api/user/tom/feed";
                            cred = makeCred(cl, pair);
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, posted, result) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, posted);
                            }
                        }
                    );
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "results are valid": function(err, act) {
                    assert.ifError(err);
                    actutil.validActivity(act);
                },
                "results are correct": function(err, act) {
                    assert.ifError(err);
                    assert.equal(act.verb, "follow");
                }
            },
            "and one user follows a person who then posts": {
                topic: function(cl) {
                    var cb = this.callback,
                        users = {jack: {}, jill: {}},
                        postnote;

                    Step(
                        function() {
                            register(cl, "jack", "up|the|hill", this.parallel());
                            register(cl, "jill", "pail/of/water", this.parallel());
                        },
                        function(err, user1, user2) {

                            var act, url, cred;

                            if (err) throw err;
                            users.jack.profile = user1.profile;
                            users.jill.profile = user2.profile;
                            users.jack.pair = pairOf(user1);
                            users.jill.pair = pairOf(user2);

                            act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: users.jill.profile.id
                                }
                            };

                            url = "http://localhost:4815/api/user/jack/feed";

                            cred = makeCred(cl, users.jack.pair);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, posted, result) {
                            if (err) throw err;
                            var act = {
                                verb: "post",
                                to: [{
                                    id: "http://localhost:4815/api/user/jill/followers",
                                    objectType: "collection"
                                }],
                                object: {
                                    objectType: "note",
                                    content: "Hello, world."
                                }
                            },
                                url = "http://localhost:4815/api/user/jill/feed",
                                cred = makeCred(cl, users.jill.pair);
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, posted, result) {
                            if (err) throw err;
                            postnote = posted;
                            var url = "http://localhost:4815/api/user/jack/inbox",
                                cred = makeCred(cl, users.jack.pair),
                                callback = this;

                            // Need non-zero time for async distribution
                            // to work. 2s seems reasonable for unit test.

                            setTimeout(function() {
                                httputil.getJSON(url, cred, callback);
                            }, 2000);
                        },
                        function(err, doc, result) {
                            if (err) {
                                cb(err, null, null);
                            } else {
                                cb(null, doc, postnote);
                            }
                        }
                    );
                },
                "it works": function(err, inbox, postnote) {
                    assert.ifError(err);
                },
                "posted item goes to inbox": function(err, inbox, postnote) {
                    assert.ifError(err);
                    assert.isObject(inbox);
                    assert.include(inbox, "totalItems");
                    assert.isNumber(inbox.totalItems);
                    assert.greater(inbox.totalItems, 0);
                    assert.include(inbox, "items");
                    assert.isArray(inbox.items);
                    assert.greater(inbox.items.length, 0);
                    assert.isObject(inbox.items[0]);
                    assert.include(inbox.items[0], "id");
                    assert.isObject(postnote);
                    assert.include(postnote, "id");
                    assert.equal(inbox.items[0].id, postnote.id);
                }
            },
            "and a user posts a person to their following stream": {
                topic: function(cl) {
                    var cb = this.callback,
                        users = {abbott: {}, costello: {}};

                    Step(
                        function() {
                            register(cl, "abbott", "what's|the|name", this.parallel());
                            register(cl, "costello", "who's+on+3rd", this.parallel());
                        },
                        function(err, user1, user2) {
                            var url, cred;
                            if (err) throw err;
                            users.abbott.profile = user1.profile;
                            users.costello.profile = user2.profile;
                            users.abbott.pair = pairOf(user1);
                            users.costello.pair = pairOf(user2);

                            url = "http://localhost:4815/api/user/abbott/following";
                            cred = makeCred(cl, users.abbott.pair);

                            httputil.postJSON(url, cred, users.costello.profile, this);
                        },
                        function(err, posted, result) {
                            cb(err, posted, users);
                        }
                    );
                },
                "it works": function(err, posted, users) {
                    assert.ifError(err);
                },
                "posted item is person": function(err, posted, users) {
                    assert.ifError(err);
                    assert.isObject(posted);
                    assert.include(posted, "id");
                    assert.equal(users.costello.profile.id, posted.id);
                },
                "and we check the user's following stream": {
                    topic: function(posted, users, cl) {
                        var cb = this.callback,
                            url = "http://localhost:4815/api/user/abbott/following",
                            cred = makeCred(cl, users.abbott.pair);
                        
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                cb(err, doc);
                            });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it includes the followed user": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.greater(feed.items.length, 0);
                        assert.isObject(feed.items[0]);
                        assert.equal("costello", feed.items[0].displayName);
                    }
                },
                "and we check the user's activity feed": {
                    topic: function(posted, users, cl) {
                        var cb = this.callback,
                            url = "http://localhost:4815/api/user/abbott/feed",
                            cred = makeCred(cl, users.abbott.pair);
                        
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                cb(err, doc);
                            });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it includes the follow activity": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.greater(feed.items.length, 0);
                        assert.isObject(feed.items[0]);
                        assert.include(feed.items[0], "verb");
                        assert.equal("follow", feed.items[0].verb);
                        assert.include(feed.items[0], "object");
                        assert.isObject(feed.items[0].object);
                        assert.include(feed.items[0].object, "displayName");
                        assert.equal("costello", feed.items[0].object.displayName);
                        assert.include(feed.items[0].object, "objectType");
                        assert.equal("person", feed.items[0].object.objectType);
                    }
                }
            },
            "and a user posts to someone else's following stream": {
                topic: function(cl) {
                    var cb = this.callback,
                        users = {laurel: {}, hardy: {}, cop: {}};

                    Step(
                        function() {
                            register(cl, "laurel", "b0wler*HAT", this.parallel());
                            register(cl, "hardy", "n0w,st4nley...", this.parallel());
                            register(cl, "cop", "what's|the|hubbub", this.parallel());
                        },
                        function(err, user1, user2, user3) {
                            var url, cred;
                            if (err) throw err;
                            users.laurel.profile = user1.profile;
                            users.hardy.profile = user2.profile;
                            users.cop.profile = user3.profile;

                            users.laurel.pair = pairOf(user1);
                            users.hardy.pair = pairOf(user2);
                            users.cop.pair = pairOf(user3);

                            url = "http://localhost:4815/api/user/hardy/following";
                            cred = makeCred(cl, users.laurel.pair);

                            httputil.postJSON(url, cred, users.cop.profile, this);
                        },
                        function(err, posted, result) {
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
                "it fails with a 401 error": function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite["export"](module);
