# person-test.js
#
# Test the person module
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
schema = require("../lib/schema").schema
URLMaker = require("../lib/urlmaker").URLMaker
modelBatch = require("./lib/model").modelBatch
Databank = databank.Databank
DatabankObject = databank.DatabankObject
suite = vows.describe("person module interface")
testSchema =
  pkey: "id"
  fields: ["displayName", "image", "published", "updated", "url", "uuid"]
  indices: ["uuid"]

testData =
  create:
    displayName: "George Washington"
    image:
      url: "http://www.georgewashington.si.edu/portrait/images/face.jpg"
      width: 83
      height: 120

  update:
    displayName: "President George Washington"

suite.addBatch modelBatch("person", "Person", testSchema, testData)
suite.addBatch "When we get the Person class":
  topic: ->
    cb = @callback
    
    # Need this to make IDs
    URLMaker.hostname = "example.net"
    URLMaker.port = 4815
    
    # Dummy databank
    params = schema: schema
    db = Databank.get("memory", params)
    db.connect {}, (err) ->
      mod = undefined
      if err
        cb err, null
        return
      DatabankObject.bank = db
      mod = require("../lib/model/person")
      unless mod
        cb new Error("No module"), null
        return
      cb null, mod.Person


  "it works": (err, Person) ->
    assert.ifError err
    assert.isFunction Person

  "and we instantiate a non-user Person":
    topic: (Person) ->
      Person.create
        displayName: "Gerald"
      , @callback

    "it works": (err, person) ->
      assert.ifError err
      assert.isObject person
      assert.instanceOf person, require("../lib/model/person").Person

    "it has a followersURL() method": (err, person) ->
      assert.ifError err
      assert.isObject person
      assert.isFunction person.followersURL

    "and we get its followersURL":
      topic: (person) ->
        person.followersURL @callback

      "it works": (err, url) ->
        assert.ifError err

      "it is null": (err, url) ->
        assert.ifError err
        assert.isNull url

  "and we create a user":
    topic: (Person) ->
      User = require("../lib/model/user").User
      User.create
        nickname: "evan"
        password: "123456"
      , @callback

    "it works": (err, user) ->
      assert.ifError err

    "and we get the followersURL of the profile":
      topic: (user) ->
        user.profile.followersURL @callback

      "it works": (err, url) ->
        assert.ifError err
        assert.isString url

      "data is correct": (err, url) ->
        assert.ifError err
        assert.isString url
        assert.equal url, "http://example.net:4815/api/user/evan/followers"

suite["export"] module
