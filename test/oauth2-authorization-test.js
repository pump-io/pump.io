// oauth2-authorization-test.js
//
// Copyright 2018, E14N https://e14n.com/
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

var fs = require("fs");
var path = require("path");
var vows = require("vows");
var assert = require("assert");
var setupApp = require("./lib/app").setupApp;
var Browser = require("zombie");
var qs = require("querystring");
var Step = require("step");

var tc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "config.json")));

var browserClose = function(br) {
    Step(
        function() {
            br.on("closed", this);
            br.window.close();
        },
        function(br) {
            // browser is closed;
        }
    );

};

var REDIRECT_URI = "http://localhost:1516/done";

vows.describe("OAuth 2.0 authorization flow")
    .addBatch({
        "When we start the app": {
            topic: function() {
                setupApp(this.callback);
            },
            teardown: function(app) {
                app.close();
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "and we request authorization": {
                topic: function() {
                    var params = qs.stringify({
                        response_type: "code",
                        client_id: tc.clients[0].client_id,
                        redirect_uri: REDIRECT_URI,
                        state: "oauth2unittest"
                    });
                    var url = "http://localhost:4815/oauth2/authorize?" + params;

                    var br = new Browser({runScripts: false});

                    Step(
                        function() {
                            br.visit(url, this);
                        },
                        function() {
                            if (br.success) {
                                this(null, br);
                            } else {
                                this(new Error("Unsuccessful request"), null);
                            }
                        },
                        this.callback
                    );
                },
                "it works": function(err, br) {
                    assert.ifError(err);
                    assert.isObject(br);
                    br.assert.success();
                },
                "we were redirected to the login page": function(err, br) {
                    assert.ifError(err);
                    assert.isObject(br);
                    br.assert.redirected();
                    br.assert.elements("form#login", 1);
                    br.assert.elements("input[name=nickname]", 1);
                    br.assert.elements("input[name=password]", 1);
                    br.assert.elements("button[type=submit]", 1);
                }
            }
        }
    })
    .export(module);
