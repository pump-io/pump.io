// replies-api-test.js
//
// Test replies over the API
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
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    newCredentials = oauthutil.newCredentials;

var suite = vows.describe("Activity API test");

var assertGoodCred = function(cred) {
    assert.isObject(cred);
    assert.isString(cred.consumer_key);
    assert.isString(cred.consumer_secret);
    assert.isString(cred.token);
    assert.isString(cred.token_secret);
};

// A batch for testing the read-write access to the API

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
        "and we get new credentials": {
            topic: function() {
                newCredentials("macdonald", "the|old|flag", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assertGoodCred(cred);
            },
            "and we post a new activity": {
                topic: function(cred) {
                    var cb = this.callback,
                        act = {
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "The people would prefer John A. drunk to George Brown sober."
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/macdonald/feed", cred, act, function(err, act, response) {
                        cb(err, act);
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                    assert.isObject(act);
                },
                "the object includes a replies property": function(err, act) {
                    assert.ifError(err);
                    assert.isObject(act);
                    assert.includes(act, "object");
                    assert.isObject(act.object);
                    assert.includes(act.object, "replies");
                    assert.isObject(act.object.replies);
                    assert.includes(act.object.replies, "url");
                    assert.isString(act.object.replies.url);
                    assert.includes(act.object.replies, "totalItems");
                    assert.isNumber(act.object.replies.totalItems);
                    assert.equal(act.object.replies.totalItems, 0);
                },
                "and we fetch the replies feed": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            url = act.object.replies.url;

                        httputil.getJSON(url, cred, function(err, coll, response) {
                            cb(err, coll);
                        });
                    },
                    "it works": function(err, coll) {
                        assert.ifError(err);
                        assert.isObject(coll);
                    },
                    "it is an empty collection": function(err, coll) {
                        assert.ifError(err);
                        assert.isObject(coll);
                        assert.includes(coll, "url");
                        assert.isString(coll.url);
                        assert.includes(coll, "totalItems");
                        assert.isNumber(coll.totalItems);
                        assert.equal(coll.totalItems, 0);
                        assert.includes(coll, "items");
                        assert.isArray(coll.items);
                        assert.lengthOf(coll.items, 0);
                    }
                }
            }
        },
        "and we make two new sets of credentials": {
            topic: function() {
                Step(
                    function() {
                        newCredentials("mackenzie", "rail*road", this.parallel());
                        newCredentials("thompson", "bering*sea", this.parallel());
                    },
                    this.callback
                );
            },
            "it works": function(err, cred1, cred2) {
                assert.ifError(err);
                assertGoodCred(cred1);
                assertGoodCred(cred2);
            },
            "and we post a photo and a comment": {
                topic: function(cred1, cred2) {
                    var cb = this.callback,
                        photo;

                    Step(
                        function() {
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "image",
                                    url: "http://photos.example/1",
                                    summary: "New Parliament Buildings."
                                }
                            };
                            httputil.postJSON("http://localhost:4815/api/user/mackenzie/feed", cred1, act, this);
                        },
                        function(err, act, response) {
                            var reply;
                            if (err) throw err;
                            photo = act;
                            reply = {
                                verb: "post",
                                object: {
                                    objectType: "comment",
                                    content: "Nice one!",
                                    inReplyTo: act.object
                                }
                            };
                            httputil.postJSON("http://localhost:4815/api/user/thompson/feed", cred2, reply, this);
                        },
                        function(err, reply, response) {
                            cb(err, photo, reply);
                        }
                    );
                },
                "it works": function(err, photo, reply) {
                    assert.ifError(err);
                    assert.isObject(photo);
                    assert.isObject(reply);
                    assert.include(photo, "id");
                    assert.include(photo, "object");
                    assert.include(photo.object, "replies");
                    assert.include(photo.object.replies, "url");
                    assert.isString(photo.object.replies.url);
                    assert.include(reply, "object");
                    assert.include(reply.object, "inReplyTo");
                    assert.include(reply.object.inReplyTo, "id");
                    assert.equal(reply.object.inReplyTo.id, photo.object.id); 
                },
                "and we check the replies feed": {
                    topic: function(photo, reply, cred1, cred2) {
                        var cb = this.callback,
                            url = photo.object.replies.url;

                        httputil.getJSON(url, cred1, function(err, coll, response) {
                            cb(err, coll, reply);
                        });
                    },
                    "it works": function(err, coll, reply) {
                        assert.ifError(err);
                        assert.isObject(coll);
                    },
                    "it includes our reply": function(err, coll, reply) {
                        assert.ifError(err);
                        assert.isObject(coll);
                        assert.includes(coll, "totalItems");
                        assert.isNumber(coll.totalItems);
                        assert.equal(coll.totalItems, 1);
                        assert.includes(coll, "items");
                        assert.isArray(coll.items);
                        assert.lengthOf(coll.items, 1);
                        assert.equal(coll.items[0].id, reply.object.id);
                    },
                    "and we delete the reply and re-check the feed": {
                        topic: function(coll, reply, photo, replyAgain, cred1, cred2) {
                            var cb = this.callback;
                            
                            Step(
                                function() {
                                    httputil.delJSON(reply.object.id, cred2, this);
                                },
                                function(err, del, response) {
                                    if (err) throw err;
                                    var url = photo.object.replies.url;
                                    httputil.getJSON(url, cred1, this);
                                },
                                function(err, coll, response) {
                                    cb(err, coll);
                                }
                            );
                        },
                        "it works": function(err, coll) {
                            assert.ifError(err);
                            assert.isObject(coll);
                        },
                        "it is an empty collection": function(err, coll) {
                            assert.ifError(err);
                            assert.isObject(coll);
                            assert.includes(coll, "url");
                            assert.isString(coll.url);
                            assert.includes(coll, "totalItems");
                            assert.isNumber(coll.totalItems);
                            assert.equal(coll.totalItems, 0);
                            assert.includes(coll, "items");
                            assert.isArray(coll.items);
                            assert.lengthOf(coll.items, 0);
                        }
                    }
                }
            }
        },
        "and we make two more new sets of credentials": {
            topic: function() {
                Step(
                    function() {
                        newCredentials("laurier", "moderation!", this.parallel());
                        newCredentials("borden", "over there,", this.parallel());
                    },
                    this.callback
                );
            },
            "it works": function(err, cred1, cred2) {
                assert.ifError(err);
                assertGoodCred(cred1);
                assertGoodCred(cred2);
            },
            "and we post a note and a lot of comments": {

                topic: function(cred1, cred2) {
                    var cb = this.callback,
                        note;

                    Step(
                        function() {
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "note",
                                    summary: "I must get back to work."
                                }
                            };
                            httputil.postJSON("http://localhost:4815/api/user/laurier/feed", cred1, act, this);
                        },
                        function(err, act, response) {
                            var i, comment, group = this.group();
                            if (err) throw err;
                            note = act;
                            for (i = 0; i < 100; i++) {
                                comment = {
                                    verb: "post",
                                    object: {
                                        objectType: "comment",
                                        content: "FIRST POST",
                                        inReplyTo: act.object
                                    }
                                };
                                httputil.postJSON("http://localhost:4815/api/user/borden/feed",
                                                  cred2,
                                                  comment,
                                                  group());
                            }
                        },
                        function(err, comments, responses) {
                            cb(err, note, comments);
                        }
                    );
                },
                "it works": function(err, note, comments) {
                    assert.ifError(err);
                    assert.isObject(note);
                    assert.isArray(comments);
                    assert.lengthOf(comments, 100);
                },
                "and we get the full replies feed": {
                    topic: function(note, comments, cred1, cred2) {
                        var cb = this.callback,
                            url = note.object.replies.url + "?count=100";

                        httputil.getJSON(url, cred1, function(err, coll, response) {
                            cb(err, coll, comments);
                        });
                    },
                    "it works": function(err, coll, comments) {
                        assert.ifError(err);
                        assert.isObject(coll);
                        assert.isArray(comments);
                    },
                    "it has the right data": function(err, coll, comments) {
                        var i,
                            collIDs = {},
                            commentIDs = {};
                        assert.isObject(coll);
                        assert.includes(coll, "url");
                        assert.isString(coll.url);
                        assert.includes(coll, "totalItems");
                        assert.isNumber(coll.totalItems);
                        assert.equal(coll.totalItems, 100);
                        assert.includes(coll, "items");
                        assert.isArray(coll.items);
                        assert.lengthOf(coll.items, 100);

                        for (i = 0; i < 100; i++) {
                            collIDs[coll.items[i].id] = 1;
                            commentIDs[comments[i].object.id] = 1;
                        }

                        for (i = 0; i < 100; i++) {
                            assert.include(collIDs, comments[i].object.id);
                            assert.include(commentIDs, coll.items[i].id);
                        }
                    }
                },
                "and we get the original item": {
                    topic: function(note, comments, cred1, cred2) {
                        var cb = this.callback,
                            url = note.object.id;

                        httputil.getJSON(url, cred1, function(err, note, response) {
                            cb(err, note, comments);
                        });
                    },
                    "it works": function(err, note, comments) {
                        assert.ifError(err);
                        assert.isObject(note);
                        assert.isArray(comments);
                    },
                    "it has the correct replies": function(err, note, comments) {
                        var i, commentIDs = {};

                        assert.ifError(err);
                        assert.isObject(note);
                        assert.include(note, "replies");
                        assert.include(note.replies, "totalItems");
                        assert.isNumber(note.replies.totalItems);
                        assert.equal(note.replies.totalItems, 100);
                        assert.include(note.replies, "items");
                        assert.isArray(note.replies.items);

                        for (i = 0; i < 100; i++) {
                            commentIDs[comments[i].object.id] = 1;
                        }

                        for (i = 0; i < note.replies.items.length; i++) {
                            assert.include(commentIDs, note.replies.items[i].id);
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
