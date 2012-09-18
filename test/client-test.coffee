# client-test.js
#
# Test the client module
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
suite = vows.describe("client module interface")
testSchema =
  pkey: "consumer_key"
  fields: ["title", "description", "host", "webfinger", "secret", "contacts", "logo_url", "redirect_uris", "type", "created", "updated"]
  indices: ["host", "webfinger"]

testData =
  create:
    title: "MyApp"
    description: "an app I made"
    identity: "example.com"
    contacts: ["evan@example.com"]
    type: "web"

  update:
    contacts: ["evan@example.com", "jerry@example.com"]

mb = modelBatch("client", "Client", testSchema, testData)
mb["When we require the client module"]["and we get its Client class export"]["and we create a client instance"]["auto-generated fields are there"] = (err, created) ->
  assert.isString created.consumer_key
  assert.isString created.secret
  assert.isString created.created
  assert.isString created.updated

suite.addBatch mb
suite.addBatch "When we get the Client class":
  topic: ->
    require("../lib/model/client").Client

  "it works": (Client) ->
    assert.isFunction Client

  "and we create a client with a 'host' property":
    topic: (Client) ->
      Client.create
        host: "photo.example"
      , @callback

    "it works": (err, client) ->
      assert.ifError err
      assert.isObject client

  "and we create a client with a 'webfinger' property":
    topic: (Client) ->
      Client.create
        webfinger: "alice@geographic.example"
      , @callback

    "it works": (err, client) ->
      assert.ifError err
      assert.isObject client

  "and we create a client with both 'host' and 'webfinger'":
    topic: (Client) ->
      callback = @callback
      Client.create
        host: "music.example"
        webfinger: "bob@music.example"
      , (err, client) ->
        if err
          callback null
        else
          callback new Error("Unexpected success")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we create a client with neither 'host' nor 'webfinger'":
    topic: (Client) ->
      Client.create
        title: "My program"
      , @callback

    "it works": (err, client) ->
      assert.ifError err
      assert.isObject client

  "and we create two clients with the same 'host'":
    topic: (Client) ->
      callback = @callback
      client1 = undefined
      client2 = undefined
      Step (->
        Client.create
          host: "video.example"
        , this
      ), ((err, client) ->
        throw err  if err
        client1 = client
        Client.create
          host: "video.example"
        , this
      ), (err, client) ->
        if err
          callback err, null, null
        else
          client2 = client
          callback err, client1, client2


    "it works": (err, client1, client2) ->
      assert.ifError err

    "they are distinct": (err, client1, client2) ->
      assert.ifError err
      assert.isObject client1
      assert.isObject client2
      assert.notEqual client1.consumer_key, client2.consumer_key

  "and we create two clients with the same 'webfinger'":
    topic: (Client) ->
      callback = @callback
      client1 = undefined
      client2 = undefined
      Step (->
        Client.create
          webfinger: "charlie@blog.example"
        , this
      ), ((err, client) ->
        throw err  if err
        client1 = client
        Client.create
          webfinger: "charlie@blog.example"
        , this
      ), (err, client) ->
        if err
          callback err, null, null
        else
          client2 = client
          callback err, client1, client2


    "it works": (err, client1, client2) ->
      assert.ifError err

    "they are distinct": (err, client1, client2) ->
      assert.ifError err
      assert.isObject client1
      assert.isObject client2
      assert.notEqual client1.consumer_key, client2.consumer_key

suite["export"] module
