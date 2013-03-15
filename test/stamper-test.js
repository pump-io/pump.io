// stamper-test.js
//
// Test the stamper module
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

vows.describe("stamper module interface").addBatch({
    "When we require the stamper module": {
        topic: function() {
            return require("../lib/stamper");
        },
        "it works": function(stamper) {
            assert.isObject(stamper);
        },
        "and we get its Stamper export": {
            topic: function(stamper) {
                return stamper.Stamper;
            },
            "it exists": function(Stamper) {
                assert.isObject(Stamper);
            },
            "it has a stamp() method": function(Stamper) {
                assert.isFunction(Stamper.stamp);
            },
            "it has an unstamp() method": function(Stamper) {
                assert.isFunction(Stamper.unstamp);
            },
            "and we make a timestamp with no argument": {
                topic: function(Stamper) {
                    return Stamper.stamp();
                },
                "it works": function(ts) {
                    assert.isString(ts);
                },
                "it looks correct": function(ts) {
                    assert.match(ts, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
                }
            },
            "and we make a timestamp with a date argument": {
                topic: function(Stamper) {
                    var d = Date.UTC(2000, 0, 1, 12, 34, 56);
                    return Stamper.stamp(d);
                },
                "it works": function(ts) {
                    assert.isString(ts);
                },
                "it looks correct": function(ts) {
                    assert.match(ts, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
                },
                "it contains our date": function(ts) {
                    assert.equal(ts, "2000-01-01T12:34:56Z");
                }
            },
            "and we unstamp a timestamp": {
                topic: function(Stamper) {
                    var ts = "1968-10-14T13:32:12Z";
                    return Stamper.unstamp(ts);
                },
                "it works": function(dt) {
                    assert.instanceOf(dt, Date);
                },
                "its properties are correct": function(dt) {
                    assert.equal(dt.getUTCFullYear(), 1968);
                    assert.equal(dt.getUTCMonth(), 9);
                    assert.equal(dt.getUTCDate(), 14);
                    assert.equal(dt.getUTCHours(), 13);
                    assert.equal(dt.getUTCMinutes(), 32);
                    assert.equal(dt.getUTCSeconds(), 12);
                }
            }
        }
    }
})["export"](module);
