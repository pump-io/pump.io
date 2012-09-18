# nonce-test.js
#
# Test the nonce module
#
# Copyright 2012, StatusNet Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
assert = require("assert")
vows = require("vows")
databank = require("databank")
URLMaker = require("../lib/urlmaker").URLMaker
modelBatch = require("./lib/model").modelBatch
Databank = databank.Databank
DatabankObject = databank.DatabankObject
suite = vows.describe("nonce module interface")
testSchema =
  pkey: "token_nonce"
  fields: ["nonce", "consumer_key", "access_token", "timestamp"]
  indices: ["consumer_key"]

testData =
  create:
    consumer_key: "ZZZZZZZZZZZZZZZZZZZZZZZ"
    access_token: "AAAAAAAAAAAAAAAAAAAAAAA"
    nonce: "BBBBBB"
    timestamp: 1337801665

  update:
    timestamp: 1337801765

mb = modelBatch("nonce", "Nonce", testSchema, testData)
mb["When we require the nonce module"]["and we get its Nonce class export"]["and we create a nonce instance"]["auto-generated fields are there"] = (err, created) ->
  assert.isString created.token_nonce

mb["When we require the nonce module"]["and we get its Nonce class export"]["and we create a nonce instance"]["and we modify it"]["it is modified"] = (err, updated) ->
  assert.ifError err

suite.addBatch mb
CONSUMERKEY1 = "ZZZZZZZZZZZZZZZZZZZZZZ"
CONSUMERKEY2 = "YYYYYYYYYYYYYYYYYYYYYY"
CONSUMERKEY3 = "XXXXXXXXXXXXXXXXXXXXXX"
CONSUMERKEY4 = "WWWWWWWWWWWWWWWWWWWWWW"
ACCESSTOKEN1 = "BBBBBBBBBBBBBBBBBBBBBB"
ACCESSTOKEN2 = "CCCCCCCCCCCCCCCCCCCCCC"
NONCE1 = "YYYYYY"
NONCE2 = "YYYYYZ"
NONCE3 = "YYYYZZ"
NONCE4 = "YYYZZZ"
TIMESTAMP1 = Math.floor(Date.now() / 1000)
TIMESTAMP2 = Math.floor(Date.now() / 1000) + 5
TIMESTAMP3 = Math.floor(Date.now() / 1000) + 10
TIMESTAMP4 = Math.floor(Date.now() / 1000) + 15
suite.addBatch "When we get the Nonce class":
  topic: ->
    require("../lib/model/nonce").Nonce

  "it works": (Nonce) ->
    assert.isFunction Nonce

  "and we check if a brand-new nonce has been seen before":
    topic: (Nonce) ->
      Nonce.seenBefore CONSUMERKEY1, ACCESSTOKEN1, NONCE1, TIMESTAMP1, @callback

    "it has not": (err, seen) ->
      assert.ifError err
      assert.isFalse seen

    "and we check if the same nonce has been seen again":
      topic: (ignore, Nonce) ->
        Nonce.seenBefore CONSUMERKEY1, ACCESSTOKEN1, NONCE1, TIMESTAMP1, @callback

      "it has": (err, seen) ->
        assert.ifError err
        assert.isTrue seen

    "and we check if the same nonce has been seen with a different access token":
      topic: (ignore, Nonce) ->
        Nonce.seenBefore CONSUMERKEY2, ACCESSTOKEN2, NONCE1, TIMESTAMP1, @callback

      "it has not": (err, seen) ->
        assert.ifError err
        assert.isFalse seen

    "and we check if a different nonce has been seen with the same token":
      topic: (ignore, Nonce) ->
        Nonce.seenBefore CONSUMERKEY1, ACCESSTOKEN1, NONCE2, TIMESTAMP1, @callback

      "it has not": (err, seen) ->
        assert.ifError err
        assert.isFalse seen

    "and we check if the same nonce has been seen with a different timestamp":
      topic: (ignore, Nonce) ->
        Nonce.seenBefore CONSUMERKEY1, ACCESSTOKEN1, NONCE1, TIMESTAMP2, @callback

      "it has not": (err, seen) ->
        assert.ifError err
        assert.isFalse seen

  "and we check if a brand-new nonce has been seen with just a consumer key":
    topic: (Nonce) ->
      Nonce.seenBefore CONSUMERKEY3, null, NONCE3, TIMESTAMP3, @callback

    "it has not": (err, seen) ->
      assert.ifError err
      assert.isFalse seen

    "and we check if the same nonce has been seen again":
      topic: (ignore, Nonce) ->
        Nonce.seenBefore CONSUMERKEY3, null, NONCE3, TIMESTAMP3, @callback

      "it has": (err, seen) ->
        assert.ifError err
        assert.isTrue seen

    "and we check if the same nonce has been seen with a different consumer key":
      topic: (ignore, Nonce) ->
        Nonce.seenBefore CONSUMERKEY4, null, NONCE3, TIMESTAMP3, @callback

      "it has not": (err, seen) ->
        assert.ifError err
        assert.isFalse seen

    "and we check if a new different nonce has been seen with the same consumer key":
      topic: (ignore, Nonce) ->
        Nonce.seenBefore CONSUMERKEY3, null, NONCE4, TIMESTAMP3, @callback

      "it has not": (err, seen) ->
        assert.ifError err
        assert.isFalse seen

    "and we check if the same nonce has been seen with a different timestamp":
      topic: (ignore, Nonce) ->
        Nonce.seenBefore CONSUMERKEY3, null, NONCE3, TIMESTAMP4, @callback

      "it has not": (err, seen) ->
        assert.ifError err
        assert.isFalse seen

suite["export"] module
