// randomstring-test.js
//
// Test the randomstring module
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
    vows = require("vows");

vows.describe("randomstring module interface").addBatch({
    "When we require the randomstring module": {
        topic: function() { 
            return require("../lib/randomstring");
        },
        "we get a module back": function(rs) {
            assert.ok(rs);
        },
        "we can get the randomString function": {
            topic: function(rs) {
                return rs.randomString;
            },
            "which is a function": function (randomString) {
                assert.isFunction(randomString);
            },
            "we can get a random string": {
                topic: function(randomString) {
                    randomString(16, this.callback);
                },
                "without an error": function(err, value) {
                    assert.ifError(err);
                },
                "with a string return value": function(err, value) {
                    assert.isString(value);
                },
                "with only URL-safe characters": function(err, value) {
                    assert.match(value, /^[A-Za-z0-9\-_]+$/);
                }
            }
        }
    }
})["export"](module);

