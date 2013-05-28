// app-https-test-as-root.js
//
// Test running the app over HTTPS
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
    fs = require("fs"),
    path = require("path"),
    databank = require("databank"),
    Step = require("step"),
    http = require("http"),
    https = require("https"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    xrdutil = require("./lib/xrd");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var suite = vows.describe("bounce 80 to 443 app interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch({
    "When we makeApp()": {
        topic: function() {
            var config = {port: 443,
                          hostname: "bounce.localhost",
                          key: path.join(__dirname, "data", "bounce.localhost.key"),
                          cert: path.join(__dirname, "data", "bounce.localhost.crt"),
                          driver: tc.driver,
                          params: tc.params,
                          nologger: true,
                          bounce: true,
                          sockjs: false
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
            "and we GET the host-meta file": {
                topic: function() {
                    var callback = this.callback,
                        req;

                    req = http.get("http://bounce.localhost/.well-known/host-meta", function(res) {
                        callback(null, res);
                    });
                    req.on("error", function(err) {
                        callback(err, null);
                    });
                },
                "it works": function(err, res) {
                    assert.ifError(err);
                },
                "it redirects to the HTTPS version": function(err, res) {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 301);
                    assert.equal(res.headers.location, "https://bounce.localhost/.well-known/host-meta");
                }
            }
        }
    }
});

suite["export"](module);
