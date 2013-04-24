// group-api-test.js
//
// Test group API
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
    http = require("http"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    validActivity = actutil.validActivity,
    validActivityObject = actutil.validActivityObject,
    validFeed = actutil.validFeed,
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials;

var suite = vows.describe("Group API test");

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
        "and we get make a new user": {
            topic: function() {
                newCredentials("fafhrd", "lankhmar+1", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "and they create a group": {
                topic: function(cred) {
                    var callback = this.callback,
                        url = "http://localhost:4815/api/user/fafhrd/feed",
                        act = {
                            verb: "create",
                            object: {
                                objectType: "group",
                                displayName: "Barbarians",
                                summary: "A safe place for barbarians to share their feelings"
                            }
                        };

                    pj(url, cred, act, function(err, data, resp) {
                        callback(err, data);
                    });
                },
                "it works": function(err, data) {
                    assert.ifError(err);
                    validActivity(data);
                },
                "and we retrieve that group with the REST API": {
                    topic: function(act, cred) {
                        var callback = this.callback,
                            url = act.object.links.self.href;

                        gj(url, cred, function(err, data, resp) {
                            callback(err, data);
                        });
                    },
                    "it works": function(err, group) {
                        assert.ifError(err);
                        assert.isObject(group);
                    },
                    "it looks right": function(err, group) {
                        assert.ifError(err);
                        validActivityObject(group);
                    },
                    "it has a members feed": function(err, group) {
                        assert.ifError(err);
                        assert.isObject(group);
                        assert.include(group, "members");
                        assert.isObject(group.members);
                        assert.include(group.members, "url");
                        assert.isString(group.members.url);
                        assert.include(group.members, "totalItems");
                        assert.isNumber(group.members.totalItems);
                        assert.equal(group.members.totalItems, 0);
                    },
                    "it has an inbox feed": function(err, group) {
                        assert.ifError(err);
                        assert.isObject(group);
                        assert.include(group, "links");
                        assert.isObject(group.links);
                        assert.include(group.links, "activity-inbox");
                        assert.isObject(group.links["activity-inbox"]);
                        assert.include(group.links["activity-inbox"], "href");
                        assert.isString(group.links["activity-inbox"].href);
                    },
                    "and we get the members feed": {
                        topic: function(group, act, cred) {
                            var callback = this.callback,
                                url = group.members.url;

                            gj(url, cred, function(err, data, resp) {
                                callback(err, data);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it's empty": function(err, feed) {
                            assert.ifError(err);
                            assert.equal(feed.totalItems, 0);
                            assert.isTrue(!_.has(feed, "items") || (_.isArray(feed.items) && feed.items.length === 0));
                        }
                    },
                    "and we get the group inbox feed": {
                        topic: function(group, act, cred) {
                            var callback = this.callback,
                                url = group.links["activity-inbox"].href;

                            gj(url, cred, function(err, data, resp) {
                                callback(err, data);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it's empty": function(err, feed) {
                            assert.ifError(err);
                            assert.equal(feed.totalItems, 0);
                            assert.isTrue(!_.has(feed, "items") || (_.isArray(feed.items) && feed.items.length === 0));
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
