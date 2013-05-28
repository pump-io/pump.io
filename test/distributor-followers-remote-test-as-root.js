// distributor-followers-remote-test-as-root.js
//
// Test distribution to followers of a user
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
    http = require("http"),
    querystring = require("querystring"),
    _ = require("underscore"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    dialbackApp = require("./lib/dialback").dialbackApp,
    setupApp = oauthutil.setupApp;

var suite = vows.describe("distributor remote test");

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
                        newCredentials("fanatic", "give*me*that", "social.localhost", 80, this.parallel());
                        newCredentials("arbus", "shadowed*1", "photo.localhost", 80, this.parallel());
                    },
                    callback
                );
            },
            "it works": function(err, cred1, cred2) {
                assert.ifError(err);
                assert.isObject(cred1);
                assert.isObject(cred2);
            },
            "and one user follows the other": {
                topic: function(cred1, cred2) {
                    var url = "http://social.localhost/api/user/fanatic/feed",
                        act = {
                            verb: "follow",
                            object: {
                                id: "acct:arbus@photo.localhost",
                                objectType: "person"
                            }
                        },
                        callback = this.callback;
                    
                    pj(url, cred1, act, function(err, body, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, body);
                        }
                    });
                },
                "it works": function(err, body) {
                    assert.ifError(err);
                    assert.isObject(body);
                },
                "and we wait a few seconds for delivery": {
                    topic: function() {
                        var callback = this.callback;
                        setTimeout(function() { callback(null); }, 1000);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and the second user posts an image to followers": {
                        topic: function(act, cred1, cred2) {
                            var url = "http://photo.localhost/api/user/arbus/feed",
                                callback = this.callback,
                                post = {
                                    verb: "post",
                                    cc: [{objectType: "collection", id: "http://photo.localhost/api/user/arbus/followers"}],
                                    object: {
                                        objectType: "image",
                                        displayName: "My Photo"
                                    }
                                };
                            
                            pj(url, cred2, post, function(err, act, resp) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    callback(null, act);
                                }
                            });
                        },
                        "it works": function(err, act) {
                            assert.ifError(err);
                            assert.isObject(act);
                        },
                        "and we wait a few seconds for delivery": {
                            topic: function() {
                                var callback = this.callback;
                                setTimeout(function() { callback(null); }, 1000);
                            },
                            "it works": function(err) {
                                assert.ifError(err);
                            },
                            "and we check the first user's inbox": {
                                topic: function(posted, followed, cred1, cred2) {
                                    var callback = this.callback,
                                        url = "http://social.localhost/api/user/fanatic/inbox";
                                    gj(url, cred1, function(err, feed, resp) {
                                        if (err) {
                                            callback(err, null, null);
                                        } else {
                                            callback(null, feed, posted);
                                        }
                                    });
                                },
                                "it works": function(err, feed, act) {
                                    assert.ifError(err);
                                    assert.isObject(feed);
                                    assert.isObject(act);
                                },
                                "it includes the activity": function(err, feed, act) {
                                    assert.ifError(err);
                                    assert.isObject(feed);
                                    assert.isObject(act);
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
});

suite["export"](module);
