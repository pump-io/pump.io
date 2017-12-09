// login-web-ui-test.js
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
    setupAppConfig = apputil.setupAppConfig,
    newCredentials = oauthutil.newCredentials;

var browserClose = function(br) {
    Step(
        function() {
            br.on("closed", this);
            br.window.close();
        },
        function() {
            // browser is closed
        }
    );
};

var suite = vows.describe("login web UI test");

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
        "and we register a user with the API": {
            topic: function() {
                newCredentials("croach", "ihave1onus", "localhost", 4815, this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.ok(cred);
            },
            "and we visit the login URL": {
                topic: function() {
                    var cb = this.callback,
                        browser = new Browser({runScripts: true});

                    browser.visit("http://localhost:4815/main/login", function() {
                        cb(!browser.success, browser);
                    });
                },
                teardown: function(br) {
                    browserClose(br);
                },
                "it works": function(err, br) {
                    assert.ifError(err);
                    br.assert.success("ok");
                },
                "it includes a login div": function(br) {
                    br.assert.element("div#loginpage");
                },
                "it includes a login form": function(br) {
                    br.assert.element("div#loginpage form");
                },
                "the login form has a nickname field": function(br) {
                    br.assert.element("div#loginpage form input[name=\"nickname\"]");
                },
                "the login form has a password field": function(br) {
                    br.assert.element("div#loginpage form input[name=\"password\"]");
                },
                "the login form has a submit button": function(br) {
                    br.assert.element("div#loginpage form button[type=\"submit\"]");
                }
            }
        }
    }
});

suite["export"](module);
