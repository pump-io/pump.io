// user-followers-api-test.js
//
// Test the user followers/following endpoints for the API
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
    http = require("http"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("underscore"),
    Queue = require("jankyqueue"),
    OAuth = require("oauth-evanp").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    register = oauthutil.register;

var suite = vows.describe("user followers API");

var invert = function(callback) {
    return function(err) {
        if (err) {
            callback(null);
        } else {
            callback(new Error("Unexpected success"));
        }
    };
};

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

var assertValidList = function(doc, total, count) {
    assert.include(doc, "author");
    assert.include(doc.author, "id");
    assert.include(doc.author, "displayName");
    assert.include(doc.author, "objectType");
    assert.include(doc, "totalItems");
    assert.include(doc, "items");
    assert.include(doc, "displayName");
    assert.include(doc, "url");
    assert.include(doc, "links");
    assert.include(doc.links, "current");
    assert.include(doc.links.current, "href");
    assert.include(doc.links, "self");
    assert.include(doc.links.self, "href");
    assert.include(doc, "objectTypes");
    assert.include(doc.objectTypes, "person");
    if (_(total).isNumber()) {
        assert.equal(doc.totalItems, total);
    }
    if (_(count).isNumber()) {
        assert.lengthOf(doc.items, count);
    }
};

suite.addBatch({

    "When we set up the app": {

        topic: function() {
            var cb = this.callback;
            setupApp(cb);
        },
        
        "it works": function(err, app) {
            assert.ifError(err);
            assert.isObject(app);
        },

        teardown: function(app) {
            if (app) {
                app.close();
            }
        },
        
        "and we create a new client": {
            topic: function() {
                newClient(this.callback);
            },

            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            
            "and we try to get followers for a non-existent user": {
                topic: function(cl) {
                    var cb = this.callback;
                    httputil.getJSON("http://localhost:4815/api/user/nonexistent/followers",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     function(err, followers, result) {
                                         if (err && err.statusCode && err.statusCode === 404) {
                                             cb(null);
                                         } else if (err) {
                                             cb(err);
                                         } else {
                                             cb(new Error("Unexpected success"));
                                         }
                                     });
                },

                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },

            "and we try to get following for a non-existent user": {
                topic: function(cl) {
                    var cb = this.callback;
                    httputil.getJSON("http://localhost:4815/api/user/nonexistent/following",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     function(err, followers, result) {
                                         if (err && err.statusCode && err.statusCode === 404) {
                                             cb(null);
                                         } else if (err) {
                                             cb(err);
                                         } else {
                                             cb(new Error("Unexpected success"));
                                         }
                                     });
                },

                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we register a user": {

                topic: function(cl) {
                    register(cl, "tyrion", "payURd3bts", this.callback);
                },

                "it works": function(err, user) {
                    assert.ifError(err);
                },

                "and we get the options on the user followers endpoint": 
                httputil.endpoint("/api/user/tyrion/followers", ["GET"]),

                "and we get the options on the user following endpoint": 
                httputil.endpoint("/api/user/tyrion/followers", ["GET"]),

                "and we GET the followers list without OAuth credentials": {
                    topic: function() {
                        var cb = this.callback,
                            options = {
                                host: "localhost",
                                port: 4815,
                                path: "/api/user/tyrion/followers"
                            };
                        http.get(options, function(res) {
                            if (res.statusCode >= 400 && res.statusCode < 500) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected status code"));
                            }
                        }).on("error", function(err) {
                            cb(err);
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we GET the followers list with invalid client credentials": {
                    topic: function(user, cl) {
                        httputil.getJSON("http://localhost:4815/api/user/tyrion/followers",
                                         {consumer_key: "NOTACLIENT", consumer_secret: "NOTASECRET"},
                                         invert(this.callback));
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we GET the followers list with client credentials and no access token": {
                    topic: function(user, cl) {
                        httputil.getJSON("http://localhost:4815/api/user/tyrion/followers",
                                         {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                         this.callback);
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                        assertValidList(doc, 0);
                    }
                },
                "and we GET the followers list with client credentials and an invalid access token": {
                    topic: function(user, cl) {
                        httputil.getJSON("http://localhost:4815/api/user/tyrion/followers",
                                         {consumer_key: cl.client_id,
                                          consumer_secret: cl.client_secret,
                                          token: "NOTATOKEN",
                                          token_secret: "NOTASECRET"},
                                         invert(this.callback));
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we GET the following list with client credentials and the same user's access token": {
                    topic: function(user, cl) {
                        var cb = this.callback,
                            pair = pairOf(user);
                        Step(
                            function() {
                                httputil.getJSON("http://localhost:4815/api/user/tyrion/following",
                                                 {consumer_key: cl.client_id,
                                                  consumer_secret: cl.client_secret,
                                                  token: pair.token,
                                                  token_secret: pair.token_secret},
                                                 this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    cb(null, results);
                                }
                            }
                        );
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                        assertValidList(doc, 0);
                    }
                },
                "and we GET the followers list with client credentials and the same user's access token": {
                    topic: function(user, cl) {
                        var cb = this.callback,
                            pair = pairOf(user);
                        Step(
                            function() {
                                httputil.getJSON("http://localhost:4815/api/user/tyrion/followers",
                                                 {consumer_key: cl.client_id,
                                                  consumer_secret: cl.client_secret,
                                                  token: pair.token,
                                                  token_secret: pair.token_secret},
                                                 this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    cb(null, results);
                                }
                            }
                        );
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                        assertValidList(doc, 0);
                    }
                },
                "and we GET the followers list with client credentials and a different user's access token": {
                    topic: function(user, cl) {
                        var cb = this.callback;
                        Step(
                            function() {
                                register(cl, "cersei", "i{heart}p0wer", this);
                            },
                            function(err, user2) {
                                var pair;
                                if (err) throw err;
                                pair = {token: user2.token,
                                        token_secret: user2.secret};
                                httputil.getJSON("http://localhost:4815/api/user/tyrion/followers",
                                                 {consumer_key: cl.client_id,
                                                  consumer_secret: cl.client_secret,
                                                  token: pair.token,
                                                  token_secret: pair.token_secret},
                                                 this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    cb(null, results);
                                }
                            }
                        );
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                        assertValidList(doc, 0);
                    }
                },
                "and we GET the following list without OAuth credentials": {
                    topic: function() {
                        var cb = this.callback,
                            options = {
                                host: "localhost",
                                port: 4815,
                                path: "/api/user/tyrion/following"
                            };
                        http.get(options, function(res) {
                            if (res.statusCode >= 400 && res.statusCode < 500) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected status code"));
                            }
                        }).on("error", function(err) {
                            cb(err);
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we GET the following list with invalid client credentials": {
                    topic: function(user, cl) {
                        httputil.getJSON("http://localhost:4815/api/user/tyrion/following",
                                         {consumer_key: "NOTACLIENT", consumer_secret: "NOTASECRET"},
                                         invert(this.callback));
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we GET the following list with client credentials and no access token": {
                    topic: function(user, cl) {
                        httputil.getJSON("http://localhost:4815/api/user/tyrion/following",
                                         {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                         this.callback);
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                        assertValidList(doc, 0);
                    }
                },
                "and we GET the following list with client credentials and an invalid access token": {
                    topic: function(user, cl) {
                        httputil.getJSON("http://localhost:4815/api/user/tyrion/following",
                                         {consumer_key: cl.client_id,
                                          consumer_secret: cl.client_secret,
                                          token: "NOTATOKEN",
                                          token_secret: "NOTASECRET"},
                                         invert(this.callback));
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we GET the following list with client credentials and a different user's access token": {
                    topic: function(user, cl) {
                        var cb = this.callback;
                        Step(
                            function() {
                                register(cl, "tywin", "c4st3rly*r0ck", this);
                            },
                            function(err, user2) {
                                var pair;
                                if (err) throw err;
                                pair = {token: user2.token,
                                        token_secret: user2.secret};
                                httputil.getJSON("http://localhost:4815/api/user/tyrion/following",
                                                 {consumer_key: cl.client_id,
                                                  consumer_secret: cl.client_secret,
                                                  token: pair.token,
                                                  token_secret: pair.token_secret},
                                                 this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    cb(null, results);
                                }
                            }
                        );
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                        assertValidList(doc, 0);
                    }
                }
            },
            "and one user follows another": {

                topic: function(cl) {
                    var cb = this.callback,
                        users,
                        pairs;

                    Step(
                        function() {
                            register(cl, "robb", "gr3yw1nd", this.parallel());
                            register(cl, "greatjon", "bl00dyt0ugh", this.parallel());
                        },
                        function(err, robb, greatjon) {
                            var act, url, cred;
                            if (err) throw err;

                            users = {
                                robb: robb,
                                greatjon: greatjon
                            };

                            pairs = {robb: pairOf(robb), greatjon: pairOf(greatjon)};

                            act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: users.robb.profile.id
                                },
                                mood: {
                                    displayName: "Raucous"
                                }
                            };
                            url = "http://localhost:4815/api/user/greatjon/feed";
                            cred = makeCred(cl, pairs.greatjon);

                            httputil.postJSON(url, cred, act, function(err, posted, result) {
                                if (err) {
                                    cb(err, null, null);
                                } else {
                                    cb(null, users, pairs);
                                }
                            });
                        }
                    );
                },
                "it works": function(err, users, pairs) {
                    assert.ifError(err);
                },
                "and we check the first user's following list": {
                    topic: function(users, pairs, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pairs.greatjon),
                            url = "http://localhost:4815/api/user/greatjon/following";
                        httputil.getJSON(url, cred, function(err, doc, results) {
                            cb(err, doc, users.robb.profile);
                        });
                    },
                    "it works": function(err, doc, person) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, doc, person) {
                        assert.ifError(err);
                        assertValidList(doc, 1);
                    },
                    "it contains the second person": function(err, doc, person) {
                        assert.ifError(err);
                        assert.equal(doc.items[0].id, person.id);
                        assert.equal(doc.items[0].objectType, person.objectType);
                    },
                    "the followed flag is set": function(err, doc, person) {
                        assert.ifError(err);
                        assert.includes(doc.items[0], "pump_io");
                        assert.isObject(doc.items[0].pump_io);
                        assert.includes(doc.items[0].pump_io, "followed");
                        assert.isTrue(doc.items[0].pump_io.followed);
                    }
                },
                "and we check the first user's followers list": {
                    topic: function(users, pairs, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pairs.greatjon),
                            url = "http://localhost:4815/api/user/greatjon/followers";
                        httputil.getJSON(url, cred, function(err, doc, results) {
                            cb(err, doc);
                        });
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, doc) {
                        assert.ifError(err);
                        assertValidList(doc, 0);
                    }
                },
                "and we check the second user's followers list": {
                    topic: function(users, pairs, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pairs.robb),
                            url = "http://localhost:4815/api/user/robb/followers";
                        httputil.getJSON(url, cred, function(err, doc, results) {
                            cb(err, doc, users.greatjon.profile);
                        });
                    },
                    "it works": function(err, doc, person) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, doc, person) {
                        assert.ifError(err);
                        assertValidList(doc, 1);
                    },
                    "it contains the first person": function(err, doc, person) {
                        assert.ifError(err);
                        assert.equal(doc.items[0].id, person.id);
                        assert.equal(doc.items[0].objectType, person.objectType);
                    },
                    "the followed flag is not set": function(err, doc, person) {
                        assert.ifError(err);
                        assert.includes(doc.items[0], "pump_io");
                        assert.isObject(doc.items[0].pump_io);
                        assert.includes(doc.items[0].pump_io, "followed");
                        assert.isFalse(doc.items[0].pump_io.followed);
                    }
                },
                "and we check the second user's following list": {
                    topic: function(users, pairs, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pairs.robb),
                            url = "http://localhost:4815/api/user/robb/following";
                        httputil.getJSON(url, cred, function(err, doc, results) {
                            cb(err, doc);
                        });
                    },
                    "it works": function(err, doc) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, doc) {
                        assert.ifError(err);
                        assertValidList(doc, 0);
                    }
                }
            },
            "and a lot of users follow one user": {

                topic: function(cl) {
                    var cb = this.callback,
                        user,
                        pair;

                    Step(
                        function() {
                            register(cl, "nymeria", "gr0000wl", this);
                        },
                        function(err, nymeria) {
                            var i, group = this.group(), q = new Queue(10);
                            if (err) throw err;
                            user = nymeria;
                            pair = pairOf(user);
                            for (i = 0; i < 100; i++) {
                                q.enqueue(newPair, [cl, "wolf" + i, "grrr!grrr!"+i], group());
                            }
                        },
                        function(err, pairs) {
                            var act, url, cred, i, group = this.group(), q = new Queue(10);
                            if (err) throw err;
                            act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: user.profile.id
                                }
                            };
                            for (i = 0; i < 100; i++) {
                                q.enqueue(httputil.postJSON, 
                                          ["http://localhost:4815/api/user/wolf"+i+"/feed",
                                           makeCred(cl, pairs[i]),
                                           act],
                                          group());
                            }
                        },
                        function(err, docs, responses) {
                            cb(err, pair);
                        }
                    );
                },
                "it works": function(err, pair) {
                    assert.ifError(err);
                },
                "and we get the tip of the followers feed": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/nymeria/followers",
                            cred = makeCred(cl, pair);
                        
                        httputil.getJSON(url, cred, function(err, doc, resp) {
                            callback(err, doc);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, feed) {
                        assert.ifError(err);
                        assertValidList(feed, 100, 20);
                    },
                    "it has a next link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "next");
                        assert.include(feed.links.next, "href");
                    },
                    "it has a prev link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "prev");
                        assert.include(feed.links.prev, "href");
                    },
                    "and we get the prev link": {
                        topic: function(feed, pair, cl) {
                            var callback = this.callback,
                                url = feed.links.prev.href,
                                cred = makeCred(cl, pair);
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                callback(err, doc);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assertValidList(feed, 100, 0);
                        }
                    },
                    "and we get the next link": {
                        topic: function(feed, pair, cl) {
                            var callback = this.callback,
                                url = feed.links.next.href,
                                cred = makeCred(cl, pair);
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                callback(err, doc);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assertValidList(feed, 100, 20);
                        }
                    }
                },
                "and we get a non-default count from the feed": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/nymeria/followers?count=40",
                            cred = makeCred(cl, pair);
                        
                        httputil.getJSON(url, cred, function(err, doc, resp) {
                            callback(err, doc);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, feed) {
                        assert.ifError(err);
                        assertValidList(feed, 100, 40);
                    },
                    "it has a next link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "next");
                        assert.include(feed.links.next, "href");
                    },
                    "it has a prev link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "prev");
                        assert.include(feed.links.prev, "href");
                    }
                },
                "and we get a very large count from the feed": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/nymeria/followers?count=200",
                            cred = makeCred(cl, pair);
                        
                        httputil.getJSON(url, cred, function(err, doc, resp) {
                            callback(err, doc);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, feed) {
                        assert.ifError(err);
                        assertValidList(feed, 100, 100);
                    },
                    "it has no next link": function(err, feed) {
                        assert.ifError(err);
                        assert.isFalse(_.has(feed.links, "next"));
                    },
                    "it has a prev link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "prev");
                        assert.include(feed.links.prev, "href");
                    }
                },
                "and we get an offset subset from the feed": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/nymeria/followers?offset=20",
                            cred = makeCred(cl, pair);
                        
                        httputil.getJSON(url, cred, function(err, doc, resp) {
                            callback(err, doc);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, feed) {
                        assert.ifError(err);
                        assertValidList(feed, 100, 20);
                    },
                    "it has a next link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "next");
                        assert.include(feed.links.next, "href");
                    },
                    "it has a prev link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "prev");
                        assert.include(feed.links.prev, "href");
                    },
                    "and we get the prev link": {
                        topic: function(feed, pair, cl) {
                            var callback = this.callback,
                                url = feed.links.prev.href,
                                cred = makeCred(cl, pair);
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                callback(err, doc);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assertValidList(feed, 100, 20);
                        }
                    },
                    "and we get the next link": {
                        topic: function(feed, pair, cl) {
                            var callback = this.callback,
                                url = feed.links.next.href,
                                cred = makeCred(cl, pair);
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                callback(err, doc);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assertValidList(feed, 100, 20);
                        }
                    }
                }
            },
            "and a user follows a lot of other users": {

                topic: function(cl) {
                    var cb = this.callback,
                        user,
                        pair;

                    Step(
                        function() {
                            register(cl, "varys", "i*hate*magic", this);
                        },
                        function(err, varys) {
                            var i, group = this.group();
                            if (err) throw err;
                            user = varys;
                            pair = pairOf(user);
                            for (i = 0; i < 50; i++) {
                                register(cl, "littlebird"+i, "sekrit!"+i, group());
                            }
                        },
                        function(err, users) {
                            var cred, i, group = this.group();
                            if (err) throw err;
                            cred = makeCred(cl, pair);
                            for (i = 0; i < 50; i++) {
                                httputil.postJSON("http://localhost:4815/api/user/varys/feed",
                                                  cred,
                                                  {
                                                      verb: "follow",
                                                      object: {
                                                          objectType: "person",
                                                          id: users[i].profile.id
                                                      }
                                                  },
                                                  group());
                            }
                        },
                        function(err, docs, responses) {
                            cb(err, pair);
                        }
                    );
                },
                "it works": function(err, pair) {
                    assert.ifError(err);
                },
                "and we get the tip of the following feed": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/varys/following",
                            cred = makeCred(cl, pair);
                        
                        httputil.getJSON(url, cred, function(err, doc, resp) {
                            callback(err, doc);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, feed) {
                        assert.ifError(err);
                        assertValidList(feed, 50, 20);
                    },
                    "it has a next link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "next");
                        assert.include(feed.links.next, "href");
                    },
                    "it has a prev link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "prev");
                        assert.include(feed.links.prev, "href");
                    },
                    "and we get the prev link": {
                        topic: function(feed, pair, cl) {
                            var callback = this.callback,
                                url = feed.links.prev.href,
                                cred = makeCred(cl, pair);
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                callback(err, doc);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assertValidList(feed, 50, 0);
                        }
                    },
                    "and we get the next link": {
                        topic: function(feed, pair, cl) {
                            var callback = this.callback,
                                url = feed.links.next.href,
                                cred = makeCred(cl, pair);
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                callback(err, doc);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assertValidList(feed, 50, 20);
                        }
                    }
                },
                "and we get a non-default count from the feed": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/varys/following?count=40",
                            cred = makeCred(cl, pair);
                        
                        httputil.getJSON(url, cred, function(err, doc, resp) {
                            callback(err, doc);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, feed) {
                        assert.ifError(err);
                        assertValidList(feed, 50, 40);
                    },
                    "it has a next link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "next");
                        assert.include(feed.links.next, "href");
                    },
                    "it has a prev link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "prev");
                        assert.include(feed.links.prev, "href");
                    }
                },
                "and we get a very large count from the feed": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/varys/following?count=50",
                            cred = makeCred(cl, pair);
                        
                        httputil.getJSON(url, cred, function(err, doc, resp) {
                            callback(err, doc);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, feed) {
                        assert.ifError(err);
                        assertValidList(feed, 50, 50);
                    },
                    "it has no next link": function(err, feed) {
                        assert.ifError(err);
                        assert.isFalse(_.has(feed.links, "next"));
                    },
                    "it has a prev link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "prev");
                        assert.include(feed.links.prev, "href");
                    }
                },
                "and we get an offset subset from the feed": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/varys/following?offset=20",
                            cred = makeCred(cl, pair);
                        
                        httputil.getJSON(url, cred, function(err, doc, resp) {
                            callback(err, doc);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it is valid": function(err, feed) {
                        assert.ifError(err);
                        assertValidList(feed, 50, 20);
                    },
                    "it has a next link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "next");
                        assert.include(feed.links.next, "href");
                    },
                    "it has a prev link": function(err, feed) {
                        assert.ifError(err);
                        assert.include(feed.links, "prev");
                        assert.include(feed.links.prev, "href");
                    },
                    "and we get the prev link": {
                        topic: function(feed, pair, cl) {
                            var callback = this.callback,
                                url = feed.links.prev.href,
                                cred = makeCred(cl, pair);
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                callback(err, doc);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assertValidList(feed, 50, 20);
                        }
                    },
                    "and we get the next link": {
                        topic: function(feed, pair, cl) {
                            var callback = this.callback,
                                url = feed.links.next.href,
                                cred = makeCred(cl, pair);
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                callback(err, doc);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assertValidList(feed, 50, 10);
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
