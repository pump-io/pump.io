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

var fs = require("fs"),
    path = require("path"),
    vows = require("vows"),
    assert = require("assert"),
    apputil = require("./lib/app"),
    Browser = require("zombie"),
    Step = require("step"),
    setupAppConfig = apputil.setupAppConfig;

var tc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "config.json")));

var REDIRECT_URI = "http://localhost:1516/done";
var user = tc.users[0];

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
        "and we create a browser": {
            topic: function() {
                this.callback(null, new Browser({runScripts: true}));
                return undefined;
            },
            "it works": function(err, br) {
                assert.ifError(err);
                assert.ok(br);
            },
            "and we visit the login URL": {
                topic: function(br) {
                    var cb = this.callback;
                    br.visit("http://localhost:4815/main/login", function() {
                        cb(!br.success, br);
                    });
                },
                teardown: function(br) {
                    br.destroy();
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
                },
                "and we fill in the login form": {
                    topic: function(br) {
                        var callback = this.callback;
                        br.fill('nickname', user.nickname)
                          .fill('password', user.password)
                          .wait({element: "button:not([disabled])[type=submit]"})
                          .then(function() {
                              br.pressButton("button:not([disabled])[type=submit]");
                              br.wait({element: "a#logout"})
                                .then(function() {
                                    callback(null, br);
                                });
                          });
                        return undefined;
                    },
                    "it works": function(err, br) {
                        assert.ifError(err);
                        assert.isObject(br);
                    }
                }
            }
        }
    }
});

suite["export"](module);
