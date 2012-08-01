// list-api-test.js
//
// Test user collections of people
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
    http = require("http"),
    urlparse = require("url").parse,
    OAuth = require("oauth").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    register = oauthutil.register;

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

var assertValidActivity = function(act) {
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
};

var suite = vows.describe("list api test");

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
            "and we get the list of lists owned by a new user": {
                topic: function(cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            newPair(cl, "eekamouse", "bongbongdiggydiggydang", this);
                        },
                        function(err, pair) {
                            if (err) throw err;
                            var cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/eekamouse/lists";

                            httputil.getJSON(url, cred, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc);
                        }
                    );
                },
                "it works": function(err, lists) {
                    assert.ifError(err);
                },
                "it is valid": function(err, lists) {
                    assert.ifError(err);
                    assertValidList(lists, 0);
                }
            },
            "and a user creates a list": {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null;

                    Step(
                        function() {
                            newPair(cl, "yellowman", "nobodymove", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            var cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/yellowman/feed",
                                act = {
                                    verb: "post",
                                    object: {
                                        objectType: "collection",
                                        displayName: "Bad Boys",
                                        objectTypes: ["person"]
                                    }
                                };

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc, pair);
                        }
                    );
                },
                "it works": function(err, act, pair) {
                    assert.ifError(err);
                    assert.isObject(act);
                },
                "results look correct": function(err, act, pair) {
                    assert.include(act, "id");
                    assertValidActivity(act);
                },
                "object has correct data": function(err, act) {
                    assert.ifError(err);
                    assert.equal(act.object.objectType, "collection");
                    assert.equal(act.object.displayName, "Bad Boys");
                    assert.include(act.object, "members");
                    assert.isObject(act.object.members);
                    assert.include(act.object.members, "totalItems");
                    assert.equal(act.object.members.totalItems, 0);
                },
                "and we get the list of lists owned by the user": {
                    topic: function(act, pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = "http://localhost:4815/api/user/yellowman/lists";

                        httputil.getJSON(url, cred, function(err, doc, response) {
                            cb(err, doc, act.object);
                        });
                    },
                    "it works": function(err, lists, collection) {
                        assert.ifError(err);
                        assert.isObject(lists);
                    },
                    "it looks correct": function(err, lists, collection) {
                        assert.ifError(err);
                        assertValidList(lists, 1);
                        assert.include(lists, "objectTypes");
                        assert.isArray(lists.objectTypes);
                        assert.include(lists.objectTypes, "collection");
                    },
                    "it contains the new list": function(err, lists, collection) {
                        assert.ifError(err);
                        assert.include(lists, "items");
                        assert.isArray(lists.items);
                        assert.lengthOf(lists.items, 1);
                        assert.equal(lists.items[0].id, collection.id);
                    }
                }
            }
        }
    }
});

suite["export"](module);


