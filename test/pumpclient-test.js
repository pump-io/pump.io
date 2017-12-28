// app-test.js
//
// Test the client utilities
//
// Copyright 2017 AJ Jordan <alex@strugee.net>
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

var Step = require("step"),
    _ = require("lodash"),
    assert = require("assert"),
    vows = require("vows"),
    fs = require("fs"),
    path = require("path"),
    oauthutil = require("./lib/oauth"),
    httputil = require("./lib/http");

var ignore = function(err) {};

var suite = vows.describe("pumpclient module interface");

suite.addBatch({
    "When we get the pumpclient module": {
        topic: function() {
            return require("../lib/pumpclient");
        },
        "it exports an object": function(err, pumpclient) {
            assert.isObject(pumpclient);
        }
    }
});

suite.export(module);
