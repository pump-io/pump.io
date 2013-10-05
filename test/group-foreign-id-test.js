// group-foreign-id-test.js
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

var assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("underscore"),
    OAuth = require("oauth-evanp").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    newCredentials = oauthutil.newCredentials,
    validActivity = actutil.validActivity,
    validActivityObject = actutil.validActivityObject;

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var suite = vows.describe("group foreign id test");

// A batch to test groups with foreign IDs

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
                            if (err && err.statusCode == 400) {
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
                            if (err && err.statusCode == 404) {
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
                                        "id": "tag:pump.io,2012:test:group:1"
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
                }
            }
        }
    }
});

suite["export"](module);

