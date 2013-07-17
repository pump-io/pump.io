// distributor-remote-test-as-root.js
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
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    validActivity = actutil.validActivity,
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    setupApp = oauthutil.setupApp;

var suite = vows.describe("remote activity object test");

var serverOf = function(url) {
    var parts = urlparse(url);
    return parts.hostname;
};

var testLink = function(rel) {
    return function(err, body) {
        var annie = body.object;
        assert.isObject(annie);
        assert.isObject(annie.links);
        assert.isObject(annie.links[rel]);
        assert.isString(annie.links[rel].href);
        assert.equal(serverOf(annie.links[rel].href), "photo.localhost", "Mismatch on link " + rel);
    };
};

var testFeed = function(feed) {
    return function(err, body) {
        var annie = body.object;
        assert.isObject(annie);
        assert.isObject(annie.links);
        assert.isObject(annie[feed]);
        assert.isString(annie[feed].url);
        assert.equal(serverOf(annie[feed].url), "photo.localhost", "Mismatch on " + feed + " feed");
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
                        newCredentials("magazine", "t4steful", "social.localhost", 80, this.parallel());
                        newCredentials("annie", "glamourous*1", "photo.localhost", 80, this.parallel());
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
                    var url = "http://social.localhost/api/user/magazine/feed",
                        act = {
                            verb: "follow",
                            object: {
                                id: "acct:annie@photo.localhost",
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
});

suite["export"](module);
