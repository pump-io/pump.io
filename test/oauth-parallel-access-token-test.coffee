# oauth-test.js
#
# Test the client registration API
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
Step = require("step")
_ = require("underscore")
querystring = require("querystring")
http = require("http")
OAuth = require("oauth").OAuth
Browser = require("zombie")
httputil = require("./lib/http")
oauthutil = require("./lib/oauth")
setupApp = oauthutil.setupApp
requestToken = oauthutil.requestToken
newClient = oauthutil.newClient
register = oauthutil.register
accessToken = oauthutil.accessToken
ignore = (err) ->

suite = vows.describe("OAuth parallel access tokens")

# A batch to test lots of parallel access token requests
suite.addBatch "When we set up the app":
  topic: ->
    setupApp @callback

  teardown: (app) ->
    app.close()  if app and app.close

  "it works": (err, app) ->
    assert.ifError err

  "and we get a lot of access tokens in parallel for a single client":
    topic: ->
      cb = @callback
      cl = undefined
      Step (->
        newClient this
      ), ((err, res) ->
        i = undefined
        group = @group()
        throw err  if err
        cl = res
        i = 0
        while i < 25
          register cl, "testuser" + i, "password" + i, group()
          i++
      ), ((err, users) ->
        i = undefined
        group = @group()
        throw err  if err
        i = 0
        while i < 25
          accessToken cl,
            nickname: "testuser" + i
            password: "password" + i
          , group()
          i++
      ), (err, pairs) ->
        if err
          cb err, null
        else
          cb null, pairs


    "it works": (err, pairs) ->
      i = undefined
      assert.ifError err
      assert.isArray pairs
      assert.lengthOf pairs, 25
      i = 0
      while i < pairs.length
        assert.include pairs[i], "token"
        assert.isString pairs[i].token
        assert.include pairs[i], "token_secret"
        assert.isString pairs[i].token_secret
        i++

suite["export"] module
