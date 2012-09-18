# idmaker-test.js
#
# Test the idmaker module
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
vows.describe("idmaker module interface").addBatch("When we require the idmaker module":
  topic: ->
    require "../lib/idmaker"

  "it works": (idmaker) ->
    assert.isObject idmaker

  "and we get its IDMaker export":
    topic: (idmaker) ->
      idmaker.IDMaker

    "it exists": (IDMaker) ->
      assert.isObject IDMaker

    "it has a makeID() method": (IDMaker) ->
      assert.isFunction IDMaker.makeID

    "and we make an ID":
      topic: (IDMaker) ->
        IDMaker.makeID()

      "it works": (id) ->
        assert.isString id

      "it is URL-safe": (id) ->
        assert.equal id, encodeURIComponent(id)

      "it looks big enough for 128 bits of data": (id) ->
        assert.isTrue id.length >= 16
)["export"] module
