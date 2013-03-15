// dispatch-test.js
//
// Test for dispatch module
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
    cluster = require("cluster");

var suite = vows.describe("dispatch module interface");

suite.addBatch({
    "When we require the dispatch module": {
        topic: function() {
            return require("../lib/dispatch");
        },
        "it returns an object": function(Dispatch) {
            assert.isObject(Dispatch);
        },
        "and we check its methods": {
            topic: function(Dispatch) {
                return Dispatch;
            },
            "it has a start method": function(Dispatch) {
                assert.isFunction(Dispatch.start);
            },
            "and we start the dispatcher": {
                topic: function(Dispatch) {
                    var callback = this.callback;

                    Dispatch.start();
                    callback(null, "parent");
                },
                "it works": function(err, name) {
                    assert.ifError(err);
                    assert.isTrue(name == "parent" || name == "child");
                }
            }
        }
    }
});

suite["export"](module);
