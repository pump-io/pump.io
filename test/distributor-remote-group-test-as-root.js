// distributor-remote-group-test-as-root.js
//
// Test joining and posting to remote groups
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
    _ = require("underscore"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    setupApp = oauthutil.setupApp,
    validActivity = actutil.validActivity,
    validActivityObject = actutil.validActivityObject,
    validFeed = actutil.validFeed;

var suite = vows.describe("distributor remote group test");

var serverOf = function(url) {
    var parts = urlparse(url);
    return parts.hostname;
};

suite.addBatch({
    "When we set up three apps": {
        topic: function() {
            var social, photo, callback = this.callback;
            Step(
                function() {
                    setupApp(80, "social.localhost", this.parallel());
                    setupApp(80, "photo.localhost", this.parallel());
                    setupApp(80, "group.localhost", this.parallel());
                },
                function(err, social, photo, group) {
                    if (err) {
                        callback(err, null, null);
                    } else {
                        callback(null, social, photo, group);
                    }
                }
            );
        },
        "it works": function(err, social, photo) {
            assert.ifError(err);
        },
        teardown: function(social, photo, group) {
            if (social && social.close) {
                social.close();
            }
            if (photo && photo.close) {
                photo.close();
            }
            if (group && group.close) {
                group.close();
            }
        },
        "and we register one user on each": {
            topic: function() {
                var callback = this.callback;
                Step(
                    function() {
                        newCredentials("groucho", "in*my*pajamas", "group.localhost", 80, this.parallel());
                        newCredentials("harpo", "honk|honk", "photo.localhost", 80, this.parallel());
                        newCredentials("chico", "watsamattayuface?", "social.localhost", 80, this.parallel());
                    },
                    function(err, groucho, harpo, chico) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, {groucho: groucho, harpo: harpo, chico: chico});
                        }
                    }
                );
            },
            "it works": function(err, creds) {
                assert.ifError(err);
                assert.isObject(creds);
                assert.isObject(creds.groucho);
                assert.isObject(creds.harpo);
                assert.isObject(creds.chico);
            },
            "and one user creates a group": {
                topic: function(creds) {
                    var url = "http://group.localhost/api/user/groucho/feed",
                        act = {
                            verb: "create",
                            to: [{
                                id: "http://activityschema.org/collection/public",
                                objectType: "collection"
                            }],
                            object: {
                                objectType: "group",
                                displayName: "Marx Brothers"
                            }
                        },
                        callback = this.callback;
                    
                    pj(url, creds.groucho, act, function(err, body, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, body);
                        }
                    });
                },
                "it works": function(err, body) {
                    assert.ifError(err);
                    validActivity(body);
                },
                "and the other users join it": {
                    topic: function(createAct, creds) {
                        var callback = this.callback,
                            group = createAct.object;

                        Step(
                            function() {
                                var url = "http://photo.localhost/api/user/harpo/feed",
                                    act = {
                                        verb: "join",
                                        object: group
                                    };
                                pj(url, creds.harpo, act, this);
                            },
                            function(err, body, resp) {
                                if (err) throw err;
                                var url = "http://social.localhost/api/user/chico/feed",
                                    act = {
                                        verb: "join",
                                        object: group
                                    };
                                pj(url, creds.chico, act, this);
                            },
                            function(err, body, resp) {
                                callback(err);
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we wait a few seconds for delivery": {
                        topic: function() {
                            var callback = this.callback;
                            setTimeout(function() { callback(null); }, 2000);
                        },
                        "it works": function(err) {
                            assert.ifError(err);
                        },
                        "and we check the group members feed": {
                            topic: function(createAct, creds) {
                                var callback = this.callback,
                                    url = createAct.object.members.url;

                                gj(url, creds.groucho, function(err, feed, resp) {
                                    callback(err, feed);
                                });
                            },
                            "it works": function(err, feed) {
                                assert.ifError(err);
                                validFeed(feed);
                            },
                            "it includes our remote users": function(err, feed) {
                                assert.ifError(err);
                                assert.isObject(feed);
                                assert.include(feed, "items");
                                assert.isArray(feed.items);
                                assert.greater(feed.items.length, 0);
                                assert.isObject(_.find(feed.items, function(item) { return item.id == "acct:harpo@photo.localhost"; }));
                                assert.isObject(_.find(feed.items, function(item) { return item.id == "acct:chico@social.localhost"; }));
                            }
                        },
                        "and one user posts a message to the group": {
                            topic: function(createAct, creds) {
                                var callback = this.callback,
                                    group = createAct.object,
                                    url = "http://social.localhost/api/user/chico/feed",
                                    act = {
                                        verb: "post",
                                        to: [group],
                                        object: {
                                            objectType: "note",
                                            content: "You there, Pinky?"
                                        }
                                    };

                                pj(url, creds.chico, act, function(err, act, resp) {
                                    callback(err, act);
                                });
                            },
                            "it works": function(err, act) {
                                assert.ifError(err);
                                validActivity(act);
                            },
                            "and we wait a few seconds for delivery": {
                                topic: function() {
                                    var callback = this.callback;
                                    setTimeout(function() { callback(null); }, 2000);
                                },
                                "it works": function(err) {
                                    assert.ifError(err);
                                },
                                "and we check the other user's inbox": {
                                    topic: function(postAct, createAct, creds) {
                                        var url = "http://photo.localhost/api/user/harpo/inbox",
                                            callback = this.callback;
                                        gj(url, creds.harpo, function(err, feed, resp) {
                                            callback(err, feed, postAct);
                                        });
                                    },
                                    "it works": function(err, feed, act) {
                                        assert.ifError(err);
                                        validFeed(feed);
                                    },
                                    "the posted note is in the feed": function(err, feed, act) {
                                        assert.ifError(err);
                                        assert.isObject(feed);
                                        assert.include(feed, "items");
                                        assert.isArray(feed.items);
                                        assert.greater(feed.items.length, 0);
                                        assert.isObject(_.find(feed.items, function(item) { return item.id == act.id; }));
                                    }
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
