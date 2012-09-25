// share-activity-test.js
//
// Test sharing activities and objects
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
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken;

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var suite = vows.describe("share activity test");

// A batch to test sharing objects and activities

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
            "and one user shares another's activity": {
                topic: function(cl) {
                    var callback = this.callback,
                        users = [{nickname: "winken", password: "chee0Xie"},
                                 {nickname: "blinken", password: "Eihai8wo"},
                                 {nickname: "nod", password: "Xoo0aevu"}];

                    Step(
                        function() {
                            var i, group = this.group();
                            for (i = 0; i < users.length; i++) {
                                register(cl, users[i].nickname, users[i].password, group());
                            }
                        },
                        function(err, regd) {
                            var i, group;
                            if (err) throw err;
                            group = this.group();
                            for (i = 0; i < users.length; i++) {
                                users[i].profile = regd[i].profile;
                                accessToken(cl, users[i], group());
                            }
                        },
                        function(err, pairs) {
                            var i, act, url, cred;
                            if (err) throw err;
                            for (i = 0; i < users.length; i++) {
                                users[i].pair = pairs[i];
                            }
                            act = {
                                verb: "post",
                                object: {
                                    objectType: "note",
                                    content: "Yaaaaaaawwwwwn."
                                }
                            };
                            url = "http://localhost:4815/api/user/winken/feed";
                            cred = makeCred(cl, users[0].pair);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, posted, result) {
                            var act, url, cred;
                            if (err) throw err;
                            posted.objectType = "activity";
                            act = {
                                verb: "share",
                                object: posted
                            };
                            url = "http://localhost:4815/api/user/blinken/feed";
                            cred = makeCred(cl, users[1].pair);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, shared, result) {
                            if (err) throw err;
                            this(null, shared, users);
                        },
                        callback
                    );
                },
                "it works": function(err, share, users) {
                    assert.ifError(err);
                    assert.isObject(share);
                },
                "content looks right": function(err, share, users) {
                    assert.ifError(err);
                    assert.isObject(share);
                    assert.include(share, "actor");
                    assert.include(share, "verb");
                    assert.include(share, "object");
                    assert.isObject(share.actor);
                    assert.isString(share.verb);
                    assert.isObject(share.object);
                    assert.equal(share.verb, "share");
                    assert.equal(share.actor.id, users[1].profile.id);
                    assert.include(share.object, "id");
                    assert.include(share.object, "objectType");
                    assert.include(share.object, "verb");
                    assert.include(share.object, "actor");
                    assert.include(share.object, "object");
                    assert.equal(share.object.objectType, "activity");
                    assert.equal(share.object.verb, "post");
                    assert.isObject(share.object.actor);
                    assert.isObject(share.object.object);
                    assert.include(share.object.actor, "id");
                    assert.include(share.object.object, "objectType");
                    assert.equal(share.object.actor.id, users[0].profile.id);
                    assert.equal(share.object.object.objectType, "note");
                }
            }
        }
    }
});

suite["export"](module);