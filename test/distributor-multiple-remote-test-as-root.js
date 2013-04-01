// distributor-multiple-remote-test-as-root.js
//
// Test distribution to two remote users on the same server
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

var suite = vows.describe("distributor multiple remote test");

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
        "and we register one user on one and two users on the other": {
            topic: function() {
                var callback = this.callback;
                Step(
                    function() {
                        newCredentials("alicecooper", "rock*g0d", "photo.localhost", 80, this.parallel());
                        newCredentials("garth", "party*on1", "social.localhost", 80, this.parallel());
                        newCredentials("wayne", "party*on2", "social.localhost", 80, this.parallel());
                    },
                    callback
                );
            },
            "it works": function(err, cred1, cred2, cred3) {
                assert.ifError(err);
                assert.isObject(cred1);
                assert.isObject(cred2);
                assert.isObject(cred3);
            },
            "and two users follows the first": {
                topic: function(cred1, cred2, cred3) {
                    var act = {
                            verb: "follow",
                            object: {
                                id: "acct:alicecooper@photo.localhost",
                                objectType: "person"
                            }
                        },
                        callback = this.callback;

                    Step(
                        function() {
                            pj("http://social.localhost/api/user/garth/feed", cred2, act, this.parallel());
                            pj("http://social.localhost/api/user/wayne/feed", cred3, act, this.parallel());
                        },
                        function(err, posted1, posted2) {
                            callback(err);
                        }
                    );
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we wait a second for delivery": {
                    topic: function() {
                        var callback = this.callback;
                        setTimeout(function() { callback(null); }, 1000);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and the first user posts an image": {
                        topic: function(cred1, cred2, cred3) {
                            var url = "http://photo.localhost/api/user/alicecooper/feed",
                                callback = this.callback,
                                post = {
                                    verb: "post",
                                    object: {
                                        objectType: "image",
                                        displayName: "My Photo"
                                    }
                                };
                            
                            pj(url, cred1, post, function(err, act, resp) {
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
                        "and we wait a second for delivery": {
                            topic: function() {
                                var callback = this.callback;
                                setTimeout(function() { callback(null); }, 1000);
                            },
                            "it works": function(err) {
                                assert.ifError(err);
                            },
                            "and we check the other users' inboxes": {
                                topic: function(posted, cred1, cred2, cred3) {
                                    var callback = this.callback;
                                    Step(
                                        function() {
                                            gj("http://social.localhost/api/user/garth/inbox", cred2, this.parallel());
                                            gj("http://social.localhost/api/user/wayne/inbox", cred3, this.parallel());
                                        },
                                        function(err, inbox2, inbox3) {
                                            callback(err, inbox2, inbox3, posted);
                                        }
                                    );
                                },
                                "it works": function(err, inbox2, inbox3, act) {
                                    assert.ifError(err);
                                    assert.isObject(inbox2);
                                    assert.isObject(inbox3);
                                    assert.isObject(act);
                                },
                                "they include the activity": function(err, inbox2, inbox3, act) {
                                    assert.ifError(err);
                                    assert.isObject(inbox2);
                                    assert.isObject(inbox3);
                                    assert.isObject(act);
                                    assert.include(inbox2, "items");
                                    assert.isArray(inbox2.items);
                                    assert.greater(inbox2.items.length, 0);
				    assert.isObject(_.find(inbox2.items, function(item) { return item.id == act.id }),
						    "Activity is not in first inbox");
                                    assert.include(inbox3, "items");
                                    assert.isArray(inbox3.items);
                                    assert.greater(inbox3.items.length, 0);
				    assert.isObject(_.find(inbox3.items, function(item) { return item.id == act.id }),
						    "Activity is not in second inbox");
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
