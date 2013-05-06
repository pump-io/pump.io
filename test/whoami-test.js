// whoami-test.js
//
// Test checking who you are
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
    _ = require("underscore"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient,
    register = oauthutil.register;

var ignore = function(err) {};
var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var suite = vows.describe("whoami api test");

// A batch to test following/unfollowing users

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
        "and we check the whoami endpoint": 
        httputil.endpoint("/api/whoami", ["GET"]),
        "and we get a new client": {
            topic: function() {
                newClient(this.callback);
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and we get a new pair": {
                topic: function(cl) {
                    newPair(cl, "crab", "pincers*69", this.callback);
                },
                "it works": function(err, cred) {
                    assert.ifError(err);
                    assert.isObject(cred);
                },
                "and we get the /api/whoami endpoint": {
                    topic: function(pair, cl) {
                        var cred = makeCred(cl, pair);
                        httputil.getJSON("http://localhost:4815/api/whoami", cred, this.callback);
                    },
                    "it works": function(err, doc, response) {
                        assert.ifError(err);
                    },
                    "and we examine the document": {
                        topic: function(doc) {
                            return doc;
                        },
                        "it has the right ID": function(doc) {
                            assert.equal(doc.id, "http://localhost:4815/api/user/crab/profile");
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
