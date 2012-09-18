# collection-test.js
#
# Test the collection module
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
Step = require("step")
URLMaker = require("../lib/urlmaker").URLMaker
modelBatch = require("./lib/model").modelBatch
Databank = databank.Databank
DatabankObject = databank.DatabankObject
suite = vows.describe("collection module interface")
testSchema =
  pkey: "id"
  fields: ["author", "displayName", "image", "objectTypes", "published", "summary", "updated", "url"]

testData =
  create:
    displayName: "Vacation 2011"
    url: "http://example.com/collection/photos/vacation-2011"
    image:
      url: "http://example.com/images/collections/vacation-2011.jpg"
      height: 140
      width: 140

    objectTypes: ["image", "video"]

  update:
    displayName: "Vacation Summer 2011"

suite.addBatch modelBatch("collection", "Collection", testSchema, testData)
suite.addBatch "When we get the Collection class":
  topic: ->
    require("../lib/model/collection").Collection

  "it exists": (Collection) ->
    assert.isFunction Collection

  "it has an isList() method": (Collection) ->
    assert.isFunction Collection.isList

  "it has a checkList() method": (Collection) ->
    assert.isFunction Collection.checkList

  "it has a PUBLIC member with the correct value": (Collection) ->
    assert.isString Collection.PUBLIC
    assert.equal Collection.PUBLIC, "http://activityschema.org/collection/public"

  "and we create a user":
    topic: (Collection) ->
      User = require("../lib/model/user").User
      Step (->
        props =
          nickname: "carlyle"
          password: "123456"

        User.create props, this
      ), @callback

    "it works": (err, user) ->
      assert.ifError err
      assert.isObject user

    "and we create a list":
      topic: (user, Collection) ->
        list =
          author: user.profile
          displayName: "Neighbors"
          objectTypes: ["person"]

        Collection.create list, @callback

      "it works": (err, collection) ->
        assert.ifError err
        assert.isObject collection

      "it has a getStream() method": (err, collection) ->
        assert.ifError err
        assert.isObject collection
        assert.isFunction collection.getStream

      "and we get the collection stream":
        topic: (coll) ->
          coll.getStream @callback

        "it works": (err, stream) ->
          assert.ifError err
          assert.isObject stream

      "and we get the user's lists":
        topic: (coll, user) ->
          callback = @callback
          Step (->
            user.getLists this
          ), ((err, stream) ->
            throw err  if err
            stream.getIDs 0, 20, this
          ), (err, ids) ->
            if err
              callback err, null, null
            else
              callback err, ids, coll


        "it works": (err, ids, coll) ->
          assert.ifError err
          assert.isArray ids
          assert.isObject coll

        "it has the right data": (err, ids, coll) ->
          assert.ifError err
          assert.isArray ids
          assert.isObject coll
          assert.lengthOf ids, 6
          assert.equal ids[0], coll.id

suite["export"] module
