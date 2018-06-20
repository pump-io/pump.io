// restartutil-unit-test.js
//
// Test the zero-downtime restart support utilities
//
// Copyright 2018 AJ Jordan <alex@strugee.net>
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

var vows = require("vows"),
    assert = require("assert");

var suite = vows.describe("restart utilities module");

var assertBadConfig = function(config, error) {
    return {
        topic: function(restartUtil) {
            return restartUtil.checkRequirements(config, false, false);
        },
        "it gives us back an error": function(err, result) {
            assert.ifError(err);
            assert.isFalse(result.ok);
            assert.equal(result.reason, error);
        }
    };
};

suite.addBatch({
    "When we get the restartutil module": {
        topic: function() {
            return require("../lib/restartutil");
        },
            "it works": function(err, restartUtil) {
            assert.ifError(err);
        },
        "it exports the right things": function(err, restartUtil) {
            assert.isObject(restartUtil);
            assert.isFunction(restartUtil.checkRequirements);
        },
        "and we pass it a config that totally works": {
            topic: function(restartUtil) {
                return restartUtil.checkRequirements({
                    driver: "mongodb",
                    workers: 2
                });
            },
            "it works": function(err, result) {
                assert.ifError(err);
                assert.isTrue(result.ok);
                assert.isUndefined(result.reason);
            }
        },
        "and we pass it a config without enough workers": assertBadConfig({
            driver: "mongodb",
            workers: 1
        }, "no workers"),
        "and we pass it a config with an unsupported driver": assertBadConfig({
            driver: "disk",
            workers: 2
        }, "bad driver"),
        "and we tell it we previously aborted a restart": {
            topic: function(restartUtil) {
                return restartUtil.checkRequirements({
                    driver: "mongodb",
                    workers: 2
                }, true, false);
            },
            "it gives us back an error": function(err, result) {
                assert.ifError(err);
                assert.isFalse(result.ok);
                assert.equal(result.reason, "aborted restart");
            }
        },
        "and we tell it we've already got a restart in flight": {
            topic: function(restartUtil) {
                return restartUtil.checkRequirements({
                    driver: "mongodb",
                    workers: 2
                }, false, true);
            },
            "it gives us back an error": function(err, result) {
                assert.ifError(err);
                assert.isFalse(result.ok);
                assert.equal(result.reason, "restart inflight");
            }
        }
        // XXX test for "bad epoch"
    }
});

suite.export(module);
