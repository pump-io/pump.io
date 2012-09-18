# randomstring-test.js
#
# Test the randomstring module
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
vows.describe("randomstring module interface").addBatch("When we require the randomstring module":
  topic: ->
    require "../lib/randomstring"

  "we get a module back": (rs) ->
    assert.ok rs

  "we can get the randomString function":
    topic: (rs) ->
      rs.randomString

    "which is a function": (randomString) ->
      assert.isFunction randomString

    "we can get a random string":
      topic: (randomString) ->
        randomString 16, @callback

      "without an error": (err, value) ->
        assert.ifError err

      "with a string return value": (err, value) ->
        assert.isString value

      "with only URL-safe characters": (err, value) ->
        assert.match value, /^[A-Za-z0-9\-_]+$/
)["export"] module
