// xss-blacklist-test.js
//
// Test the XSS blacklist middleware
//
// Copyright 2016, 2017 AJ Jordan <alex@strugee.net>
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
    apputil = require("./lib/app"),
    withAppSetup = apputil.withAppSetup,
    httputil = require("./lib/http");

vows.describe("XSS blacklist middleware").addBatch(
    withAppSetup({
        "and we visit the home page with an IE11 User-Agent header": {
            topic: function(app) {
                httputil.head("http://localhost:4815/", {
                    "User-Agent": "Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko"
                }, this.callback);
            },
            "it works": function(err, res) {
                assert.ifError(err);
            },
            "it has a status code of 200": function(err, res) {
                assert.isNumber(res.statusCode);
                assert.equal(res.statusCode, 200);
            }
        },
        "and we visit the home page with an IE10 User-Agent header": {
            topic: function(app) {
                httputil.head("http://localhost:4815/", {
                    "User-Agent":"Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; Trident/6.0)"
                }, this.callback);
            },
            "it works": function(err, res) {
                assert.ifError(err);
            },
            "it has a status code of 400": function(err, res) {
                assert.isNumber(res.statusCode);
                assert.equal(res.statusCode, 400);
            }
        }
    })
)["export"](module);
