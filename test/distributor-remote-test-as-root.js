// distributor-remote-test-as-root.js
//
// Test distribution to remote servers
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
    http = require("http"),
    querystring = require("querystring"),
    _ = require("underscore"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    dialbackApp = require("./lib/dialback").dialbackApp,
    setupApp = oauthutil.setupApp;

var suite = vows.describe("distributor remote test");

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
                        newCredentials("maven", "tasteful", "social.localhost", 80, this.parallel());
                        newCredentials("photog", "gritty", "photo.localhost", 80, this.parallel());
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
                    var url = "http://social.localhost/api/user/maven/feed",
                        act = {
                            verb: "follow",
                            object: {
                                id: "acct:photog@photo.localhost",
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
                "and we check the first user's following list": {
                    topic: function(body, cred1, cred2) {
                        var url = "http://social.localhost/api/user/maven/following",
                            callback = this.callback;
                        
                        gj(url, cred1, function(err, body, resp) {
                            if (err) {
                                callback(err, null);
                            } else {
                                callback(null, body);
                            }
                        });
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                    },
                    "it includes the second user": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.lengthOf(feed.items, 1);
                        assert.isObject(feed.items[0]);
                        assert.include(feed.items[0], "id");
                        assert.equal(feed.items[0].id, "acct:photog@photo.localhost");
                    }
                },
                "and we check the second user's followers list": {
                    topic: function(body, cred1, cred2) {
                        var url = "http://photo.localhost/api/user/photog/followers",
                            callback = this.callback;

                        setTimeout(function() {
                            gj(url, cred2, function(err, body, resp) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    callback(null, body);
                                }
                            });
                        }, 5000);
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                        assert.isObject(feed);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.lengthOf(feed.items, 1);
                        assert.isObject(feed.items[0]);
                        assert.include(feed.items[0], "id");
                        assert.equal(feed.items[0].id, "acct:maven@social.localhost");
                    }
                }
            }
        }
    }
});

suite["export"](module);
