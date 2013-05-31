// register-web-ui-test.js
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

var assert = require("assert"),
    vows = require("vows"),
    oauthutil = require("./lib/oauth"),
    Browser = require("zombie"),
    Step = require("step"),
    setupApp = oauthutil.setupApp,
    setupAppConfig = oauthutil.setupAppConfig;

var suite = vows.describe("layout test");

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
                var browser,
                    callback = this.callback;
                browser = new Browser();

                browser.visit("http://localhost:4815/main/register", function(err, br) {
                    callback(err, br);
                });
            },
            "it works": function(err, br) {
                assert.ifError(err);
                assert.isTrue(br.success);
            },
            "and we check the content": {
                topic: function(br) {
                    var callback = this.callback;
                    callback(null, br);
                },
                "it includes a registration div": function(err, br) {
                    assert.ok(br.query("div#registerpage"));
                },
                "it includes a registration form": function(err, br) {
                    assert.ok(br.query("div#registerpage form"));
                },
                "the registration form has a nickname field": function(err, br) {
                    assert.ok(br.query("div#registerpage form input[name=\"nickname\"]"));
                },
                "the registration form has a password field": function(err, br) {
                    assert.ok(br.query("div#registerpage form input[name=\"password\"]"));
                },
                "the registration form has a password repeat field": function(err, br) {
                    assert.ok(br.query("div#registerpage form input[name=\"repeat\"]"));
                },
                "the registration form has a submit button": function(err, br) {
                    assert.ok(br.query("div#registerpage form button[type=\"submit\"]"));
                },
            "and we submit the form": {
                topic: function() {
                    var callback = this.callback,
                        br = arguments[0];

                        Step(
                            function() {
                                br.fill("nickname", "sparks", this);
                            },
                            function(err) {
                                if (err) throw err;
                                br.fill("password", "redplainsrider1", this);
                            },
                            function(err) {
                                if (err) throw err;
                                br.fill("repeat", "redplainsrider1", this);
                            },
                            function(err) {
                                if (err) throw err;
                                br.pressButton("button[type=\"submit\"]", this);
                            },
                            function(err) {
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
                        assert.isTrue(br.success);
                    }
                }
            }
        }
    }
});

suite["export"](module);
