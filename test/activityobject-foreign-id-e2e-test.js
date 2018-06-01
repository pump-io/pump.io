// activityobject-foreign-id-e2e-test.js
//
// Add an activity object with an externally-created ID
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

var suite = vows.describe("activityobject foreign id test");

// A batch to test activity objects with foreign IDs

suite.addBatch(
    withAppSetup({
        "and we register a user": {
            topic: function() {
                newCredentials("jesse", "chili*p!", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "and we GET the activity object endpoint with no ID parameter": {
                topic: function(cred) {
                    var cb = this.callback;
                    Step(
                        function() {
                            var url = "http://localhost:4815/api/image";
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
                "it fails correctly": function(err, image) {
                    assert.ifError(err);
                }
            },
            "and we GET the activity object endpoint with an ID that doesn't exist": {
                topic: function(cred) {
                    var cb = this.callback;
                    Step(
                        function() {
                            var url = "http://localhost:4815/api/image?id=tag:pump.io,2012:test:image:non-existent";
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
                "it fails correctly": function(err, image) {
                    assert.ifError(err);
                }
            },
            "and we create a new image with a foreign ID": {
                topic: function(cred) {
                    var cb = this.callback;
                    Step(
                        function() {
                            var url = "http://localhost:4815/api/user/jesse/feed",
                                activity = {
                                    "verb": "create",
                                    "object": {
                                        "objectType": "image",
                                        "id": "tag:pump.io,2012:test:image:1",
                                        "displayName": "Me and Emilio down by the schoolyard"
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
                    assert.equal(activity.object.links.self.href, "http://localhost:4815/api/image?id="+encodeURIComponent("tag:pump.io,2012:test:image:1"));
                },
                "its likes feed uses the foreign ID format": function(err, activity) {
                    assert.ifError(err);
                    assert.equal(activity.object.likes.url, "http://localhost:4815/api/image/likes?id="+encodeURIComponent("tag:pump.io,2012:test:image:1"));
                },
                "its replies feed uses the foreign ID format": function(err, activity) {
                    assert.ifError(err);
                    assert.equal(activity.object.replies.url, "http://localhost:4815/api/image/replies?id="+encodeURIComponent("tag:pump.io,2012:test:image:1"));
                },
                "its shares feed uses the foreign ID format": function(err, activity) {
                    assert.ifError(err);
                    assert.equal(activity.object.shares.url, "http://localhost:4815/api/image/shares?id="+encodeURIComponent("tag:pump.io,2012:test:image:1"));
                },
                "and we GET the image": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/image?id=tag:pump.io,2012:test:image:1";
                                httputil.getJSON(url, cred, this);
                            },
                            function(err, doc, response) {
                                cb(err, doc);
                            }
                        );
                    },
                    "it works": function(err, image) {
                        assert.ifError(err);
                    },
                    "it looks correct": function(err, image) {
                        assert.ifError(err);
                        validActivityObject(image);
                    }
                },
                "and we GET the image replies": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/image/replies?id=tag:pump.io,2012:test:image:1";
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
                "and we GET the image likes": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/image/likes?id=tag:pump.io,2012:test:image:1";
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
                "and we GET the image shares": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/image/shares?id=tag:pump.io,2012:test:image:1";
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
            "and we create another image with a foreign ID and comment on it": {
                topic: function(cred) {
                    var cb = this.callback,
                        url = "http://localhost:4815/api/user/jesse/feed";
                    Step(
                        function() {
                            var activity = {
                                "verb": "create",
                                "object": {
                                    "objectType": "image",
                                    "id": "tag:pump.io,2012:test:image:2",
                                    "displayName": "Mr. White yo"
                                }
                            };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var activity = {
                                "verb": "post",
                                "object": {
                                    "objectType": "comment",
                                    "content": "Nice picture!",
                                    "inReplyTo": {
                                        "objectType": "image",
                                        "id": "tag:pump.io,2012:test:image:2"
                                    }
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
                "and we GET the image replies": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/image/replies?id=tag:pump.io,2012:test:image:2";
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
            "and we create another image with a foreign ID and like it": {
                topic: function(cred) {
                    var cb = this.callback,
                        url = "http://localhost:4815/api/user/jesse/feed";
                    Step(
                        function() {
                            var activity = {
                                "verb": "create",
                                "object": {
                                    "objectType": "image",
                                    "id": "tag:pump.io,2012:test:image:3",
                                    "displayName": "Mike. He's OK."
                                }
                            };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var activity = {
                                "verb": "like",
                                "object": {
                                    "objectType": "image",
                                    "id": "tag:pump.io,2012:test:image:3"
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
                "and we GET the image likes": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/image/likes?id=tag:pump.io,2012:test:image:3";
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
                    "it's got our person": function(err, feed, act) {
                        assert.ifError(err);
                        assert.equal(feed.totalItems, 1);
                        assert.equal(feed.items.length, 1);
                        assert.isObject(feed.items[0]);
                        assert.equal(feed.items[0].id, act.actor.id);
                    }
                }
            },
            "and we create another image with a foreign ID and share it": {
                topic: function(cred) {
                    var cb = this.callback,
                        url = "http://localhost:4815/api/user/jesse/feed";
                    Step(
                        function() {
                            var activity = {
                                "verb": "create",
                                "object": {
                                    "objectType": "image",
                                    "id": "tag:pump.io,2012:test:image:4",
                                    "displayName": "Me playing Rage"
                                }
                            };
                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var activity = {
                                "verb": "share",
                                "object": {
                                    "objectType": "image",
                                    "id": "tag:pump.io,2012:test:image:4"
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
                "and we GET the shares": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var url = "http://localhost:4815/api/image/shares?id=tag:pump.io,2012:test:image:4";
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
                    "it's got our person": function(err, feed, act) {
                        assert.ifError(err);
                        assert.equal(feed.totalItems, 1);
                        assert.equal(feed.items.length, 1);
                        assert.isObject(feed.items[0]);
                        assert.equal(feed.items[0].id, act.actor.id);
                    }
                }
            }
        }
    })
);

suite["export"](module);
