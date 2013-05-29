// nonce-test.js
//
// Test the nonce module
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
    databank = require("databank"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("nonce module interface");

var testSchema = {
    pkey: "token_nonce",
    fields: ["nonce",
             "consumer_key",
             "access_token",
             "timestamp"]
};

var testData = {
    "create": {
        consumer_key: "ZZZZZZZZZZZZZZZZZZZZZZZ",
        access_token: "AAAAAAAAAAAAAAAAAAAAAAA",
        nonce: "BBBBBB",
        timestamp: 1337801665
    },
    "update": {
        timestamp: 1337801765
    }
};

var mb = modelBatch("nonce", "Nonce", testSchema, testData);

mb["When we require the nonce module"]
  ["and we get its Nonce class export"]
  ["and we create a nonce instance"]
  ["auto-generated fields are there"] = function(err, created) {
      assert.isString(created.token_nonce);
};

mb["When we require the nonce module"]
["and we get its Nonce class export"]
["and we create a nonce instance"]
["and we modify it"]
["it is modified"] = function(err, updated) {
    assert.ifError(err);
};

suite.addBatch(mb);

var CONSUMERKEY1 = "ZZZZZZZZZZZZZZZZZZZZZZ";
var CONSUMERKEY2 = "YYYYYYYYYYYYYYYYYYYYYY";
var CONSUMERKEY3 = "XXXXXXXXXXXXXXXXXXXXXX";
var CONSUMERKEY4 = "WWWWWWWWWWWWWWWWWWWWWW";

var ACCESSTOKEN1 = "BBBBBBBBBBBBBBBBBBBBBB";
var ACCESSTOKEN2 = "CCCCCCCCCCCCCCCCCCCCCC";

var NONCE1 = "YYYYYY";
var NONCE2 = "YYYYYZ";
var NONCE3 = "YYYYZZ";
var NONCE4 = "YYYZZZ";

var TIMESTAMP1 = Math.floor(Date.now()/1000);
var TIMESTAMP2 = Math.floor(Date.now()/1000) + 5;
var TIMESTAMP3 = Math.floor(Date.now()/1000) + 10;
var TIMESTAMP4 = Math.floor(Date.now()/1000) + 15;

suite.addBatch({
    "When we get the Nonce class": {
        topic: function() {
            return require("../lib/model/nonce").Nonce;
        },
        "it works": function(Nonce) {
            assert.isFunction(Nonce);
        },
        "and we check if a brand-new nonce has been seen before": {
            topic: function(Nonce) {
                Nonce.seenBefore(CONSUMERKEY1, ACCESSTOKEN1, NONCE1, TIMESTAMP1, this.callback);
            },
            "it has not": function(err, seen) {
                assert.ifError(err);
                assert.isFalse(seen);
            },
            "and we check if the same nonce has been seen again": {
                topic: function(ignore, Nonce) {
                    Nonce.seenBefore(CONSUMERKEY1, ACCESSTOKEN1, NONCE1, TIMESTAMP1, this.callback);
                },
                "it has": function(err, seen) {
                    assert.ifError(err);
                    assert.isTrue(seen);
                }
            },
            "and we check if the same nonce has been seen with a different access token": {
                topic: function(ignore, Nonce) {
                    Nonce.seenBefore(CONSUMERKEY2, ACCESSTOKEN2, NONCE1, TIMESTAMP1, this.callback);
                },
                "it has not": function(err, seen) {
                    assert.ifError(err);
                    assert.isFalse(seen);
                }
            },
            "and we check if a different nonce has been seen with the same token": {
                topic: function(ignore, Nonce) {
                    Nonce.seenBefore(CONSUMERKEY1, ACCESSTOKEN1, NONCE2, TIMESTAMP1, this.callback);
                },
                "it has not": function(err, seen) {
                    assert.ifError(err);
                    assert.isFalse(seen);
                }
            },
            "and we check if the same nonce has been seen with a different timestamp": {
                topic: function(ignore, Nonce) {
                    Nonce.seenBefore(CONSUMERKEY1, ACCESSTOKEN1, NONCE1, TIMESTAMP2, this.callback);
                },
                "it has not": function(err, seen) {
                    assert.ifError(err);
                    assert.isFalse(seen);
                }
            }
        },
        "and we check if a brand-new nonce has been seen with just a consumer key": {
            topic: function(Nonce) {
                Nonce.seenBefore(CONSUMERKEY3, null, NONCE3, TIMESTAMP3, this.callback);
            },
            "it has not": function(err, seen) {
                assert.ifError(err);
                assert.isFalse(seen);
            },
            "and we check if the same nonce has been seen again": {
                topic: function(ignore, Nonce) {
                    Nonce.seenBefore(CONSUMERKEY3, null, NONCE3, TIMESTAMP3, this.callback);
                },
                "it has": function(err, seen) {
                    assert.ifError(err);
                    assert.isTrue(seen);
                }
            },
            "and we check if the same nonce has been seen with a different consumer key": {
                topic: function(ignore, Nonce) {
                    Nonce.seenBefore(CONSUMERKEY4, null, NONCE3, TIMESTAMP3, this.callback);
                },
                "it has not": function(err, seen) {
                    assert.ifError(err);
                    assert.isFalse(seen);
                }
            },
            "and we check if a new different nonce has been seen with the same consumer key": {
                topic: function(ignore, Nonce) {
                    Nonce.seenBefore(CONSUMERKEY3, null, NONCE4, TIMESTAMP3, this.callback);
                },
                "it has not": function(err, seen) {
                    assert.ifError(err);
                    assert.isFalse(seen);
                }
            },
            "and we check if the same nonce has been seen with a different timestamp": {
                topic: function(ignore, Nonce) {
                    Nonce.seenBefore(CONSUMERKEY3, null, NONCE3, TIMESTAMP4, this.callback);
                },
                "it has not": function(err, seen) {
                    assert.ifError(err);
                    assert.isFalse(seen);
                }
            }
        }
    }
});

suite["export"](module);
