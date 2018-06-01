// group-foreign-id-e2e-test.js
//
// Add a group with an externally-created ID
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

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("lodash"),
    OAuth = require("oauth-evanp").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    actutil = require("./lib/activity"),
    withAppSetup = apputil.withAppSetup,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    newCredentials = oauthutil.newCredentials,
    validActivity = actutil.validActivity,
    validActivityObject = actutil.validActivityObject,
    validFeed = actutil.validFeed;

var suite = vows.describe("group foreign id test");

// A batch to test groups with foreign IDs

suite.addBatch(
    withAppSetup({
        "and we register a user": {
            topic: function() {
                newCredentials("walter", "he1s3nbe4g", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "and we GET the group endpoint with no ID parameter": {
                topic: function(cred) {
                    var cb = this.callback;
                    Step(
                        function() {
                            var url = "http://localhost:4815/api/group";
                            httputil.getJSON(url, cred, this);
                        },
                        function(err, doc, response) {
                            if (err && err.statusCode === 400) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails correctly": function(err, group) {
                    assert.ifError(err);
                }
            },
            "and we GET the group endpoint with an ID that doesn't exist": {
                topic: function(cred) {
                    var cb = this.callback;
                    Step(
                        function() {
                            var url = "http://localhost:4815/api/group?id=tag:pump.io,2012:test:group:non-existent";
                            httputil.getJSON(url, cred, this);
                        },
                        function(err, doc, response) {
                            if (err && err.statusCode === 404) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails correctly": function(err, group) {
                    assert.ifError(err);
                }
            },
            "and we create a new group with a foreign ID": {
                topic: function(cred) {
                    var cb = this.callback;
                    Step(
                        function() {
                            var url = "http://localhost:4815/api/user/walter/feed",
                                activity = {
                                    "verb": "create",
                                    "object": {
                                        "objectType": "group",
                                        "id": "tag:pump.io,2012:test:group:1",
                                        "displayName": "Friends"
                                    }
                                };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc);
                        }
                    );
                },
                "it works": function(err, activity) {
                    assert.ifError(err);
                },
                "it looks correct": function(err, activity) {
                    assert.ifError(err);
                    validActivity(activity);
                },
                "its self-link uses the foreign ID format": function(err, activity) {
                    assert.ifError(err);
                    assert.equal(activity.object.links.self.href, "http://localhost:4815/api/group?id="+encodeURIComponent("tag:pump.io,2012:test:group:1"));
                },
                "its members feed uses the foreign ID format": function(err, activity) {
                    assert.ifError(err);
                    assert.equal(activity.object.members.url, "http://localhost:4815/api/group/members?id="+encodeURIComponent("tag:pump.io,2012:test:group:1"));
                },
                "its inbox feed uses the foreign ID format": function(err, activity) {
                    assert.ifError(err);
                    assert.equal(activity.object.links["activity-inbox"].href, "http://localhost:4815/api/group/inbox?id="+encodeURIComponent("tag:pump.io,2012:test:group:1"));
                },
                "its documents feed uses the foreign ID format": function(err, activity) {
                    assert.ifError(err);
                    assert.equal(activity.object.documents.url, "http://localhost:4815/api/group/documents?id="+encodeURIComponent("tag:pump.io,2012:test:group:1"));
                },
                "and we GET the group": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/group?id=tag:pump.io,2012:test:group:1";
                                httputil.getJSON(url, cred, this);
                            },
                            function(err, doc, response) {
                                cb(err, doc);
                            }
                        );
                    },
                    "it works": function(err, group) {
                        assert.ifError(err);
                    },
                    "it looks correct": function(err, group) {
                        assert.ifError(err);
                        validActivityObject(group);
                    }
                },
                "and we GET the group members": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/group/members?id=tag:pump.io,2012:test:group:1";
                                httputil.getJSON(url, cred, this);
                            },
                            function(err, doc, response) {
                                cb(err, doc);
                            }
                        );
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
                "and we GET the group inbox": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/group/inbox?id=tag:pump.io,2012:test:group:1";
                                httputil.getJSON(url, cred, this);
                            },
                            function(err, doc, response) {
                                cb(err, doc);
                            }
                        );
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
                "and we GET the group documents feed": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/group/documents?id=tag:pump.io,2012:test:group:1";
                                httputil.getJSON(url, cred, this);
                            },
                            function(err, doc, response) {
                                cb(err, doc);
                            }
                        );
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
            },
            "and we create another group with a foreign ID and join it": {
                topic: function(cred) {
                    var cb = this.callback,
                        url = "http://localhost:4815/api/user/walter/feed";
                    Step(
                        function() {
                            var activity = {
                                "verb": "create",
                                "object": {
                                    "objectType": "group",
                                    "id": "tag:pump.io,2012:test:group:2",
                                    "displayName": "Family"
                                }
                            };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var activity = {
                                "verb": "join",
                                "object": {
                                    "objectType": "group",
                                    "id": "tag:pump.io,2012:test:group:2"
                                }
                            };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc);
                        }
                    );
                },
                "it works": function(err, activity) {
                    assert.ifError(err);
                },
                "it looks correct": function(err, activity) {
                    assert.ifError(err);
                    validActivity(activity);
                },
                "and we GET the group members": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/group/members?id=tag:pump.io,2012:test:group:2";
                                httputil.getJSON(url, cred, this);
                            },
                            function(err, doc, response) {
                                cb(err, doc);
                            }
                        );
                    },
                    "it works": function(err, feed) {
                        assert.ifError(err);
                        validFeed(feed);
                    },
                    "it's got one member": function(err, feed) {
                        assert.ifError(err);
                        assert.equal(feed.totalItems, 1);
                    }
                }
            },
            "and we create another group with a foreign ID and post to it": {
                topic: function(cred) {
                    var cb = this.callback,
                        url = "http://localhost:4815/api/user/walter/feed";
                    Step(
                        function() {
                            var activity = {
                                "verb": "create",
                                "object": {
                                    "objectType": "group",
                                    "id": "tag:pump.io,2012:test:group:3",
                                    "displayName": "Enemies"
                                }
                            };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var activity = {
                                "verb": "post",
                                "to": [{
                                    "objectType": "group",
                                    "id": "tag:pump.io,2012:test:group:3"
                                }],
                                "object": {
                                    "objectType": "note",
                                    "content": "I am the one who knocks."
                                }
                            };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc);
                        }
                    );
                },
                "it works": function(err, activity) {
                    assert.ifError(err);
                },
                "it looks correct": function(err, activity) {
                    assert.ifError(err);
                    validActivity(activity);
                },
                "and we GET the group inbox": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/group/inbox?id=tag:pump.io,2012:test:group:3";
                                httputil.getJSON(url, cred, this);
                            },
                            function(err, doc, response) {
                                cb(err, doc, act);
                            }
                        );
                    },
                    "it works": function(err, feed, act) {
                        assert.ifError(err);
                        validFeed(feed);
                    },
                    "it's got our activity": function(err, feed, act) {
                        assert.ifError(err);
                        assert.equal(feed.totalItems, 1);
                        assert.equal(feed.items.length, 1);
                        assert.isObject(feed.items[0]);
                        assert.equal(feed.items[0].id, act.id);
                    }
                }
            },
            "and we create another group with a foreign ID and post an image to it": {
                topic: function(cred) {
                    var cb = this.callback,
                        url = "http://localhost:4815/api/user/walter/feed";
                    Step(
                        function() {
                            var activity = {
                                "verb": "create",
                                "object": {
                                    "objectType": "group",
                                    "id": "tag:pump.io,2012:test:group:4",
                                    "displayName": "Criminals"
                                }
                            };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var activity = {
                                "verb": "join",
                                "object": {
                                    "objectType": "group",
                                    "id": "tag:pump.io,2012:test:group:4"
                                }
                            };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var activity = {
                                "verb": "post",
                                object: {
                                    id: "http://photo.example/heisenberg/me-making-meth.jpg",
                                    objectType: "image",
                                    displayName: "Ha ha ha",
                                    url: "http://photo.example/heisenberg/me-making-meth.jpg"
                                },
                                "target": {
                                    "objectType": "group",
                                    "id": "tag:pump.io,2012:test:group:4"
                                }
                            };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc);
                        }
                    );
                },
                "it works": function(err, activity) {
                    assert.ifError(err);
                },
                "it looks correct": function(err, activity) {
                    assert.ifError(err);
                    validActivity(activity);
                },
                "and we GET the documents feed": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/group/documents?id=tag:pump.io,2012:test:group:4";
                                httputil.getJSON(url, cred, this);
                            },
                            function(err, doc, response) {
                                cb(err, doc, act);
                            }
                        );
                    },
                    "it works": function(err, feed, act) {
                        assert.ifError(err);
                        validFeed(feed);
                    },
                    "it's got our activity": function(err, feed, act) {
                        assert.ifError(err);
                        assert.equal(feed.totalItems, 1);
                        assert.equal(feed.items.length, 1);
                        assert.isObject(feed.items[0]);
                        assert.equal(feed.items[0].id, act.object.id);
                    }
                }
            }
        }
    })
);

suite["export"](module);
