// register-web-ui-e2e-test.js
//
// Test that the home page shows an invitation to join
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

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    Browser = require("zombie"),
    Step = require("step"),
    withAppSetup = apputil.withAppSetup,
    setupAppConfig = apputil.setupAppConfig;

var suite = vows.describe("register web ui test");

// A batch to test some of the layout basics

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupAppConfig({site: "Test"}, this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we visit the root URL": {
            topic: function() {
                var cb = this.callback;

                var browser = new Browser();
                browser.visit("http://localhost:4815/main/register", function(err) {
                    cb(err, browser);
                });
            },
            teardown: function(br) {
                br.window.close();
            },
            "it works": function(err, br) {
                assert.ifError(err);
                br.assert.success();
            },
            "and we check the content": {
                topic: function(br) {
                    var cb = this.callback;
                    cb(null, br);
                },
                "it includes a registration div": function(err, br) {
                    br.assert.element("div#registerpage");
                },
                "it includes a registration form": function(err, br) {
                    br.assert.element("div#registerpage form");
                },
                "the registration form has a nickname field": function(err, br) {
                    br.assert.element("div#registerpage form input[name=\"nickname\"]");
                },
                "the registration form has a password field": function(err, br) {
                    br.assert.element("div#registerpage form input[name=\"password\"]");
                },
                "the registration form has a password repeat field": function(err, br) {
                    br.assert.element("div#registerpage form input[name=\"repeat\"]");
                },
                "the registration form has a submit button": function(err, br) {
                    br.assert.element("div#registerpage form button[type=\"submit\"]");
                },
                "and we submit the form": {
                    topic: function(br) {
                        var callback = this.callback;

                        Step(
                            function() {
                                var self = this;
                                br.fill("nickname", "sparks", this)
                                  .fill("password", "redplainsrider1", this)
                                  .fill("repeat", "redplainsrider1", this)
                                  .pressButton("button[type=\"submit\"]", function() {
                                      self(null, br);
                                  });

                            },
                            function(err, br) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    callback(null, br);
                                }
                            }
                        );
                    },
                    "it works": function(err, br) {
                        assert.ifError(err);
                        br.assert.success();
                    }
                }
            }
        }
    }
});

suite["export"](module);
