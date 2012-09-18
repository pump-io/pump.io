# schema-test.js
#
# Test the schema module
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
types = ["activity", "user", "client", "requesttoken", "accesstoken", "nonce", "edge", "usercount", "userlist", "stream", "streamcount", "streamsegments", "streamsegment", "streamsegmentcount", "alert", "article", "application", "audio", "badge", "binary", "bookmark", "collection", "comment", "device", "event", "file", "game", "group", "image", "issue", "job", "note", "offer", "organization", "page", "person", "place", "process", "product", "question", "review", "service", "task", "video"]
vows.describe("schema module interface").addBatch("When we require the schema module":
  topic: ->
    require "../lib/schema"

  "we get a module": (schemamodule) ->
    assert.isObject schemamodule

  "and we get its schema":
    topic: (schemamodule) ->
      schemamodule.schema

    "it exists": (schema) ->
      assert.isObject schema

    "it has all the types we expect": (schema) ->
      i = undefined
      type = undefined
      i = 0
      while i < types.length
        type = types[i]
        assert.include schema, type
        i++

    "it has no types we do not expect": (schema) ->
      prop = undefined
      for prop of schema
        assert.include types, prop  if schema.hasOwnProperty(prop)

    "all its types are objects": (schema) ->
      prop = undefined
      for prop of schema
        assert.isObject schema[prop]  if schema.hasOwnProperty(prop)

    "all its types have pkeys": (schema) ->
      prop = undefined
      for prop of schema
        if schema.hasOwnProperty(prop)
          assert.include schema[prop], "pkey"
          assert.isString schema[prop].pkey
)["export"] module
