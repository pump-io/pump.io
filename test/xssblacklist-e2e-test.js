// xss-blacklist-e2e-test.js
//
// Test the XSS blacklist middleware module
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
    _ = require("lodash"),
    Step = require("step"),
    Browser = require("zombie"),
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    http = require("http"),
    withAppSetup = apputil.withAppSetup,
    br;

vows.describe("XSS blacklist middleware module").addBatch({
    "When we require the XSS blacklist middleware": {
        topic: function() {
            return require("../dist/lib/xssblacklist.js");
        },
        "it works": function(middleware) {
            assert.isObject(middleware);
        },
        "and we get its xssCheck export": {
            topic: function(middleware) {
                return middleware.xssCheck;
            },
            "it exists": function(xssCheck) {
                assert.isFunction(xssCheck);
            }
        }
    }
})["export"](module);
