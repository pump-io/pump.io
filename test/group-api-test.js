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
        "and we make a new user": {
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
        },
        "and we make another group": {
            topic: function() {
                var callback = this.callback,
                    url = "http://localhost:4815/api/user/graymouser/feed",
                    act = {
                        verb: "create",
                        to: [{
                            id: "http://activityschema.org/collection/public",
                            objectType: "collection"
                        }],
                        object: {
                            objectType: "group",
                            displayName: "Magicians",
                            summary: "Let's talk sorcery!"
                        }
                    },
                    cred;

                Step(
                    function() {
                        newCredentials("graymouser", "swords+_+_", this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        cred = results;
                        pj(url, cred, act, this);
                    },
                    function(err, data, resp) {
                        if (err) {
                            callback(err, null, null);
                        } else {
                            callback(null, data, cred);
                        }
                    }
                );
            },
            "it works": function(err, data, cred) {
                assert.ifError(err);
                validActivity(data);
            },
            "and another user tries to join it": {
                topic: function(created, cred) {
                    var callback = this.callback,
                        url = "http://localhost:4815/api/user/ningauble/feed",
                        act = {
                            verb: "join",
                            object: {
                                id: created.object.id,
                                objectType: created.object.objectType
                            }
                        },
                        newCred;

                    Step(
                        function() {
                            newCredentials("ningauble", "*iiiiiii*", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            newCred = results;
                            pj(url, newCred, act, this);
                        },
                        function(err, data, resp) {
                            if (err) {
                                callback(err, null, null);
                            } else {
                                callback(null, data, newCred);
                            }
                        }
                    );
                },
                "it works": function(err, data, cred) {
                    assert.ifError(err);
                    validActivity(data);
                },
		"and the creator checks the member feed": {
		    topic: function(joinAct, memberCred, createAct, creatorCred) {
                        var callback = this.callback,
                        url = joinAct.object.members.url,
			cred = creatorCred;

                        gj(url, cred, function(err, data, resp) {
                            callback(err, data, joinAct.actor);
                        });
                    },
                    "it works": function(err, feed, joiner) {
                        assert.ifError(err);
                        validFeed(feed);
                    },
                    "it's got our joined person": function(err, feed, joiner) {
                        assert.ifError(err);
                        assert.equal(feed.totalItems, 1);
                        assert.equal(feed.items.length, 1);
                        validActivityObject(feed.items[0]);
                        assert.equal(feed.items[0].id, joiner.id);
                    },
                    "and the member leaves the group": {
		        topic: function(feed, joiner, joinAct, memberCred, createAct, creatorCred) {
                            var callback = this.callback,
                                url = "http://localhost:4815/api/user/ningauble/feed",
                                cred = memberCred,
                                group = createAct.object,
                                act = {
                                    verb: "leave",
                                    object: {
                                        id: group.id,
                                        objectType: group.objectType
                                    }
                                };

                            Step(
                                function() {
                                    pj(url, cred, act, this);
                                },
                                function(err, data, resp) {
                                    if (err) {
                                        callback(err, null);
                                    } else {
                                        callback(null, data);
                                    }
                                }
                            );
                        },
                        "it works": function(err, data) {
                            assert.ifError(err);
                            validActivity(data);
                        }
                    }
		}
            }
        }
    }
});

suite["export"](module);
