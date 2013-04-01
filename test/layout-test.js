// layout-test.js
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
            "and we look at the results": {
                topic: function(br) {
                    return br;
                },
                "it has the right title": function(br) {
                    assert.equal(br.text("title"), "Welcome - Test");
                },
                "it has a top navbar": function(br) {
                    assert.ok(br.query("div.navbar"));
                },
                "it has a brand link": function(br) {
                    assert.equal(br.text("a.brand"), "Test");
                },
                "it has a registration link": function(br) {
                    assert.equal(br.text("div.navbar a#register"), "Register");
                },
                "it has a login link": function(br) {
                    assert.equal(br.text("div.navbar a#login"), "Login");
                },
                "it has a footer": function(br) {
                    assert.ok(br.query("footer"));
                },
                "it has a link to pump.io in the footer": function(br) {
                    assert.equal(br.text("footer a[href='http://pump.io/']"), "pump.io");
                }
            }
        }
    }
});

suite["export"](module);
