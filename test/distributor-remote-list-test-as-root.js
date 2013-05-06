// distributor-remote-list-test-as-root.js
//
// Test distribution to remote members of a local list
//
// Copyright 2013, E14N https://e14n.com/
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
    http = require("http"),
    querystring = require("querystring"),
    _ = require("underscore"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    validActivityObject = actutil.validActivityObject,
    validActivity = actutil.validActivity,
    validFeed = actutil.validFeed,
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    dialbackApp = require("./lib/dialback").dialbackApp,
    setupApp = oauthutil.setupApp;

var suite = vows.describe("distributor remote list test");

var serverOf = function(url) {
    var parts = urlparse(url);
    return parts.hostname;
};

suite.addBatch({
    "When we set up two apps": {
        topic: function() {
            var social, photo, callback = this.callback;
            Step(
                function() {
                    setupApp(80, "social.localhost", this.parallel());
                    setupApp(80, "photo.localhost", this.parallel());
                },
                function(err, social, photo) {
                    if (err) {
                        callback(err, null, null);
                    } else {
                        callback(null, social, photo);
                    }
                }
            );
        },
        "it works": function(err, social, photo) {
            assert.ifError(err);
        },
        teardown: function(social, photo) {
            if (social && social.close) {
                social.close();
            }
            if (photo && photo.close) {
                photo.close();
            }
        },
        "and we register one user on each": {
            topic: function() {
                var callback = this.callback;
                Step(
                    function() {
                        newCredentials("claire", "clean*water", "social.localhost", 80, this.parallel());
                        newCredentials("adam", "mustache*1", "photo.localhost", 80, this.parallel());
                    },
                    callback
                );
            },
            "it works": function(err, cred1, cred2) {
                assert.ifError(err);
                assert.isObject(cred1);
                assert.isObject(cred2);
            },
            "and one user adds the other to a list": {
                topic: function(cred1, cred2) {
                    var url = "http://social.localhost/api/user/claire/feed",
                        callback = this.callback,
                        list;

                    Step(
                        function() {
                            var act = {
                                verb: "create",
                                object: {
                                    objectType: "collection",
                                    displayName: "Lovers",
                                    objectTypes: ["person"]
                                }
                            };

                            pj(url, cred1, act, this);
                        },
                        function(err, create) {
                            var act;

                            if (err) throw err;

                            list = create.object;

                            act = {
                                verb: "add",
                                object: {
                                    id: "acct:adam@photo.localhost",
                                    objectType: "person"
                                },
                                target: list
                            };

                            pj(url, cred1, act, this);
                        },
                        function(err, add) {
                            
                            if (err) {
                                callback(err, null);
                            } else {
                                callback(err, list);
                            }
                        }
                    );
                },
                "it works": function(err, list) {
                    assert.ifError(err);
                    validActivityObject(list);
                },
                "and they send a note to that list": {
                    topic: function(list, cred1, cred2) {
                        var url = "http://social.localhost/api/user/claire/feed",
                            act = {
                                verb: "post",
                                to: [list],
                                object: {
                                    objectType: "note",
                                    content: "Hello."
                                }
                            },
                            callback = this.callback;

                        pj(url, cred1, act, function(err, body, resp) {
                            callback(err, body);
                        });
                    },
                    "it works": function(err, act) {
                        assert.ifError(err);
                        validActivity(act);
                    },
                    "and we wait a couple seconds for delivery": {
                        topic: function(post, list, cred1, cred2) {
                            var callback = this.callback;
                            setTimeout(function() {
                                callback(null);
                            }, 2000);
                        },
                        "it works": function(err) {
                            assert.ifError(err);
                        },
                        "and we check the second user's inbox": {
                            topic: function(post, list, cred1, cred2) {
                                var url = "http://photo.localhost/api/user/adam/inbox",
                                    callback = this.callback;
                                
                                gj(url, cred2, function(err, feed, resp) {
                                    if (err) {
                                        callback(err, null, null, null);
                                    } else {
                                        callback(null, feed, post, list);
                                    }
                                });
                            },
                            "it works": function(err, feed, post, list) {
                                assert.ifError(err);
                                validFeed(feed);
                                validActivity(post);
                            },
                            "it includes the activity": function(err, feed, post, list) {
                                assert.ifError(err);
                                assert.isObject(feed);
                                assert.isObject(post);
                                assert.include(feed, "items");
                                assert.isArray(feed.items);
                                assert.greater(feed.items.length, 0);
                                assert.isObject(_.find(feed.items, function(item) { return item.id == post.id; }));
                            }
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
