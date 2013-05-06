// note-api-test.js
//
// Test posting a note
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
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient;

var ignore = function(err) {};

var suite = vows.describe("Post note API test");

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

// A batch for testing the read access to the API

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
        "and we get a new client": {
            topic: function() {
                var cb = this.callback;
                newClient(function(err, cl) {
                    cb(err, cl);
                });
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and we make a new user": {
                topic: function(cl) {
                    var cb = this.callback;
                    register(cl, "frodo", "i{heart}sam", function(err, user) {
                        cb(err, user);
                    });
                },
                "it works": function(err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                },
                "and we post a note": {
                    topic: function(user, cl) {
                        var cb = this.callback,
                            pair = pairOf(user),
                            act = {
                                verb: "post",
                                object: {
                                    objectType: "note",
                                    content: "I'm so scared!"
                                }
                            },
                            cred = makeCred(cl, pair);
                        httputil.postJSON("http://localhost:4815/api/user/frodo/feed", cred, act, function(err, act, result) {
                            cb(err, act);
                        });
                    },
                    "it works": function(err, act) {
                        assert.ifError(err);
                    },
                    "results look right": function(err, act) {
                        assert.isObject(act);
                        assert.include(act, "id");
                        assert.isString(act.id);
                        assert.include(act, "actor");
                        assert.isObject(act.actor);
                        assert.include(act.actor, "id");
                        assert.isString(act.actor.id);
                        assert.include(act, "verb");
                        assert.isString(act.verb);
                        assert.include(act, "object");
                        assert.isObject(act.object);
                        assert.include(act.object, "id");
                        assert.isString(act.object.id);
                        assert.include(act, "published");
                        assert.isString(act.published);
                        assert.include(act, "updated");
                        assert.isString(act.updated);
                    },
                    "results are what we posted": function(err, act) {
                        assert.equal(act.verb, "post");
                        assert.equal(act.object.content, "I'm so scared!");
                        assert.equal(act.object.objectType, "note");
                    },
                    "and we check the actor": {
                        topic: function(act, user, cl) {
                            return {act: act, user: user};
                        },
                        "it matches our user": function(res) {
                            var act = res.act, user = res.user;
                            assert.equal(act.actor.id, user.profile.id);
                        }
                    },
                    "and we fetch the posted note": {
                        topic: function(act, user, cl) {
                            var cb = this.callback,
                                pair = pairOf(user),
                                cred = makeCred(cl, pair);
                            // ID == JSON representation URL
                            httputil.getJSON(act.object.id, cred, function(err, note) {
                                cb(err, note, act);
                            });
                        },
                        "it works": function(err, note, act) {
                            assert.ifError(err);
                            assert.isObject(note);
                        },
                        "results look right": function(err, note, act) {
                            assert.ifError(err);
                            assert.isObject(note);
                            assert.include(note, "id");
                            assert.isString(note.id);
                            assert.include(note, "published");
                            assert.isString(note.published);
                            assert.include(note, "updated");
                            assert.isString(note.updated);
                            assert.include(note, "author");
                            assert.isObject(note.author);
                            assert.include(note.author, "id");
                            assert.isString(note.author.id);
                            assert.include(note.author, "displayName");
                            assert.isString(note.author.displayName);
                            assert.include(note.author, "objectType");
                            assert.isString(note.author.objectType);
                        },
                        "results don't leak private members": function(err, note, act) {
                            assert.ifError(err);
                            assert.isObject(note);
                            assert.isFalse(_.has(note, "_uuid"));
                        },
                        "results are what we posted": function(err, note, act) {
                            assert.equal(note.content, "I'm so scared!");
                            assert.equal(note.objectType, "note");
                            assert.equal(note.id, act.object.id);
                            assert.equal(note.published, act.object.published);
                            assert.equal(note.updated, act.object.updated);
                            assert.equal(note.author.id, act.actor.id);
                            assert.equal(note.author.displayName, act.actor.displayName);
                            assert.equal(note.author.objectType, act.actor.objectType);
                        }
                    }
                }
            },
            "and we post a note and then delete it": {
                topic: function(cl) {
                    var callback = this.callback,
                        cred;
                    Step(
                        function() {
                            newPair(cl, "saruman", "orthanc1", this);
                        },
                        function(err, pair) {
                            var act;
                            if (err) throw err;
                            cred = makeCred(cl, pair);
                            act = {
                                verb: "post",
                                object: {
                                    objectType: "note",
                                    content: "How dare you!"
                                }
                            };

                            httputil.postJSON("http://localhost:4815/api/user/saruman/feed", cred, act, this);
                        },
                        function(err, post, result) {
                            if (err) throw err;
                            var del = {
                                verb: "delete",
                                object: post.object
                            };
                            httputil.postJSON("http://localhost:4815/api/user/saruman/feed", cred, del, this);
                        },
                        function(err, del, result) {
                            if (err) {
                                callback(err, null, null);
                            } else {
                                callback(null, del, cred);
                            }
                        }
                    );
                },
                "it works": function(err, del, cred) {
                    assert.ifError(err);
                },
                "and we retrieve the deleted note": {
                    topic: function(del, cred) {
                        var callback = this.callback,
                            url = del.object.id;
                        httputil.getJSON(url, cred, function(err, obj, res) {
                            if (err && err.statusCode == 410) {
                                callback(null);
                            } else if (err) {
                                callback(err);
                            } else {
                                callback(new Error("Unexpected success"));
                            }
                        });
                    },
                    "it is 410 Gone": function(err) {
                        assert.ifError(err);
                    }
                }
            },
            "and we post a note and then update it": {
                topic: function(cl) {
                    var callback = this.callback,
                        feed = "http://localhost:4815/api/user/radagast/feed",
                        cred;
                    Step(
                        function() {
                            newPair(cl, "radagast", "i+like+birds", this);
                        },
                        function(err, pair) {
                            var act;
                            if (err) throw err;
                            cred = makeCred(cl, pair);
                            act = {
                                verb: "post",
                                object: {
                                    objectType: "note",
                                    content: "I like squirrels."
                                }
                            };

                            httputil.postJSON(feed, cred, act, this);
                        },
                        function(err, post, result) {
                            if (err) throw err;
                            var upd = {
                                verb: "update",
                                object: {
                                    id: post.object.id,
                                    objectType: "note",
                                    content: "I like raccoons."
                                }
                            };
                            httputil.postJSON(feed, cred, upd, this);
                        },
                        function(err, upd, result) {
                            if (err) {
                                callback(err, null, null);
                            } else {
                                callback(null, upd, cred);
                            }
                        }
                    );
                },
                "it works": function(err, del, cred) {
                    assert.ifError(err);
                },
                "and we retrieve the updated note": {
                    topic: function(upd, cred) {
                        var callback = this.callback,
                            url = upd.object.id;
                        httputil.getJSON(url, cred, function(err, obj, res) {
                            callback(err, obj);
                        });
                    },
                    "it works": function(err, obj) {
                        assert.ifError(err);
                    },
                    "it has the updated content": function(err, obj) {
                        assert.ifError(err);
                        assert.isObject(obj);
                        assert.include(obj, "content");
                        assert.isString(obj.content);
                        assert.equal(obj.content, "I like raccoons.");
                    }
                }
            },
            "and we post a note and then PUT to it": {
                topic: function(cl) {
                    var callback = this.callback,
                        feed = "http://localhost:4815/api/user/merry/feed",
                        cred;
                    Step(
                        function() {
                            newPair(cl, "merry", "hobbit:weed", this);
                        },
                        function(err, pair) {
                            var act;
                            if (err) throw err;
                            cred = makeCred(cl, pair);
                            act = {
                                verb: "post",
                                object: {
                                    objectType: "note",
                                    content: "I like weed."
                                }
                            };

                            httputil.postJSON(feed, cred, act, this);
                        },
                        function(err, post, result) {
                            if (err) throw err;
                            var object = _(post.object).clone();
                            object.content = "I <strong>really</strong> like weed.";
                            httputil.putJSON(object.links.self.href, cred, object, this);
                        },
                        function(err, upd, result) {
                            if (err) {
                                callback(err, null, null);
                            } else {
                                callback(null, upd, cred);
                            }
                        }
                    );
                },
                "it works": function(err, upd, cred) {
                    assert.ifError(err);
                },
                "and we retrieve the updated note": {
                    topic: function(upd, cred) {
                        var callback = this.callback,
                            url = upd.links.self.href;
                        httputil.getJSON(url, cred, function(err, obj, res) {
                            callback(err, obj);
                        });
                    },
                    "it works": function(err, obj) {
                        assert.ifError(err);
                    },
                    "it has the updated content": function(err, obj) {
                        assert.ifError(err);
                        assert.isObject(obj);
                        assert.include(obj, "content");
                        assert.isString(obj.content);
                        assert.equal("I <strong>really</strong> like weed.", obj.content);
                    }
                },
                "and we retrieve the user's feed": {
                    topic: function(upd, cred) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/merry/feed";
                        httputil.getJSON(url, cred, function(err, obj, res) {
                            callback(err, obj);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it has the update activity": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.greater(feed.items.length, 0);
                        assert.isObject(feed.items[0]);
                        assert.include(feed.items[0], "verb");
                        assert.equal("update", feed.items[0].verb);
                        assert.include(feed.items[0], "object");
                        assert.include(feed.items[0].object, "id");
                        assert.equal(feed.items[0].object.id, feed.items[1].object.id);
                    }
                }
            },
            "and we post a note and then DELETE it": {
                topic: function(cl) {
                    var callback = this.callback,
                        feed = "http://localhost:4815/api/user/pippin/feed",
                        url,
                        cred;

                    Step(
                        function() {
                            newPair(cl, "pippin", "2nd*breakfast", this);
                        },
                        function(err, pair) {
                            var act;
                            if (err) throw err;
                            cred = makeCred(cl, pair);
                            act = {
                                verb: "post",
                                object: {
                                    objectType: "note",
                                    content: "I'm hungry."
                                }
                            };

                            httputil.postJSON(feed, cred, act, this);
                        },
                        function(err, post, result) {
                            if (err) throw err;
                            url = post.object.links.self.href;
                            httputil.delJSON(url, cred, this);
                        },
                        function(err, res, result) {
                            if (err) {
                                callback(err, null, null);
                            } else {
                                callback(null, url, cred);
                            }
                        }
                    );
                },
                "it works": function(err, url, cred) {
                    assert.ifError(err);
                },
                "and we retrieve the deleted note": {
                    topic: function(url, cred) {
                        var callback = this.callback;
                        httputil.getJSON(url, cred, function(err, obj, res) {
                            if (err && err.statusCode == 410) {
                                callback(null);
                            } else if (err) {
                                callback(err);
                            } else {
                                callback(new Error("Unexpected success!"));
                            }
                        });
                    },
                    "it is 410 Gone": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we retrieve the user's feed": {
                    topic: function(upd, cred) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/pippin/feed";
                        httputil.getJSON(url, cred, function(err, obj, res) {
                            callback(err, obj);
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                    },
                    "it has the delete activity": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.greater(feed.items.length, 0);
                        assert.isObject(feed.items[0]);
                        assert.include(feed.items[0], "verb");
                        assert.equal("delete", feed.items[0].verb);
                        assert.include(feed.items[0], "object");
                        assert.include(feed.items[0].object, "id");
                        assert.equal(feed.items[0].object.id, feed.items[1].object.id);
                    }
                }
            }
        }
    }
});

suite["export"](module);
