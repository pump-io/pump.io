# client-dialback-test.js
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
querystring = require("querystring")
_ = require("underscore")
httputil = require("./lib/http")
oauthutil = require("./lib/oauth")
dialbackApp = require("./lib/dialback").dialbackApp
setupApp = oauthutil.setupApp
suite = vows.describe("client registration with dialback")
dbreg = (id, token, ts, params, callback) ->
  URL = "http://localhost:4815/api/client/register"
  requestBody = querystring.stringify(params)
  httputil.dialbackPost URL, id, token, ts, requestBody, "application/x-www-form-urlencoded", callback

assoc = (id, token, ts) ->
  ->
    callback = @callback
    ts = Date.now()  unless ts
    dbreg id, token, ts,
      type: "client_associate"
    , callback

assocFail = (id, token, ts) ->
  topic: assoc(id, token, ts)
  "it fails correctly": (err, res, body) ->
    assert.ifError err
    assert.equal res.statusCode, 401

assocSucceed = (id, token, ts) ->
  topic: assoc(id, token, ts)
  "it works": (err, res, body) ->
    assert.ifError err
    assert.greater res.statusCode, 199
    assert.lesser res.statusCode, 300

  "it looks right": (err, res, body) ->
    parsed = undefined
    assert.ifError err
    assert.greater res.statusCode, 199
    assert.lesser res.statusCode, 300
    parsed = JSON.parse(body)
    assert.include parsed, "client_id"
    assert.include parsed, "client_secret"
    assert.include parsed, "expires_at"

suite.addBatch "When we set up the app":
  topic: ->
    app = undefined
    callback = @callback
    Step (->
      setupApp this
    ), ((err, result) ->
      throw err  if err
      app = result
      dialbackApp 80, "dialback.localhost", this
    ), (err, dbapp) ->
      if err
        callback err, null, null
      else
        callback err, app, dbapp


  teardown: (app, dbapp) ->
    app.close()
    dbapp.close()

  "it works": (err, app, dbapp) ->
    assert.ifError err

  "and we try to register with an invalid host": assocFail("social.invalid", "VALID1")
  "and we try to register with an invalid webfinger domain": assocFail("alice@social.invalid", "VALID2")
  "and we try to register with an invalid webfinger": assocFail("invalid@dialback.localhost", "VALID3")
  "and we try to register with a valid webfinger and invalid token": assocFail("valid@dialback.localhost", "INVALID")
  "and we try to register with a valid webfinger and valid token and out-of-bounds date": assocFail("valid1@dialback.localhost", "VALID4", Date.now() - 600000)
  "and we try to register with a valid host and invalid token": assocFail("dialback.localhost", "INVALID")
  "and we try to register with a valid host and valid token and out-of-bounds date": assocFail("dialback.localhost", "VALID5", Date.now() - 600000)
  "and we try to register with a valid webfinger and valid token": assocSucceed("valid2@dialback.localhost", "VALID6")
  "and we try to register with a valid host and valid token": assocSucceed("dialback.localhost", "VALID7")

suite["export"] module
