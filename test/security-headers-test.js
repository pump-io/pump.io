// security-headers-test.js
//
// Test that security headers are being sent
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
    withAppSetup = apputil.withAppSetup;

var ignore = function(err) {};

var suite = vows.describe("Security headers");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch(
    withAppSetup({
        "and we HEAD the home page": {
            topic: function(app) {
                httputil.head("http://localhost:4815/", this.callback);
            },
            "it works": function(err, res, body) {
                assert.ifError(err);
            },
            "the Content-Security-Policy header is correct": function(err, res, body) {
                assert.isObject(res.headers);
                assert.include(res.headers, "content-security-policy");
                assert.equal(res.headers["content-security-policy"], "default-src 'self'; connect-src 'self' ws://localhost:4815; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src *; object-src 'none'; media-src *; child-src 'self' www.youtube.com; frame-ancestors 'none'");
            },
            "the X-Content-Type-Options header is correct": function(err, res, body) {
                assert.isObject(res.headers);
                assert.include(res.headers, "x-content-type-options");
                assert.equal(res.headers["x-content-type-options"], "nosniff");
            },
            "the X-Download-Options header is correct": function(err, res, body) {
                assert.isObject(res.headers);
                assert.include(res.headers, "x-download-options");
                assert.equal(res.headers["x-download-options"], "noopen");
            },
            "the X-Frame-Options header is correct": function(err, res, body) {
                assert.isObject(res.headers);
                assert.include(res.headers, "x-frame-options");
                assert.equal(res.headers["x-frame-options"], "DENY");
            },
            "the X-XSS-Protection header is correct": function(err, res, body) {
                assert.isObject(res.headers);
                assert.include(res.headers, "x-xss-protection");
                assert.equal(res.headers["x-xss-protection"], "1; mode=block");
            }
        }
    })
);

suite["export"](module);
