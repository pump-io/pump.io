// register-email-required-test.js
//
// Test behavior when email registration is required
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
    vows = require("vows"),
    oauthutil = require("./lib/oauth"),
    Browser = require("zombie"),
    Step = require("step"),
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    registerEmail = oauthutil.registerEmail,
    setupApp = oauthutil.setupApp,
    setupAppConfig = oauthutil.setupAppConfig;

var suite = vows.describe("layout test");

// A batch to test some of the layout basics

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupAppConfig({hostname: "localhost",
                            port: 4815,
                            requireEmail: true,
                            smtpserver: "localhost",
                            smtpport: 1623},
                           this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we get a new client": {
            topic: function() {
                newClient(this.callback);
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and we try to register a user with no email address": {
                topic: function(cl) {
                    var callback = this.callback;
                    register(cl, "florida", "good*times", function(err, result, response) {
                        if (err && err.statusCode == 400) {
                            callback(null);
                        } else {
                            callback(new Error("Unexpected success"));
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we register a user with an email address": {
                topic: function(cl) {
                    var callback = this.callback;
                    registerEmail(cl, "jj", "dyn|o|mite!", "jamesjr@pump.test", callback);
                },
                "it works correctly": function(err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                }
            }
        }
    }
});

suite["export"](module);
