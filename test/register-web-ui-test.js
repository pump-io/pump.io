// register-web-ui-test.js
//
// Test that the home page shows an invitation to join
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
                var browser;
                browser = new Browser();

                browser.visit("http://localhost:4815/", this.callback);
            },
            "it works": function(err, br) {
                assert.ifError(err);
                assert.isTrue(br.success);
            },
            "it has a registration link": function(err, br) {
                assert.ifError(err);
                assert.isTrue(br.success);
                assert.equal(br.text("div.navbar a#register"), "Register");
            },
            "and we click the register link": {
                topic: function(br) {
                    br.clickLink("div.navbar a#register", this.callback);
                },
                "it works": function(err, br) {
                    assert.ifError(err);
                    assert.isTrue(br.success);
                },
                "and we check the content": {
                    topic: function(br) {
                        return br;
                    },
                    "it includes a registration div": function(br) {
                        assert.ok(br.query("div.registration"));
                    },
                    "it includes a registration form": function(br) {
                        assert.ok(br.query("div.registration form"));
                    },
                    "the registration form has a nickname field": function(br) {
                        assert.ok(br.query("div.registration form input[name=\"nickname\"]"));
                    },
                    "the registration form has a password field": function(br) {
                        assert.ok(br.query("div.registration form input[name=\"password\"]"));
                    },
                    "the registration form has a password repeat field": function(br) {
                        assert.ok(br.query("div.registration form input[name=\"repeat\"]"));
                    },
                    "the registration form has a submit button": function(br) {
                        assert.ok(br.query("div.registration form input[type=\"submit\"]"));
                    }
                }
            }
        }
    }
});

suite["export"](module);
