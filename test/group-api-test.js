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
                                displayName: "Barbarians"
                            }
                        };

                    pj(url, cred, act, function(err, data, resp) {
                        callback(err, data);
                    });
                },
                "it works": function(err, data) {
                    assert.ifError(err);
                    validActivity(data);
                }
            }
        }
    }
});

suite["export"](module);
