// default-recipient-test.js
//
// Test setting default recipients for an activity
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
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient;

var ignore = function(err) {};

var suite = vows.describe("Default recipient API test");

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

var clientCred = function(cl) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret
    };
};

// A batch for testing the visibility of bcc and bto addressing

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
            "and a user posts a new notice with no recipients": {
                topic: function(cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            newPair(cl, "mrrogers", "be*my*neighbour", this);
                        },
                        function(err, pair) {
                            var act, cred, url;
                            if (err) throw err;
                            cred = makeCred(cl, pair);
                            act = {
                                verb: "post",
                                object: {
                                    objectType: "note",
                                    content: "Hello, neighbour!"
                                }
                            };
                            url = "http://localhost:4815/api/user/mrrogers/feed";
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, act, resp) {
                            cb(err, act);
                        }
                    );
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "it is cc to followers only": function(err, act) {
                    assert.ifError(err);
                    assert.isObject(act);
                    assert.include(act, "cc");
                    assert.isArray(act.cc);
                    assert.lengthOf(act.cc, 1);
                    assert.isObject(act.cc[0]);
                    assert.include(act.cc[0], "objectType");
                    assert.equal(act.cc[0].objectType, "collection");
                    assert.include(act.cc[0], "id");
                    assert.equal(act.cc[0].id, "http://localhost:4815/api/user/mrrogers/followers");
                    assert.isFalse(act.hasOwnProperty("to"));
                    assert.isFalse(act.hasOwnProperty("bto"));
                    assert.isFalse(act.hasOwnProperty("bcc"));
                }
            },
            "and a user posts a comment in reply to a note with no recipients": {
                topic: function(cl) {
                    var cb = this.callback,
                        users = {xtheowl: {}, henrietta: {}};

                    Step(
                        function() {
                            register(cl, "xtheowl", "b3nfr4nkl1n", this.parallel());
                            register(cl, "henrietta", "meow|password|meow", this.parallel());
                        },
                        function(err, user1, user2) {
                            var act, cred, url;

                            if (err) throw err;

                            users.xtheowl.profile = user1.profile;
                            users.henrietta.profile = user2.profile;

                            users.xtheowl.pair = pairOf(user1);
                            users.henrietta.pair = pairOf(user2);

                            cred = makeCred(cl, users.xtheowl.pair);

                            act = {
                                verb: "post",
                                to: [{
                                    objectType: "person",
                                    id: users.henrietta.profile.id
                                }],
                                cc: [{
                                    id: "http://localhost:4815/api/user/xtheowl/followers",
                                    objectType: "collection"
                                }],
                                object: {
                                    objectType: "note",
                                    content: "Hello, neighbour."
                                }
                            };
                            url = "http://localhost:4815/api/user/xtheowl/feed";
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, act, resp) {
                            var reply, cred, url;
                            if (err) throw err;
                            cred = makeCred(cl, users.henrietta.pair);
                            reply = {
                                verb: "post",
                                object: {
                                    objectType: "comment",
                                    content: "Hello meow!",
                                    inReplyTo: act.object
                                }
                            };
                            url = "http://localhost:4815/api/user/henrietta/feed";
                            httputil.postJSON(url, cred, reply, this);
                        },
                        function(err, act, resp) {
                            cb(err, act, users);
                        }
                    );
                },
                "it works": function(err, act, users) {
                    assert.ifError(err);
                },
                "it is to original poster and cc other recipients": function(err, act, users) {
                    assert.ifError(err);
                    assert.isObject(act);
                    assert.include(act, "to");
                    assert.isArray(act.to);
                    assert.lengthOf(act.to, 1);
                    assert.isObject(act.to[0]);
                    assert.include(act.to[0], "objectType");
                    assert.equal(act.to[0].objectType, "person");
                    assert.include(act.to[0], "id");
                    assert.equal(users.xtheowl.profile.id, act.to[0].id);
                    assert.include(act, "cc");
                    assert.isArray(act.cc);
                    assert.lengthOf(act.cc, 1);
                    assert.isObject(act.cc[0]);
                    assert.include(act.cc[0], "objectType");
                    assert.equal(act.cc[0].objectType, "collection");
                    assert.include(act.cc[0], "id");
                    assert.equal(act.cc[0].id, "http://localhost:4815/api/user/xtheowl/followers");
                    assert.isFalse(act.hasOwnProperty("bto"));
                    assert.isFalse(act.hasOwnProperty("bcc"));
                }
            },
            "and a user deletes an image with no recipients": {
                topic: function(cl) {
                    var cb = this.callback,
                        cred,
                        url = "http://localhost:4815/api/user/elaine/feed";

                    Step(
                        function() {
                            newPair(cl, "elaine", "bo0merang", this);
                        },
                        function(err, pair) {
                            var act; 
                            if (err) throw err;
                            cred = makeCred(cl, pair);
                            act = {
                                verb: "post",
                                to: [{
                                    id: "http://localhost:4815/api/user/elaine/followers",
                                    objectType: "collection"
                                }],
                                object: {
                                    objectType: "image",
                                    id: "http://photo.example/elaine/1",
                                    fullImage: {
                                        url: "http://photo.example/elaine/1.jpg"
                                    }
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, act, resp) {
                            var del;
                            if (err) throw err;
                            del = {
                                verb: "delete",
                                object: act.object
                            };
                            httputil.postJSON(url, cred, del, this);
                        },
                        function(err, act, resp) {
                            cb(err, act);
                        }
                    );

                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "it is to followers": function(err, act) {
                    assert.ifError(err);
                    assert.isObject(act);
                    assert.include(act, "to");
                    assert.isArray(act.to);
                    assert.lengthOf(act.to, 1);
                    assert.isObject(act.to[0]);
                    assert.include(act.to[0], "objectType");
                    assert.equal(act.to[0].objectType, "collection");
                    assert.include(act.to[0], "id");
                    assert.equal(act.to[0].id, "http://localhost:4815/api/user/elaine/followers");
                    assert.isFalse(act.hasOwnProperty("cc"));
                    assert.isFalse(act.hasOwnProperty("bto"));
                    assert.isFalse(act.hasOwnProperty("bcc"));
                }
            },
            "and a user updates an image with no recipients": {
                topic: function(cl) {
                    var cb = this.callback,
                        cred,
                        url = "http://localhost:4815/api/user/tuesday/feed";

                    Step(
                        function() {
                            newPair(cl, "tuesday", "i*have*feelings", this);
                        },
                        function(err, pair) {
                            var act; 
                            if (err) throw err;
                            cred = makeCred(cl, pair);
                            act = {
                                verb: "post",
                                to: [{
                                    id: "http://localhost:4815/api/user/tuesday/followers",
                                    objectType: "collection"
                                }],
                                object: {
                                    objectType: "image",
                                    id: "http://photo.example/tuesday/1",
                                    fullImage: {
                                        url: "http://photo.example/tuesday/1.jpg"
                                    }
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, act, resp) {
                            var update, obj = act.object;
                            if (err) throw err;
                            obj.displayName = "Feelings";
                            update = {
                                verb: "update",
                                object: obj
                            };
                            httputil.postJSON(url, cred, update, this);
                        },
                        function(err, act, resp) {
                            cb(err, act);
                        }
                    );

                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "it is to followers": function(err, act) {
                    assert.ifError(err);
                    assert.isObject(act);
                    assert.include(act, "to");
                    assert.isArray(act.to);
                    assert.lengthOf(act.to, 1);
                    assert.isObject(act.to[0]);
                    assert.include(act.to[0], "objectType");
                    assert.equal(act.to[0].objectType, "collection");
                    assert.include(act.to[0], "id");
                    assert.equal(act.to[0].id, "http://localhost:4815/api/user/tuesday/followers");
                    assert.isFalse(act.hasOwnProperty("cc"));
                    assert.isFalse(act.hasOwnProperty("bto"));
                    assert.isFalse(act.hasOwnProperty("bcc"));
                }
            }
        }
    }
});

suite["export"](module);
