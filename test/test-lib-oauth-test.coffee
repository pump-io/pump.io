# test-lib-oauth-test.js
#
# Test the test libraries
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
http = require("http")
vows = require("vows")
Step = require("step")
_ = require("underscore")
suite = vows.describe("user REST API")
suite.addBatch "When we load the module":
  topic: ->
    require "./lib/oauth"

  "it works": (oauth) ->
    assert.isObject oauth

  "it has a setupApp() export": (oauth) ->
    assert.isTrue _(oauth).has("setupApp")
    assert.isFunction oauth.setupApp

  "it has a newClient() export": (oauth) ->
    assert.isTrue _(oauth).has("newClient")
    assert.isFunction oauth.newClient

  "it has a register() export": (oauth) ->
    assert.isTrue _(oauth).has("register")
    assert.isFunction oauth.register

  "it has a requestToken() export": (oauth) ->
    assert.isTrue _(oauth).has("requestToken")
    assert.isFunction oauth.requestToken

  "it has a newCredentials() export": (oauth) ->
    assert.isTrue _(oauth).has("newCredentials")
    assert.isFunction oauth.newCredentials

  "it has a accessToken() export": (oauth) ->
    assert.isTrue _(oauth).has("accessToken")
    assert.isFunction oauth.accessToken

  "and we setup the app":
    topic: (oauth) ->
      oauth.setupApp @callback

    "it works": (err, app) ->
      assert.ifError err
      assert.isObject app

    teardown: (app) ->
      app.close()  if app and app.close

    "and we create a new client":
      topic: (app, oauth) ->
        oauth.newClient @callback

      "it works": (err, client) ->
        assert.ifError err
        assert.isObject client
        assert.include client, "client_id"
        assert.isString client.client_id
        assert.include client, "client_secret"
        assert.isString client.client_secret

      "and we register a new user":
        topic: (client, app, oauth) ->
          oauth.register client, "alice", "waters", @callback

        "it works": (err, user) ->
          assert.ifError err
          assert.isObject user

        "and we get a new access token":
          topic: (user, client, app, oauth) ->
            oauth.accessToken client,
              nickname: "alice"
              password: "waters"
            , @callback

          "it works": (err, pair) ->
            assert.ifError err
            assert.isObject pair
            assert.include pair, "token"
            assert.isString pair.token
            assert.include pair, "token_secret"
            assert.isString pair.token_secret

    "and we get new credentials":
      topic: (app, oauth) ->
        oauth.newCredentials "jasper", "johns", @callback

      "it works": (err, cred) ->
        assert.ifError err
        assert.isObject cred
        assert.include cred, "consumer_key"
        assert.isString cred.consumer_key
        assert.include cred, "consumer_secret"
        assert.isString cred.consumer_secret
        assert.include cred, "token"
        assert.isString cred.token
        assert.include cred, "token_secret"
        assert.isString cred.token_secret

suite["export"] module
