// server-header-e2e-test.js
//
// Test that HSTS headers are set
//
// Copyright 2013, E14N https://e14n.com/
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
    fs = require("fs"),
    path = require("path"),
    version = require("../lib/version").version,
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    httputil = require("./lib/http"),
    setupApp = apputil.setupApp,
    setupAppConfig = apputil.setupAppConfig;

var ignore = function(err) {};

var suite = vows.describe("HSTS header");

suite.addBatch({
    "When we setup the app with HSTS configured": {
        topic: function() {
            setupAppConfig({
                hsts: {
                    force: true
                }
            }, this.callback);
        },
        "it works": function(err, app) {
            assert.ifError(err);
            assert.isObject(app);
        },
        "teardown": function(app) {
            if (app && app.close) {
                app.close(function(err) {});
            }
        },
        "and we HEAD the home page": {
            topic: function(app) {
                httputil.head("http://localhost:4815/", this.callback);
            },
            "it works": function(err, res, body) {
                assert.ifError(err);
            },
            "headers include the Strict-Transport-Security: header": function(err, res, body) {
                assert.isObject(res.headers);
                assert.include(res.headers, "strict-transport-security");
                assert.equal(res.headers["strict-transport-security"], "max-age=15552000; includeSubDomains");
            }
        }
    }
});

suite.addBatch({
    "When we setup the app without HSTS configured": {
        topic: function() {
            setupApp(this.callback);
        },
        "it works": function(err, app) {
            assert.ifError(err);
            assert.isObject(app);
        },
        "teardown": function(app) {
            if (app && app.close) {
                app.close(function(err) {});
            }
        },
        "and we HEAD the home page": {
            topic: function(app) {
                httputil.head("http://localhost:4815/", this.callback);
            },
            "it works": function(err, res, body) {
                assert.ifError(err);
            },
            "the Strict-Transport-Security: header isn't returned": function(err, res, body) {
                assert.isObject(res.headers);
                assert.isUndefined(res.headers["strict-transport-security"]);
            }
        }
    }
});

suite["export"](module);
