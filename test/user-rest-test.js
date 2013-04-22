// user-rest-test.js
//
// Test the client registration API
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
    OAuth = require("oauth-evanp").OAuth,
    version = require("../lib/version").version,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    register = oauthutil.register;

var suite = vows.describe("user REST API");

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

var makeUserCred = function(cl, user) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: user.token,
        token_secret: user.secret
    };
};

var clientCred = function(cl) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret
    };
};

var invert = function(callback) {
    return function(err) {
        if (err) {
            callback(null);
        } else {
            callback(new Error("Unexpected success"));
        }
    };
};

var goodUser = function(err, doc) {

    var profile;

    assert.ifError(err);

    assert.isObject(doc);

    assert.include(doc, "nickname");
    assert.include(doc, "published");
    assert.include(doc, "updated");

    assert.include(doc, "profile");
    assert.isObject(doc.profile);

    profile = doc.profile;

    assert.include(doc.profile, "id");
    assert.include(doc.profile, "objectType");
    assert.equal(doc.profile.objectType, "person");

    assert.include(doc.profile, "favorites");
    assert.include(doc.profile, "followers");
    assert.include(doc.profile, "following");
    assert.include(doc.profile, "lists");

    assert.isFalse(_.has(doc.profile, "_uuid"));
    assert.isFalse(_.has(doc.profile, "_user"));

    assert.isFalse(_.has(doc.profile, "_user"));
};

suite.addBatch({

    "When we set up the app": {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            // sneaky, but we just need it for teardown
                            cl.app = app;
                            cb(err, cl);
                        }
                    });
                }
            });
        },

        "it works": function(err, cl) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (cl.app) {
                cl.app.close();
            }
        },

        "and we try to get a non-existent user": {

            topic: function(cl) {
                httputil.getJSON("http://localhost:4815/api/user/nonexistent",
                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                 invert(this.callback));
            },

            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },

        "and we register a user": {

            topic: function(cl) {
                register(cl, "zardoz", "this*is*my*gun", this.callback);
            },

            "it works": function(err, user) {
                assert.ifError(err);
            },

            "and we get the options on the user api endpoint": 
            httputil.endpoint("/api/user/zardoz", ["GET", "PUT", "DELETE"]),

            "and we GET the user data without OAuth credentials": {
                topic: function() {
                    var cb = this.callback,
                        options = {
                            host: "localhost",
                            port: 4815,
                            path: "/api/user/zardoz"
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
            "and we GET the user data with invalid client credentials": {
                topic: function(user, cl) {
                    httputil.getJSON("http://localhost:4815/api/user/zardoz",
                                     {consumer_key: "NOTACLIENT", consumer_secret: "NOTASECRET"},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we GET the user data with client credentials and no access token": {
                topic: function(user, cl) {
                    httputil.getJSON("http://localhost:4815/api/user/zardoz",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     this.callback);
                },
                "it works": function(err, doc) {
                    assert.ifError(err);
                    assert.include(doc, "nickname");
                    assert.include(doc, "published");
                    assert.include(doc, "updated");
                    assert.include(doc, "profile");
                    assert.isObject(doc.profile);
                    assert.include(doc.profile, "id");
                    assert.include(doc.profile, "objectType");
                    assert.equal(doc.profile.objectType, "person");
                    assert.isFalse(_.has(doc.profile, "_uuid"));
                    assert.isFalse(_.has(doc.profile, "_user"));
                }
            },
            "and we GET the user data with client credentials and an invalid access token": {
                topic: function(user, cl) {
                    httputil.getJSON("http://localhost:4815/api/user/zardoz",
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
            "and we GET the user data with client credentials and the same user's access token": {
                topic: function(user, cl) {
                    var cb = this.callback,
                        pair = pairOf(user);
                    Step(
                        function() {
                            httputil.getJSON("http://localhost:4815/api/user/zardoz",
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
                "it works": goodUser
            },
            "and we GET the user data with client credentials and a different user's access token": {
                topic: function(user, cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            register(cl, "yankee", "d0odle|d4ndy", this);
                        },
                        function(err, user2) {
                            var pair;
                            if (err) throw err;
                            pair = pairOf(user2);
                            httputil.getJSON("http://localhost:4815/api/user/zardoz",
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
                "it works": goodUser
            }
        }
    }
});

suite.addBatch({
    "When we set up the app": {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        "it works": function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },

        "and we try to put a non-existent user": {

            topic: function(cl) {
                httputil.putJSON("http://localhost:4815/api/user/nonexistent",
                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                 {nickname: "nonexistent", password: "whatever"},
                                 invert(this.callback));
            },

            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },

        "and we register a user": {

            topic: function(cl) {
                register(cl, "xerxes", "sparta!!", this.callback);
            },

            "it works": function(err, user) {
                assert.ifError(err);
            },

            "and we PUT new user data without OAuth credentials": {
                topic: function(user, cl) {
                    var cb = this.callback,
                        options = {
                            host: "localhost",
                            port: 4815,
                            path: "/api/user/xerxes",
                            method: "PUT",
                            headers: {
                                "User-Agent": "pump.io/"+version,
                                "Content-Type": "application/json"
                            }
                        };
                    var req = http.request(options, function(res) {
                        if (res.statusCode >= 400 && res.statusCode < 500) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected status code"));
                        }
                    }).on("error", function(err) {
                        cb(err);
                    });
                    req.write(JSON.stringify({nickname: "xerxes", password: "athens*1"}));
                    req.end();
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we PUT new user data with invalid client credentials": {
                topic: function(user, cl) {
                    httputil.putJSON("http://localhost:4815/api/user/xerxes",
                                     {consumer_key: "BADKEY", consumer_secret: "BADSECRET"},
                                     {nickname: "xerxes", password: "6|before|thebes"},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we PUT new user data with client credentials and no access token": {
                topic: function(user, cl) {
                    httputil.putJSON("http://localhost:4815/api/user/xerxes",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     {nickname: "xerxes", password: "corinth,also"},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we PUT new user data with client credentials and an invalid access token": {
                topic: function(user, cl) {
                    httputil.putJSON("http://localhost:4815/api/user/xerxes",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: "BADTOKEN", token_secret: "BADSECRET"},
                                     {nickname: "xerxes", password: "thessaly?"},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we PUT new user data with client credentials and a different user's access token": {
                topic: function(user, cl) {
                    var cb = this.callback;
                    
                    Step(
                        function() {
                            newPair(cl, "themistocles", "salamis!", this);
                        },
                        function(err, pair) {
                            if (err) {
                                cb(err);
                            } else {
                                httputil.putJSON("http://localhost:4815/api/user/xerxes",
                                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                                  token: pair.token, token_secret: pair.token_secret},
                                                 {nickname: "xerxes", password: "isuck!haha"},
                                                 invert(cb));
                            }
                        }
                    );
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we PUT new user data with client credentials and the same user's access token": {
                topic: function(user, cl) {
                    var cb = this.callback,
                        pair = pairOf(user);
                    httputil.putJSON("http://localhost:4815/api/user/xerxes",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: pair.token, token_secret: pair.token_secret},
                                     {nickname: "xerxes", password: "athens+1"},
                                     cb);
                },
                "it works": function(err, doc) {
                    assert.ifError(err);
                    assert.include(doc, "nickname");
                    assert.include(doc, "published");
                    assert.include(doc, "updated");
                    assert.include(doc, "profile");
                    assert.isObject(doc.profile);
                    assert.include(doc.profile, "id");
                    assert.include(doc.profile, "objectType");
                    assert.equal(doc.profile.objectType, "person");
                    assert.isFalse(_.has(doc.profile, "_uuid"));
                    assert.isFalse(_.has(doc.profile, "_user"));
                }
            }
        }
    }
});

suite.addBatch({
    "When we set up the app": {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        "it works": function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },
        "and we register a user": {
            topic: function(cl) {
                register(cl, "c3po", "ih8anakin", this.callback);
            },
            "it works": function(err, user) {
                assert.ifError(err);
            },
            "and we PUT third-party user data": {
                topic: function(user, cl) {
                    var cb = this.callback,
                        pair = pairOf(user);
                    httputil.putJSON("http://localhost:4815/api/user/c3po",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: pair.token, token_secret: pair.token_secret},
                                     {nickname: "c3po", password: "ih8anakin", langs: 6000000},
                                     function(err, body, res) {
                                         cb(err, body);
                                     });
                },
                "it works": function(err, res) {
                    assert.ifError(err);
                    assert.include(res, "langs");
                    assert.equal(res.langs, 6000000);
                },
                "and we GET user with third-party data": {
                    topic: function(dup, user, cl) {
                        var pair = pairOf(user);
                        httputil.getJSON("http://localhost:4815/api/user/c3po",
                                         {consumer_key: cl.client_id,
                                          consumer_secret: cl.client_secret,
                                          token: pair.token,
                                          token_secret: pair.token_secret},
                                         this.callback);
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                        assert.include(res, "langs");
                        assert.equal(res.langs, 6000000);
                    }
                }
            }
        }
    }
});

suite.addBatch({
    "When we set up the app": {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        "it works": function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },
        "and we register a user": {
            topic: function(cl) {
                register(cl, "willy", "w0nka+b4r", this.callback);
            },
            "it works": function(err, user) {
                assert.ifError(err);
            },
            "and we PUT a new nickname": {
                topic: function(user, cl) {
                    var pair = pairOf(user);
                    httputil.putJSON("http://localhost:4815/api/user/willy",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: pair.token, token_secret: pair.token_secret},
                                     {nickname: "william", password: "w0nka+b4r"},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we PUT a new published value": {
                topic: function(user, cl) {
                    var pair = pairOf(user);
                    httputil.putJSON("http://localhost:4815/api/user/willy",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: pair.token, token_secret: pair.token_secret},
                                     {nickname: "willy", password: "w0nka+b4r", published: "2001-11-10T00:00:00"},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we PUT a new updated value": {
                topic: function(user, cl) {
                    var pair = pairOf(user);
                    httputil.putJSON("http://localhost:4815/api/user/willy",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: pair.token, token_secret: pair.token_secret},
                                     {nickname: "willy", password: "w0nka+b4r", updated: "2003-11-10T00:00:00"},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we PUT a new profile": {
                topic: function(user, cl) {
                    var profile = {
                        objectType: "person",
                        id: "urn:uuid:8cec1280-28a6-4173-a523-2207ea964a2a"
                    };
                    var pair = pairOf(user);

                    httputil.putJSON("http://localhost:4815/api/user/willy",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: pair.token, token_secret: pair.token_secret},
                                     {nickname: "willy", password: "w0nka+b4r", profile: profile},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we PUT new profile data": {
                topic: function(user, cl) {
                    var profile = user.profile,
                        pair = pairOf(user);
                    profile.displayName = "William Q. Wonka";
                    httputil.putJSON("http://localhost:4815/api/user/willy",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: pair.token, token_secret: pair.token_secret},
                                     {nickname: "willy", password: "w0nka+b4r", profile: profile},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite.addBatch({
    "When we set up the app": {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        "it works": function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },
        "and we register a user": {
            topic: function(cl) {
                register(cl, "victor", "les+miz!", this.callback);
            },
            "it works": function(err, user) {
                assert.ifError(err);
            },
            "and we DELETE the user without OAuth credentials": {
                topic: function(user, cl) {
                    var cb = this.callback,
                        options = {
                            host: "localhost",
                            port: 4815,
                            path: "/api/user/victor",
                            method: "DELETE",
                            headers: {
                                "User-Agent": "pump.io/"+version
                            }
                        };
                    var req = http.request(options, function(res) {
                        if (res.statusCode >= 400 && res.statusCode < 500) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected status code"));
                        }
                    }).on("error", function(err) {
                        cb(err);
                    });
                    req.end();
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we DELETE the user with invalid client credentials": {
                topic: function(user, cl) {
                    httputil.delJSON("http://localhost:4815/api/user/victor",
                                     {consumer_key: "BADKEY", consumer_secret: "BADSECRET"},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we DELETE the user with client credentials and no access token": {
                topic: function(user, cl) {
                    httputil.delJSON("http://localhost:4815/api/user/victor",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     invert(this.callback));
                },
                "it works": function(err) {
                    assert.ifError(err);
                }
            },
            "and we DELETE the user with client credentials and an invalid access token": {
                topic: function(user, cl) {
                    httputil.delJSON("http://localhost:4815/api/user/victor",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: "BADTOKEN", token_secret: "BADSECRET"},
                                     invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we DELETE the user with client credentials and a different user's access token": {
                topic: function(user, cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            newPair(cl, "napoleon", "the+3rd!", this);
                        },
                        function(err, pair) {
                            if (err) {
                                cb(err);
                            } else {
                                httputil.delJSON("http://localhost:4815/api/user/victor",
                                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                                  token: pair.token, token_secret: pair.token_secret},
                                                 invert(cb));
                            }
                        }
                    );
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we DELETE the user with client credentials and the same user's access token": {
                topic: function(user, cl) {
                    var cb = this.callback,
                        pair = pairOf(user);
                    httputil.delJSON("http://localhost:4815/api/user/victor",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: pair.token, token_secret: pair.token_secret},
                                     cb);
                },
                "it works": function(err, body, result) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite.addBatch({

    "When we set up the app": {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        "it works": function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },
        "and we register two unrelated users": {
            topic: function(cl) {
                var callback = this.callback;
                Step(
                    function() {
                        register(cl, "philip", "of|macedon", this.parallel());
                        register(cl, "asoka", "in+india", this.parallel());
                    },
                    callback
                );
            },
            "it works": function(err, user1, user2) {
                assert.ifError(err);
                assert.isObject(user1);
                assert.isObject(user2);
            },
            "and we get the first user with client credentials": {
                topic: function(user1, user2, cl) {
                    var cred = clientCred(cl);
                    httputil.getJSON("http://localhost:4815/api/user/philip",
                                     cred,
                                     this.callback);
                },
                "it works": function(err, doc, resp) {
                    assert.ifError(err);
                },
                "profile has no pump_io member": function(err, doc, resp) {
                    assert.ifError(err);
                    assert.include(doc, "profile");
                    assert.isObject(doc.profile);
                    assert.isFalse(_.has(doc.profile, "pump_io"));
                }
            },
            "and we get the first user with his own credentials": {
                topic: function(user1, user2, cl) {
                    var cred = makeUserCred(cl, user1);
                    httputil.getJSON("http://localhost:4815/api/user/philip",
                                     cred,
                                     this.callback);
                },
                "it works": function(err, doc, resp) {
                    assert.ifError(err);
                },
                "the followed flag is false": function(err, doc, resp) {
                    assert.ifError(err);
                    assert.include(doc, "profile");
                    assert.isObject(doc.profile);
                    assert.include(doc.profile, "pump_io");
                    assert.isObject(doc.profile.pump_io);
                    assert.include(doc.profile.pump_io, "followed");
                    assert.isFalse(doc.profile.pump_io.followed);
                }
            },
            "and we get the first user with the second's credentials": {
                topic: function(user1, user2, cl) {
                    var cred = makeUserCred(cl, user2);
                    httputil.getJSON("http://localhost:4815/api/user/philip",
                                     cred,
                                     this.callback);
                },
                "it works": function(err, doc, resp) {
                    assert.ifError(err);
                },
                "the followed flag is false": function(err, doc, resp) {
                    assert.ifError(err);
                    assert.include(doc, "profile");
                    assert.isObject(doc.profile);
                    assert.include(doc.profile, "pump_io");
                    assert.isObject(doc.profile.pump_io);
                    assert.include(doc.profile.pump_io, "followed");
                    assert.isFalse(doc.profile.pump_io.followed);
                }
            }
        },
        "and we register two other users": {
            topic: function(cl) {
                var callback = this.callback;
                Step(
                    function() {
                        register(cl, "ramses", "phara0h!", this.parallel());
                        register(cl, "caesar", "don't-stab-me-bro", this.parallel());
                    },
                    callback
                );
            },
            "it works": function(err, user1, user2) {
                assert.ifError(err);
                assert.isObject(user1);
                assert.isObject(user2);
            },
            "and the second follows the first": {
                topic: function(user1, user2, cl) {
                    var callback = this.callback,
                        cred = makeUserCred(cl, user2),
                        act = {
                            verb: "follow",
                            object: user1.profile
                        };
                    Step(
                        function() {
                            httputil.postJSON("http://localhost:4815/api/user/caesar/feed",
                                              cred,
                                              act,
                                              this);
                        },
                        function(err, doc, response) {
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
                "and we get the first user with client credentials": {
                    topic: function(user1, user2, cl) {
                        var cred = clientCred(cl);
                        httputil.getJSON("http://localhost:4815/api/user/ramses",
                                         cred,
                                         this.callback);
                    },
                    "it works": function(err, doc, resp) {
                        assert.ifError(err);
                    },
                    "profile has no pump_io member": function(err, doc, resp) {
                        assert.ifError(err);
                        assert.include(doc, "profile");
                        assert.isObject(doc.profile);
                        assert.isFalse(_.has(doc.profile, "pump_io"));
                    }
                },
                "and we get the first user with his own credentials": {
                    topic: function(user1, user2, cl) {
                        var cred = makeUserCred(cl, user1);
                        httputil.getJSON("http://localhost:4815/api/user/ramses",
                                         cred,
                                         this.callback);
                    },
                    "it works": function(err, doc, resp) {
                        assert.ifError(err);
                    },
                    "the followed flag is false": function(err, doc, resp) {
                        assert.ifError(err);
                        assert.include(doc, "profile");
                        assert.isObject(doc.profile);
                        assert.include(doc.profile, "pump_io");
                        assert.isObject(doc.profile.pump_io);
                        assert.include(doc.profile.pump_io, "followed");
                        assert.isFalse(doc.profile.pump_io.followed);
                    }
                },
                "and we get the first user with the second's credentials": {
                    topic: function(user1, user2, cl) {
                        var cred = makeUserCred(cl, user2);
                        httputil.getJSON("http://localhost:4815/api/user/ramses",
                                         cred,
                                         this.callback);
                    },
                    "it works": function(err, doc, resp) {
                        assert.ifError(err);
                    },
                    "the followed flag is true": function(err, doc, resp) {
                        assert.ifError(err);
                        assert.include(doc, "profile");
                        assert.isObject(doc.profile);
                        assert.include(doc.profile, "pump_io");
                        assert.isObject(doc.profile.pump_io);
                        assert.include(doc.profile.pump_io, "followed");
                        assert.isTrue(doc.profile.pump_io.followed);
                    }
                }
            }
        }
    }
});

suite["export"](module);
