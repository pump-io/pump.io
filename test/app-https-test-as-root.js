// app-https-test-as-root.js
//
// Test running the app over HTTPS
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
    fs = require("fs"),
    path = require("path"),
    databank = require("databank"),
    Step = require("step"),
    http = require("http"),
    https = require("https"),
    httputil = require("./lib/http");

var ignore = function(err) {};

var suite = vows.describe("app over https");

suite.addBatch({
    "When we makeApp()": {
        topic: function() {
            var config = {port: 443,
                          hostname: "social.localhost",
                          key: path.join(__dirname, "data", "social.localhost.key"),
                          cert: path.join(__dirname, "data", "social.localhost.crt"),
                          driver: "memory",
                          params: {},
                          nologger: true
                         },
                makeApp = require("../lib/app").makeApp;

            process.env.NODE_ENV = "test";

            makeApp(config, this.callback);
        },
        "it works": function(err, app) {
            assert.ifError(err);
            assert.isObject(app);
        },
        "and we app.run()": {
            topic: function(app) {
                var cb = this.callback;
                app.run(function(err) {
                    if (err) {
                        cb(err, null);
                    } else {
                        cb(null, app);
                    }
                });
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "app is listening on correct port": function(err, app) {
                var addr = app.address();
                assert.equal(addr.port, 443);
            },
            "and we get the host-meta file": {
                topic: function() {
                    var endpoint = "https://social.localhost/.well-known/host-meta.json",
                        callback = this.callback,
                        req;
                    req = https.get(endpoint, function(res) {
                        var body = "";
                        res.setEncoding("utf8");
                        res.on("data", function(chunk) {
                            body = body + chunk;
                        });
                        res.on("error", function(err) {
                            callback(err, null, null);
                        });
                        res.on("end", function() {
                            callback(null, res, body);
                        });
                    });

                    req.on("error", function(err) {
                        callback(err, null, null);
                    });
                },
                "it works": function(err, res, body) {
                    assert.ifError(err);
                    assert.equal(200, res.statusCode);
                }
            }
        }
    }
});

suite["export"](module);