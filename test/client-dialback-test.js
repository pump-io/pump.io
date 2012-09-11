// client-dialback-test.js
//
// Test the client registration API
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
    Step = require("step"),
    querystring = require("querystring"),
    _ = require("underscore"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    dialbackApp = require("./lib/dialback").dialbackApp,
    setupApp = oauthutil.setupApp;

var suite = vows.describe("client registration with dialback");

var dbreg = function(id, token, ts, params, callback) {
    var URL = "http://localhost:4815/api/client/register",
        requestBody = querystring.stringify(params);

    httputil.dialbackPost(URL, id, token, ts, requestBody, "application/x-www-form-urlencoded", callback);
};

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            var app, callback = this.callback;
            Step(
                function() {
                    setupApp(this);
                },
                function(err, result) {
                    if (err) throw err;
                    app = result;
                    dialbackApp(80, "dialback.localhost", this);
                },
                function(err, dbapp) {
                    if (err) {
                        callback(err, null, null);
                    } else {
                        callback(err, app, dbapp);
                    }
                }
            );
        },
        teardown: function(app, dbapp) {
            app.close();
            dbapp.close();
        },
        "it works": function(err, app, dbapp) {
            assert.ifError(err);
        },
        "and we try to register with an invalid host": {
            topic: function() {
                var callback = this.callback;
                dbreg("social.invalid",
                      "VALID",
                      Date.now(),
                      {application_name: "Social Invalid", type: "client_associate"},
                      function(err, body, resp) {
                          if (err && err.statusCode && err.statusCode === 401) {
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
        "and we try to register with an invalid webfinger domain": {
            topic: function() {
                var callback = this.callback;
                dbreg("alice@social.invalid",
                      "VALID",
                      Date.now(),
                      {application_name: "Social Invalid", type: "client_associate"},
                      function(err, body, resp) {
                          if (err && err.statusCode && err.statusCode === 401) {
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
        "and we try to register with an invalid webfinger": {
            topic: function() {
                var callback = this.callback;
                dbreg("invalid@dialback.localhost",
                      "VALID",
                      Date.now(),
                      {application_name: "Social Invalid", type: "client_associate"},
                      function(err, body, resp) {
                          if (err && err.statusCode && err.statusCode === 401) {
                              callback(null);
                          } else {
                              callback(new Error("Unexpected success"));
                          }
                      });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        }
    }
});

suite["export"](module);
