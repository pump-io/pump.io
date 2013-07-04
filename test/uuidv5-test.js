// uuidv5-test.js
//
// Test the uuidv5 module
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

vows.describe("uuidv5 module interface").addBatch({
    "When we require the uuidv5 module": {
        topic: function() {
            return require("../lib/uuidv5");
        },
        "it works": function(uuidv5) {
            assert.isFunction(uuidv5);
        },
        "it has an ns property": function(uuidv5) {
            assert.isObject(uuidv5.ns);
        },
        "and we make two UUIDs with the same data": {
            topic: function(uuidv5) {
		var secret = "My dog has fleas";
                return [uuidv5(secret), uuidv5(secret)];
            },
            "it works": function(ids) {
                assert.isArray(ids);
		assert.isString(ids[0]);
		assert.isString(ids[1]);
		assert.equal(ids[0], ids[1]);
            }
        },
        "and we make two UUIDs with different data": {
            topic: function(uuidv5) {
                return [uuidv5("your dog does too"),
			uuidv5("no he does not")];
            },
            "it works": function(ids) {
                assert.isArray(ids);
		assert.isString(ids[0]);
		assert.isString(ids[1]);
		assert.notEqual(ids[0], ids[1]);
            }
        },
        "and we make two UUIDs with the same data and ns": {
            topic: function(uuidv5) {
                return [uuidv5("pump.io", uuidv5.ns.DNS),
			uuidv5("pump.io", uuidv5.ns.DNS)];
            },
            "it works": function(ids) {
                assert.isArray(ids);
		assert.isString(ids[0]);
		assert.isString(ids[1]);
		assert.equal(ids[0], ids[1]);
            }
        },
        "and we make two UUIDs with different data and same ns": {
            topic: function(uuidv5) {
                return [uuidv5("pump.io", uuidv5.ns.DNS),
			uuidv5("idno.co", uuidv5.ns.DNS)];
            },
            "it works": function(ids) {
                assert.isArray(ids);
		assert.isString(ids[0]);
		assert.isString(ids[1]);
		assert.notEqual(ids[0], ids[1]);
            }
        },
        "and we make two UUIDs with same data and different ns": {
            topic: function(uuidv5) {
                return [uuidv5("pump.io", uuidv5.ns.DNS),
			uuidv5("pump.io", null)];
            },
            "it works": function(ids) {
                assert.isArray(ids);
		assert.isString(ids[0]);
		assert.isString(ids[1]);
		assert.notEqual(ids[0], ids[1]);
            }
        }
    }
})["export"](module);
