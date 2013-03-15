// user-list-test.js
//
// Test the API for the global list of registered users
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
    fs = require("fs"),
    path = require("path"),
    querystring = require("querystring"),
    version = require("../lib/version").version,
    OAuth = require("oauth-evanp").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp;

var suite = vows.describe("user list API");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var invert = function(callback) {
    return function(err) {
        if (err) {
            callback(null);
        } else {
            callback(new Error("Unexpected success"));
        }
    };
};

var assertGoodUser = function(user) {
    assert.include(user, "nickname");
    assert.include(user, "published");
    assert.include(user, "updated");
    assert.include(user, "profile");
    assert.include(user, "token");
    assert.include(user, "secret");
    assert.isObject(user.profile);
    assert.include(user.profile, "id");
    assert.include(user.profile, "objectType");
    assert.equal(user.profile.objectType, "person");
};

var register = function(cl, params, callback) {
    httputil.postJSON("http://localhost:4815/api/users", 
                      {consumer_key: cl.client_id, consumer_secret: cl.client_secret}, 
                      params,
                      callback);
};

var registerSucceed = function(params) {
    return {
        topic: function(cl) {
            register(cl, params, this.callback);
        },
        "it works": function(err, user, resp) {
            assert.ifError(err);
            assert.isObject(user);
        },
        "results are correct": function(err, user, resp) {
            assertGoodUser(user);
        }
    };
};

var registerFail = function(params) {
    return {
        topic: function(cl) {
            register(cl, params, invert(this.callback));
        },
        "it fails correctly": function(err) {
            assert.ifError(err);
        }
    };
};

var doubleRegisterSucceed = function(first, second) {
    return {
        topic: function(cl) {
            var user1, user2, cb = this.callback;

            Step(
                function() {
                    register(cl, first, this);
                },
                function(err, doc, res) {
                    if (err) throw err;
                    user1 = doc;
                    register(cl, second, this);
                },
                function(err, doc, res) {
                    if (err) throw err;
                    user2 = doc;
                    this(null);
                },
                function(err) {
                    if (err) {
                        cb(err, null);
                    } else {
                        cb(null, user1, user2);
                    }
                }
            );
        },
        "it works": function(err, user1, user2) {
            assert.ifError(err);
        },
        "user1 is correct": function(err, user1, user2) {
            assertGoodUser(user1);
        },
        "user2 is correct": function(err, user1, user2) {
            assertGoodUser(user2);
        }
    };
};

var doubleRegisterFail = function(first, second) {
    return {
        topic: function(cl) {
            var cb = this.callback;

            Step(
                function() {
                    register(cl, first, this);
                },
                function(err, doc, res) {
                    if (err) {
                        cb(err);
                        return;
                    }
                    register(cl, second, this);
                },
                function(err, doc, res) {
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
    };
};

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            var cb = this.callback;
            setupApp(cb);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we check the user list endpoint": {
            topic: function() {
                httputil.options("localhost", 4815, "/api/users", this.callback);
            },
            "it exists": function(err, allow, res, body) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
            },
            "it supports GET": function(err, allow, res, body) {
                assert.include(allow, "GET");
            },
            "it supports POST": function(err, allow, res, body) {
                assert.include(allow, "POST");
            }
        },
        "and we try to register a user with no OAuth credentials": {
            topic: function() {
                var cb = this.callback;
                httputil.postJSON("http://localhost:4815/api/users", {}, {nickname: "nocred", password: "nobadge"}, function(err, body, res) {
                    if (err && err.statusCode === 401) {
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
        "and we create a client using the api": {
            topic: function() {
                var cb = this.callback;
                httputil.post("localhost", 4815, "/api/client/register", {type: "client_associate"}, function(err, res, body) {
                    var cl;
                    if (err) {
                        cb(err, null);
                    } else {
                        try {
                            cl = JSON.parse(body);
                            cb(null, cl);
                        } catch (err) {
                            cb(err, null);
                        }
                    }
                });
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
                assert.isString(cl.client_id);
                assert.isString(cl.client_secret);
            },
            "and we register a user with nickname and password": 
            registerSucceed({nickname: "withcred", password: "very!secret"}),
            "and we register a user with nickname and no password": 
            registerFail({nickname: "nopass"}),
            "and we register a user with password and no nickname": 
            registerFail({password: "too+secret"}),
            "and we register a user with a short password": 
            registerFail({nickname: "shorty", password: "carpet"}),
            "and we register a user with an all-alpha password": 
            registerFail({nickname: "allalpha", password: "carpeted"}),
            "and we register a user with an all-numeric password": 
            registerFail({nickname: "allnumeric", password: "12345678"}),
            "and we register a user with a well-known bad password": 
            registerFail({nickname: "unoriginal", password: "rush2112"}),
            "and we register a user with no data": 
            registerFail({}),
            "and we register two unrelated users":
            doubleRegisterSucceed({nickname: "able", password: "i-sure-am"},
                                  {nickname: "baker", password: "flour'n'water"}),
            "and we register two users with the same nickname":
            doubleRegisterFail({nickname: "charlie", password: "parker69"},
                               {nickname: "charlie", password: "mccarthy69"}),
            "and we try to register with URL-encoded params": {
                topic: function(cl) {
                    var oa, toSend, cb = this.callback;

                    oa = new OAuth(null, // request endpoint N/A for 2-legged OAuth
                                   null, // access endpoint N/A for 2-legged OAuth
                                   cl.client_id, 
                                   cl.client_secret, 
                                   "1.0",
                                   null,
                                   "HMAC-SHA1",
                                   null, // nonce size; use default
                                   {"User-Agent": "pump.io/"+version});
                    
                    toSend = querystring.stringify({nickname: "delta", password: "dawn"});

                    oa.post("http://localhost:4815/api/users", null, null, toSend, "application/x-www-form-urlencoded", function(err, data, response) {
                        if (err) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    });
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
            setupApp(cb);
        },
        teardown: function(app) {
            app.close();
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we create a client using the api": {
            topic: function() {
                var cb = this.callback;
                httputil.post("localhost", 4815, "/api/client/register", {type: "client_associate"}, function(err, res, body) {
                    var cl;
                    if (err) {
                        cb(err, null);
                    } else {
                        try {
                            cl = JSON.parse(body);
                            cb(null, cl);
                        } catch (err) {
                            cb(err, null);
                        }
                    }
                });
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
                assert.isString(cl.client_id);
                assert.isString(cl.client_secret);
            },
            "and we get an empty user list": {
                topic: function(cl) {
                    var cb = this.callback;
                    httputil.getJSON("http://localhost:4815/api/users",
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     function(err, coll, resp) {
                                         cb(err, coll);
                                     });
                },
                "it works": function(err, collection) {
                    assert.ifError(err);
                },
                "it has the right top-level properties": function(err, collection) {
                    assert.isObject(collection);
                    assert.include(collection, "displayName");
                    assert.isString(collection.displayName);
                    assert.include(collection, "id");
                    assert.isString(collection.id);
                    assert.include(collection, "objectTypes");
                    assert.isArray(collection.objectTypes);
                    assert.lengthOf(collection.objectTypes, 1);
                    assert.include(collection.objectTypes, "user");
                    assert.include(collection, "totalItems");
                    assert.isNumber(collection.totalItems);
                    assert.include(collection, "items");
                    assert.isArray(collection.items);
                },
                "it is empty": function(err, collection) {
                    assert.equal(collection.totalItems, 0);
                    assert.isEmpty(collection.items);
                },
                "and we add a user": {
                    topic: function(ignore, cl) {
                        var cb = this.callback;
                        register(cl, {nickname: "echo", password: "echo!echo!"}, function(err, body, res) {
                            if (err) {
                                cb(err, null);
                            } else {
                                httputil.getJSON("http://localhost:4815/api/users",
                                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                                 function(err, coll, resp) {
                                                     cb(err, coll);
                                                 });
                            }
                        });
                    },
                    "it works": function(err, collection) {
                        assert.ifError(err);
                    },
                    "it has the right top-level properties": function(err, collection) {
                        assert.isObject(collection);
                        assert.include(collection, "displayName");
                        assert.isString(collection.displayName);
                        assert.include(collection, "id");
                        assert.isString(collection.id);
                        assert.include(collection, "objectTypes");
                        assert.isArray(collection.objectTypes);
                        assert.lengthOf(collection.objectTypes, 1);
                        assert.include(collection.objectTypes, "user");
                        assert.include(collection, "totalItems");
                        assert.isNumber(collection.totalItems);
                        assert.include(collection, "items");
                        assert.isArray(collection.items);
                    },
                    "it has one element": function(err, collection) {
                        assert.equal(collection.totalItems, 1);
                        assert.lengthOf(collection.items, 1);
                    },
                    "it has a valid user": function(err, collection) {
                        var user = collection.items[0];
                        assert.include(user, "nickname");
                        assert.include(user, "published");
                        assert.include(user, "updated");
                        assert.include(user, "profile");
                        assert.isObject(user.profile);
                        assert.include(user.profile, "id");
                        assert.include(user.profile, "objectType");
                        assert.equal(user.profile.objectType, "person");
                    },
                    "it has our valid user": function(err, collection) {
                        var user = collection.items[0];
                        assert.equal(user.nickname, "echo");
                    },
                    "and we add a few more users": {
                        topic: function(ignore1, ignore2, cl) {
                            var cb = this.callback;

                            Step(
                                function() {
                                    var i, group = this.group();
                                    for (i = 0; i < 49; i++) { // have 1 already, total = 50
                                        register(cl, {nickname: "foxtrot"+i, password: "a*bad*pass*"+i}, group());
                                    }
                                },
                                function(err) {
                                    if (err) throw err;
                                    httputil.getJSON("http://localhost:4815/api/users",
                                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                                     this);
                                },
                                function(err, collection, resp) {
                                    if (err) {
                                        cb(err, null);
                                    } else {
                                        cb(null, collection);
                                    }
                                }
                            );
                        },
                        "it works": function(err, collection) {
                            assert.ifError(err);
                        },
                        "it has the right top-level properties": function(err, collection) {
                            assert.isObject(collection);
                            assert.include(collection, "displayName");
                            assert.isString(collection.displayName);
                            assert.include(collection, "id");
                            assert.isString(collection.id);
                            assert.include(collection, "objectTypes");
                            assert.isArray(collection.objectTypes);
                            assert.lengthOf(collection.objectTypes, 1);
                            assert.include(collection.objectTypes, "user");
                            assert.include(collection, "totalItems");
                            assert.isNumber(collection.totalItems);
                            assert.include(collection, "items");
                            assert.isArray(collection.items);
                        },
                        "it has the right number of elements": function(err, collection) {
                            assert.equal(collection.totalItems, 50);
                            assert.lengthOf(collection.items, 20);
                        },
                        "it has the navigation links": function(err, collection) {
                            assert.ifError(err);
                            assert.isObject(collection);
                            assert.isObject(collection.links);
                            assert.isObject(collection.links.next);
                            assert.isObject(collection.links.prev);
                        },
                        "there are no duplicates": function(err, collection) {
                            var i, seen = {}, items = collection.items;
                            for (i = 0; i < items.length; i++) {
                                assert.isUndefined(seen[items[i].nickname]);
                                seen[items[i].nickname] = true;
                            }
                        },
                        "and we fetch all users": {
                            topic: function(ignore1, ignore2, ignore3, cl) {
                                var cb = this.callback;
                                httputil.getJSON("http://localhost:4815/api/users?count=50",
                                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                                 cb);
                            },
                            "it works": function(err, collection) {
                                assert.ifError(err);
                            },
                            "it has the right top-level properties": function(err, collection) {
                                assert.isObject(collection);
                                assert.include(collection, "displayName");
                                assert.isString(collection.displayName);
                                assert.include(collection, "id");
                                assert.isString(collection.id);
                                assert.include(collection, "objectTypes");
                                assert.isArray(collection.objectTypes);
                                assert.lengthOf(collection.objectTypes, 1);
                                assert.include(collection.objectTypes, "user");
                                assert.include(collection, "totalItems");
                                assert.isNumber(collection.totalItems);
                                assert.include(collection, "items");
                                assert.isArray(collection.items);
                            },
                            "it has the right number of elements": function(err, collection) {
                                assert.equal(collection.totalItems, 50);
                                assert.lengthOf(collection.items, 50);
                            },
                            "there are no duplicates": function(err, collection) {
                                var i, seen = {}, items = collection.items;
                                for (i = 0; i < items.length; i++) {
                                    assert.isUndefined(seen[items[i].nickname]);
                                    seen[items[i].nickname] = true;
                                }
                            }
                        },
                        "and we fetch all users in groups of 10": {
                            topic: function(ignore1, ignore2, ignore3, cl) {

                                var cb = this.callback;
                                Step(
                                    function() {
                                        var i, group = this.group();
                                        for (i = 0; i < 50; i += 10) {
                                            httputil.getJSON("http://localhost:4815/api/users?offset="+i+"&count=10",
                                                             {consumer_key: cl.client_id, 
                                                              consumer_secret: cl.client_secret},
                                                             group());
                                            }
                                    },
                                    function(err, collections) {
                                        var j, chunks = [];
                                        if (err) {
                                            cb(err, null);
                                        } else {
                                            for (j = 0; j < collections.length; j++) {
                                                chunks[j] = collections[j].items;
                                            }
                                            cb(null, chunks);
                                        }
                                    }
                                );
                            },
                            "it works": function(err, chunks) {
                                assert.ifError(err);
                            },
                            "it has the right number of elements": function(err, chunks) {
                                var i;
                                assert.lengthOf(chunks, 5);
                                for (i = 0; i < chunks.length; i++) {
                                    assert.lengthOf(chunks[i], 10);
                                }
                            },
                            "there are no duplicates": function(err, chunks) {
                                var i, j, seen = {};
                                for (i = 0; i < chunks.length; i++) {
                                    for (j = 0; j < chunks[i].length; j++) {
                                        assert.isUndefined(seen[chunks[i][j].nickname]);
                                        seen[chunks[i][j].nickname] = true;
                                    }
                                }
                            }
                        },
                        "and we fetch all users with the navigation links": {

                            topic: function(ignore1, ignore2, ignore3, cl) {

                                var cb = this.callback,
                                    all = [];

                                Step(
                                    function() {
                                        httputil.getJSON("http://localhost:4815/api/users",
                                                         {consumer_key: cl.client_id, 
                                                          consumer_secret: cl.client_secret},
                                                         this);
                                    },
                                    function(err, body, resp) {
                                        if (err) throw err;
                                        all = all.concat(body.items);
                                        httputil.getJSON(body.links.next.href, 
                                                         {consumer_key: cl.client_id, 
                                                          consumer_secret: cl.client_secret},
                                                         this);
                                    },
                                    function(err, body, resp) {
                                        if (err) throw err;
                                        all = all.concat(body.items);
                                        httputil.getJSON(body.links.next.href, 
                                                         {consumer_key: cl.client_id, 
                                                          consumer_secret: cl.client_secret},
                                                         this);
                                    },
                                    function(err, body, resp) {
                                        if (err) {
                                            cb(err, null);
                                        } else {
                                            all = all.concat(body.items);
                                            cb(null, all);
                                        }
                                    }
                                );
                            },
                            "it works": function(err, users) {
                                assert.ifError(err);
                            },
                            "it has the right number of elements": function(err, users) {
                                assert.ifError(err);
                                assert.lengthOf(users, 50);
                            },
                            "there are no duplicates": function(err, users) {
                                var i, j, seen = {};
                                assert.ifError(err);
                                for (i = 0; i < users.length; i++) {
                                    assert.isUndefined(seen[users[i].nickname]);
                                    seen[users[i].nickname] = true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);