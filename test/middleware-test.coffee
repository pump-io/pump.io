# middleware-test.js
#
# Test the middleware module
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
httpMocks = require("node-mocks-http")
schema = require("../lib/schema")
URLMaker = require("../lib/urlmaker").URLMaker
User = require("../lib/model/user").User
methodContext = require("./lib/methods").methodContext
Databank = databank.Databank
DatabankObject = databank.DatabankObject
robby = undefined
maya = undefined

# Need this to make IDs

# Dummy databank
vows.describe("middleware module interface").addBatch("When we load the module":
  topic: ->
    cb = @callback
    URLMaker.hostname = "example.net"
    params = schema: schema
    db = Databank.get("memory", params)
    Step (->
      db.connect {}, this
    ), ((err) ->
      throw err  if err
      DatabankObject.bank = db
      User.create
        nickname: "robby"
        password: "kangaroo"
      , @parallel()
      User.create
        nickname: "maya"
        password: "mangopickle"
      , @parallel()
    ), (err, user1, user2) ->
      mw = undefined
      if err
        cb err, null
      else
        robby = user1
        maya = user2
        mw = require("../lib/middleware")
        cb null, mw


  "there is one": (err, mw) ->
    assert.ifError err
    assert.isObject mw

  "and we check its methods": methodContext(["maybeAuth", "reqUser", "mustAuth", "sameUser", "noUser", "checkCredentials", "getCurrentUser", "getSessionUser"])
  "and we use reqUser with no nickname param":
    topic: (mw) ->
      cb = @callback
      req = httpMocks.createRequest(
        method: "get"
        url: "/api/user/"
        params: {}
      )
      res = httpMocks.createResponse()
      mw.reqUser req, res, (err) ->
        if err and err.code and err.code is 404
          cb null
        else if err
          cb err
        else
          cb new Error("Unexpected success!")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we use reqUser with an invalid nickname param":
    topic: (mw) ->
      cb = @callback
      req = httpMocks.createRequest(
        method: "get"
        url: "/api/user/notanickname"
        params:
          nickname: "notanickname"
      )
      res = httpMocks.createResponse()
      mw.reqUser req, res, (err) ->
        if err and err.code and err.code is 404
          cb null
        else if err
          cb err
        else
          cb new Error("Unexpected success!")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we use reqUser with a nickname param only off by case":
    topic: (mw) ->
      cb = @callback
      req = httpMocks.createRequest(
        method: "get"
        url: "/api/user/Robby"
        params:
          nickname: "Robby"
      )
      res = httpMocks.createResponse()
      mw.reqUser req, res, (err) ->
        if err and err.code and err.code is 404
          cb null
        else if err
          cb err
        else
          cb new Error("Unexpected success!")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we use reqUser with a valid nickname param":
    topic: (mw) ->
      cb = @callback
      req = httpMocks.createRequest(
        method: "get"
        url: "/api/user/robby"
        params:
          nickname: "robby"
      )
      res = httpMocks.createResponse()
      mw.reqUser req, res, (err) ->
        if err
          cb err
        else
          cb null


    "it works": (err) ->
      assert.ifError err

  "and we use sameUser() with remoteUser but no user":
    topic: (mw) ->
      cb = @callback
      req = httpMocks.createRequest(
        method: "get"
        url: "/api/user/"
        params: {}
        remoteUser: maya
      )
      res = httpMocks.createResponse()
      mw.sameUser req, res, (err) ->
        if err
          cb null
        else
          cb new Error("Unexpected success!")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we use sameUser() with user but no remoteUser":
    topic: (mw) ->
      cb = @callback
      req = httpMocks.createRequest(
        method: "get"
        url: "/api/user/robby"
        params:
          nickname: "robby"

        user: robby
      )
      res = httpMocks.createResponse()
      mw.sameUser req, res, (err) ->
        if err
          cb null
        else
          cb new Error("Unexpected success!")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we use sameUser() with user not matching remoteUser":
    topic: (mw) ->
      cb = @callback
      req = httpMocks.createRequest(
        method: "get"
        url: "/api/user/robby"
        params:
          nickname: "robby"

        user: robby
        remoteUser: maya
      )
      res = httpMocks.createResponse()
      mw.sameUser req, res, (err) ->
        if err
          cb null
        else
          cb new Error("Unexpected success!")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we use sameUser() with user matching remoteUser":
    topic: (mw) ->
      cb = @callback
      req = httpMocks.createRequest(
        method: "get"
        url: "/api/user/robby"
        params:
          nickname: "robby"

        user: robby
        remoteUser: robby
      )
      res = httpMocks.createResponse()
      mw.sameUser req, res, (err) ->
        if err
          cb null
        else
          cb new Error("Unexpected success!")


    "it fails correctly": (err) ->
      assert.ifError err
)["export"] module
