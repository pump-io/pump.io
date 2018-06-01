// oauth2-client-token-e2e-test.js
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
var http = require("http");
var path = require("path");
var urlparse = require("url").parse;
var vows = require("vows");
var assert = require("assert");
var setupApp = require("./lib/app").setupApp;
var qs = require("querystring");
var Step = require("step");
var _ = require("lodash");
var post = require("./lib/http").post;

var tc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "config.json")));

var REDIRECT_URI = "http://localhost:1516/done";
var AUTHZ_STATE = "oauth2unittest";

var client = tc.clients[0];

process.on("uncaughtException", function(err) {
    console.error(err);
    process.exit(-1);
});

vows.describe("OAuth 2.0 client bearer token")
    .addBatch({
        "When we start the app": {
            topic: function() {
                setupApp(this.callback);
                return undefined;
            },
            teardown: function(app) {
                app.close();
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "and we request a client bearer token": {
                topic: function() {
                    var params = {
                        grant_type: "client_credentials",
                        client_id: client.client_id,
                        client_secret: client.client_secret
                    };
                    post(
                      "localhost",
                      4815,
                      "/oauth2/token",
                      params,
                      this.callback
                    );
                },
                "it works": function(err, res, body) {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 200);
                    assert.isString(body);
                    var data = JSON.parse(body);
                    assert.isString(data.access_token);
                }
            }
        }
    })
    .export(module);
