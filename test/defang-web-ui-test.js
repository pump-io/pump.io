// defang-web-ui-test.js
//
// Test posting various bits of filthy HTML in hopes they can ruin someone's life
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
//
//
// This is test is made to test the defang function in 'lib/app.js'
//
// History:
//  29-01-2014
//      - Added this file to tests
//      - This will trigger validate code after line 'lib/app.js:348 if (name == "displayName && _.isString(value))'
//
// TODO
// - Add function trigger
// - Make this Test without zombiei (browser)

var assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("underscore"),
    querystring = require("querystring"),
    http = require("http"),
    OAuth = require("oauth-evanp").OAuth,
    Browser = require("zombie"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    Browser = require("zombie");


var suite = vows.describe("Defang web UI test");

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

// A batch to test posting to the regular feed endpoint

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            // app contains the dummy object from test/lib/oauth.js
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we get a new set of credentials": {
            topic: function() {
                oauthutil.newCredentials("mickey", "pluto111", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "and we post content": {
                topic: function(cred) {
                    var url = "http://localhost:4815/api/user/mickey/feed",
                        act = {
                            verb: "post",
                            content: "Hello World",
                            object: {
                                objectType: "note",
                                content: "Hello, World"
                            }
                        };
                    httputil.postJSON(url, cred, act, this.callback);
                },
                "it works": function(err, result, response) {
                    assert.ifError(err);
                },
                "and we visit it with a browser": {
                    topic: function() {
                        var browser = new Browser({silent: true});
                        cb = this.callback;

                        // triggers defang function in 'public/layout.utml'
                        // name: displayName
                        // value: Major activities by mickey
                        browser.visit("http://localhost:4815/mickey", function() {
                            cb(!browser.success, browser);
                        });
                    },
                    teardown: function(br) {
                        browserClose(br);
                    },
                    "it works": function(err, br) {
                        br.assert.success();
                    }
                }
            }
        }
    }
});

suite["export"](module);
