// repair-remote-person-as-root.js
//
// Test distribution to remote servers
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

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    http = require("http"),
    querystring = require("querystring"),
    _ = require("lodash"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    actutil = require("./lib/activity"),
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    validActivity = actutil.validActivity,
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    setupApp = apputil.setupApp;

var suite = vows.describe("remote activity object test");

var serverOf = function(url) {
    var parts = urlparse(url);
    return parts.hostname;
};

var testLink = function(rel) {
    return function(err, body) {
        var famous = body.object;
        assert.isObject(famous);
        assert.isObject(famous.links);
        assert.isObject(famous.links[rel]);
        assert.isString(famous.links[rel].href);
        assert.equal(serverOf(famous.links[rel].href), "photo.localhost", "Mismatch on link " + rel);
    };
};

var testFeed = function(feed) {
    return function(err, body) {
        var famous = body.object;
        assert.isObject(famous);
        assert.isObject(famous.links);
        assert.isObject(famous[feed]);
        assert.isString(famous[feed].url);
        assert.equal(serverOf(famous[feed].url), "photo.localhost", "Mismatch on " + feed + " feed");
    };
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
                        newCredentials("artshop", "co113t0rz", "social.localhost", 80, this.parallel());
                        newCredentials("famous", "glamourous*1", "photo.localhost", 80, this.parallel());
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
                    var url = "http://social.localhost/api/user/artshop/feed",
                        act = {
                            verb: "follow",
                            object: {
                                id: "acct:famous@photo.localhost",
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
                    validActivity(body);
                },
                "and we intentionally damage the remote person": {
                    topic: function(follow, cred1, cred2, social) {
                        social.changeObject({"id": "acct:famous@photo.localhost",
                                             "objectType": "person",
                                             "links": {
                                                 "self": {
                                                     "href": "http://social.localhost/api/person/AAAAAAAAAA"
                                                 }
                                             },
                                             "replies": {
                                                 "url": "http://social.localhost/api/person/AAAAAAAAAA/replies"
                                             },
                                             "likes": {
                                                 "url": "http://social.localhost/api/person/AAAAAAAAAA/likes"
                                             },
                                             "shares": {
                                                 "url": "http://social.localhost/api/person/AAAAAAAAAA/shares"
                                             }
                                            },
                                            this.callback);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we fetch the follow activity": {
                        topic: function(follow, cred1, cred2, social) {
                            var callback = this.callback;
                            gj(follow.links.self.href, cred1, function(err, body, resp) {
                                callback(err, body);
                            });
                        },
                        "it works": function(err, body) {
                            assert.ifError(err);
                            validActivity(body);
                        },
                        "the self link is correct": testLink("self"),
                        "the activity-inbox link is correct": testLink("activity-inbox"),
                        "the activity-outbox link is correct": testLink("activity-outbox"),
                        "the following feed is correct": testFeed("following"),
                        "the favorites feed is correct": testFeed("favorites"),
                        "the followers feed is correct": testFeed("followers"),
                        "the lists feed is correct": testFeed("lists")
                    }
                }
            }
        }
    }
});

module.exports = {}; // TODO reenable this test when it's passing

// suite["export"](module);
