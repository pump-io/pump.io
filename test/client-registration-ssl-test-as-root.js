// client-registration-ssl-test-as-root.js
//
// Test the client registration API when using an SSL endpoint
//
// Copyright 2012, StatusNet Inc.
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
    path = require("path"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("underscore"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    newClient = oauthutil.newClient;

var suite = vows.describe("client registration API");

suite.addBatch({
    "When we makeApp()": {
        topic: function() {
            var config = {port: 443,
                          hostname: "social.localhost",
                          key: path.join(__dirname, "data", "social.localhost.key"),
                          cert: path.join(__dirname, "data", "social.localhost.crt"),
                          driver: "memory",
                          params: {},
                          nologger: true
                         },
                makeApp = require("../lib/app").makeApp;

            makeApp(config, this.callback);
        },
        "it works": function(err, app) {
            assert.ifError(err);
            assert.isObject(app);
        },
        "and we app.run()": {
            topic: function(app) {
                var cb = this.callback;
                app.run(function(err) {
                    if (err) {
                        cb(err, null);
                    } else {
                        cb(null, app);
                    }
                });
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "and we register a new client": {
                topic: function() {
                    newClient("social.localhost", 443, this.callback);
                },
                "it works": function(err, cred) {
                    assert.ifError(err);
                    assert.isObject(cred);
                    assert.include(cred, "client_id");
                    assert.include(cred, "client_secret");
                    assert.include(cred, "expires_at");
                }
            }
        }
    }
});

suite["export"](module);