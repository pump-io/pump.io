# user-rest-test.js
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
http = require("http")
vows = require("vows")
Step = require("step")
_ = require("underscore")
OAuth = require("oauth").OAuth
httputil = require("./lib/http")
oauthutil = require("./lib/oauth")
setupApp = oauthutil.setupApp
newClient = oauthutil.newClient
register = oauthutil.register
accessToken = oauthutil.accessToken
suite = vows.describe("user REST API")
invert = (callback) ->
  (err) ->
    if err
      callback null
    else
      callback new Error("Unexpected success")

suite.addBatch "When we set up the app":
  topic: ->
    cb = @callback
    setupApp (err, app) ->
      if err
        cb err, null, null
      else
        newClient (err, cl) ->
          if err
            cb err, null, null
          else
            
            # sneaky, but we just need it for teardown
            cl.app = app
            cb err, cl



  "it works": (err, cl) ->
    assert.ifError err
    assert.isObject cl

  teardown: (cl) ->
    if cl and cl.del
      cl.del (err) ->

    cl.app.close()  if cl.app

  "and we try to get a non-existent user":
    topic: (cl) ->
      httputil.getJSON "http://localhost:4815/api/user/nonexistent",
        consumer_key: cl.client_id
        consumer_secret: cl.client_secret
      , invert(@callback)

    "it fails correctly": (err) ->
      assert.ifError err

  "and we register a user":
    topic: (cl) ->
      register cl, "zardoz", "m3rl1n", @callback

    "it works": (err, user) ->
      assert.ifError err

    "and we get the options on the user api endpoint": httputil.endpoint("/api/user/zardoz", ["GET", "PUT", "DELETE"])
    "and we GET the user data without OAuth credentials":
      topic: ->
        cb = @callback
        options =
          host: "localhost"
          port: 4815
          path: "/api/user/zardoz"

        http.get(options, (res) ->
          if res.statusCode >= 400 and res.statusCode < 500
            cb null
          else
            cb new Error("Unexpected status code")
        ).on "error", (err) ->
          cb err


      "it fails correctly": (err) ->
        assert.ifError err

    "and we GET the user data with invalid client credentials":
      topic: (user, cl) ->
        httputil.getJSON "http://localhost:4815/api/user/zardoz",
          consumer_key: "NOTACLIENT"
          consumer_secret: "NOTASECRET"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we GET the user data with client credentials and no access token":
      topic: (user, cl) ->
        httputil.getJSON "http://localhost:4815/api/user/zardoz",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
        , @callback

      "it works": (err, doc) ->
        assert.ifError err
        assert.include doc, "nickname"
        assert.include doc, "published"
        assert.include doc, "updated"
        assert.include doc, "profile"
        assert.isObject doc.profile
        assert.include doc.profile, "id"
        assert.include doc.profile, "objectType"
        assert.equal doc.profile.objectType, "person"

    "and we GET the user data with client credentials and an invalid access token":
      topic: (user, cl) ->
        httputil.getJSON "http://localhost:4815/api/user/zardoz",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
          token: "NOTATOKEN"
          token_secret: "NOTASECRET"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we GET the user data with client credentials and the same user's access token":
      topic: (user, cl) ->
        cb = @callback
        Step (->
          accessToken cl,
            nickname: "zardoz"
            password: "m3rl1n"
          , this
        ), ((err, pair) ->
          throw err  if err
          httputil.getJSON "http://localhost:4815/api/user/zardoz",
            consumer_key: cl.client_id
            consumer_secret: cl.client_secret
            token: pair.token
            token_secret: pair.token_secret
          , this
        ), (err, results) ->
          if err
            cb err, null
          else
            cb null, results


      "it works": (err, doc) ->
        assert.ifError err
        assert.include doc, "nickname"
        assert.include doc, "published"
        assert.include doc, "updated"
        assert.include doc, "profile"
        assert.isObject doc.profile
        assert.include doc.profile, "id"
        assert.include doc.profile, "objectType"
        assert.equal doc.profile.objectType, "person"

    "and we GET the user data with client credentials and a different user's access token":
      topic: (user, cl) ->
        cb = @callback
        Step (->
          register cl, "yankee", "doodle", this
        ), ((err, user2) ->
          throw err  if err
          accessToken cl,
            nickname: "yankee"
            password: "doodle"
          , this
        ), ((err, pair) ->
          throw err  if err
          httputil.getJSON "http://localhost:4815/api/user/zardoz",
            consumer_key: cl.client_id
            consumer_secret: cl.client_secret
            token: pair.token
            token_secret: pair.token_secret
          , this
        ), (err, results) ->
          if err
            cb err, null
          else
            cb null, results


      "it works": (err, doc) ->
        assert.ifError err
        assert.include doc, "nickname"
        assert.include doc, "published"
        assert.include doc, "updated"
        assert.include doc, "profile"
        assert.isObject doc.profile
        assert.include doc.profile, "id"
        assert.include doc.profile, "objectType"
        assert.equal doc.profile.objectType, "person"

suite.addBatch "When we set up the app":
  topic: ->
    cb = @callback
    setupApp (err, app) ->
      if err
        cb err, null, null
      else
        newClient (err, cl) ->
          if err
            cb err, null, null
          else
            cb err, cl, app



  "it works": (err, cl, app) ->
    assert.ifError err
    assert.isObject cl

  teardown: (cl, app) ->
    if cl and cl.del
      cl.del (err) ->

    app.close()  if app

  "and we try to put a non-existent user":
    topic: (cl) ->
      httputil.putJSON "http://localhost:4815/api/user/nonexistent",
        consumer_key: cl.client_id
        consumer_secret: cl.client_secret
      ,
        nickname: "nonexistent"
        password: "whatever"
      , invert(@callback)

    "it fails correctly": (err) ->
      assert.ifError err

  "and we register a user":
    topic: (cl) ->
      register cl, "xerxes", "sparta", @callback

    "it works": (err, user) ->
      assert.ifError err

    "and we PUT new user data without OAuth credentials":
      topic: (user, cl) ->
        cb = @callback
        options =
          host: "localhost"
          port: 4815
          path: "/api/user/xerxes"
          method: "PUT"
          headers:
            "User-Agent": "activitypump-test/0.1.0dev"
            "Content-Type": "application/json"

        req = http.request(options, (res) ->
          if res.statusCode >= 400 and res.statusCode < 500
            cb null
          else
            cb new Error("Unexpected status code")
        ).on("error", (err) ->
          cb err
        )
        req.write JSON.stringify(
          nickname: "xerxes"
          password: "athens"
        )
        req.end()

      "it fails correctly": (err) ->
        assert.ifError err

    "and we PUT new user data with invalid client credentials":
      topic: (user, cl) ->
        httputil.putJSON "http://localhost:4815/api/user/xerxes",
          consumer_key: "BADKEY"
          consumer_secret: "BADSECRET"
        ,
          nickname: "xerxes"
          password: "thebes"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we PUT new user data with client credentials and no access token":
      topic: (user, cl) ->
        httputil.putJSON "http://localhost:4815/api/user/xerxes",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
        ,
          nickname: "xerxes"
          password: "corinth"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we PUT new user data with client credentials and an invalid access token":
      topic: (user, cl) ->
        httputil.putJSON "http://localhost:4815/api/user/xerxes",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
          token: "BADTOKEN"
          token_secret: "BADSECRET"
        ,
          nickname: "xerxes"
          password: "thessaly"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we PUT new user data with client credentials and a different user's access token":
      topic: (user, cl) ->
        cb = @callback
        Step (->
          register cl, "themistocles", "salamis", this
        ), ((err, res) ->
          throw err  if err
          accessToken cl,
            nickname: "themistocles"
            password: "salamis"
          , this
        ), (err, pair) ->
          if err
            cb err
          else
            httputil.putJSON "http://localhost:4815/api/user/xerxes",
              consumer_key: cl.client_id
              consumer_secret: cl.client_secret
              token: pair.token
              token_secret: pair.token_secret
            ,
              nickname: "xerxes"
              password: "isuck"
            , invert(cb)


      "it fails correctly": (err) ->
        assert.ifError err

    "and we PUT new user data with client credentials and the same user's access token":
      topic: (user, cl) ->
        cb = @callback
        Step (->
          accessToken cl,
            nickname: "xerxes"
            password: "sparta"
          , this
        ), (err, pair) ->
          if err
            cb err
          else
            httputil.putJSON "http://localhost:4815/api/user/xerxes",
              consumer_key: cl.client_id
              consumer_secret: cl.client_secret
              token: pair.token
              token_secret: pair.token_secret
            ,
              nickname: "xerxes"
              password: "athens"
            , cb


      "it works": (err, doc) ->
        assert.ifError err
        assert.include doc, "nickname"
        assert.include doc, "published"
        assert.include doc, "updated"
        assert.include doc, "profile"
        assert.isObject doc.profile
        assert.include doc.profile, "id"
        assert.include doc.profile, "objectType"
        assert.equal doc.profile.objectType, "person"

suite.addBatch "When we set up the app":
  topic: ->
    cb = @callback
    setupApp (err, app) ->
      if err
        cb err, null, null
      else
        newClient (err, cl) ->
          if err
            cb err, null, null
          else
            cb err, cl, app



  "it works": (err, cl, app) ->
    assert.ifError err
    assert.isObject cl

  teardown: (cl, app) ->
    if cl and cl.del
      cl.del (err) ->

    app.close()  if app

  "and we register a user":
    topic: (cl) ->
      register cl, "c3po", "ihateanakin", @callback

    "it works": (err, user) ->
      assert.ifError err

    "and we get an access token":
      topic: (user, cl) ->
        accessToken cl,
          nickname: "c3po"
          password: "ihateanakin"
        , @callback

      "it works": (err, pair) ->
        assert.ifError err
        assert.isObject pair
        assert.isString pair.token
        assert.isString pair.token_secret

      "and we PUT third-party user data":
        topic: (pair, user, cl) ->
          cb = @callback
          httputil.putJSON "http://localhost:4815/api/user/c3po",
            consumer_key: cl.client_id
            consumer_secret: cl.client_secret
            token: pair.token
            token_secret: pair.token_secret
          ,
            nickname: "c3po"
            password: "ihateanakin"
            langs: 6000000
          , (err, body, res) ->
            cb err, body


        "it works": (err, res) ->
          assert.ifError err
          assert.include res, "langs"
          assert.equal res.langs, 6000000

        "and we GET user with third-party data":
          topic: (dup, pair, user, cl) ->
            httputil.getJSON "http://localhost:4815/api/user/c3po",
              consumer_key: cl.client_id
              consumer_secret: cl.client_secret
              token: pair.token
              token_secret: pair.token_secret
            , @callback

          "it works": (err, res) ->
            assert.ifError err
            assert.include res, "langs"
            assert.equal res.langs, 6000000

suite.addBatch "When we set up the app":
  topic: ->
    cb = @callback
    setupApp (err, app) ->
      if err
        cb err, null, null
      else
        newClient (err, cl) ->
          if err
            cb err, null, null
          else
            cb err, cl, app



  "it works": (err, cl, app) ->
    assert.ifError err
    assert.isObject cl

  teardown: (cl, app) ->
    if cl and cl.del
      cl.del (err) ->

    app.close()  if app

  "and we register a user":
    topic: (cl) ->
      register cl, "willy", "wonka", @callback

    "it works": (err, user) ->
      assert.ifError err

    "and we get an access token":
      topic: (user, cl) ->
        accessToken cl,
          nickname: "willy"
          password: "wonka"
        , @callback

      "it works": (err, pair) ->
        assert.ifError err

      "and we PUT a new nickname":
        topic: (pair, user, cl) ->
          httputil.putJSON "http://localhost:4815/api/user/willy",
            consumer_key: cl.client_id
            consumer_secret: cl.client_secret
            token: pair.token
            token_secret: pair.token_secret
          ,
            nickname: "william"
            password: "wonka"
          , invert(@callback)

        "it fails correctly": (err) ->
          assert.ifError err

      "and we PUT a new published value":
        topic: (pair, user, cl) ->
          httputil.putJSON "http://localhost:4815/api/user/willy",
            consumer_key: cl.client_id
            consumer_secret: cl.client_secret
            token: pair.token
            token_secret: pair.token_secret
          ,
            nickname: "willy"
            password: "wonka"
            published: "2001-11-10T00:00:00"
          , invert(@callback)

        "it fails correctly": (err) ->
          assert.ifError err

      "and we PUT a new updated value":
        topic: (pair, user, cl) ->
          httputil.putJSON "http://localhost:4815/api/user/willy",
            consumer_key: cl.client_id
            consumer_secret: cl.client_secret
            token: pair.token
            token_secret: pair.token_secret
          ,
            nickname: "willy"
            password: "wonka"
            updated: "2003-11-10T00:00:00"
          , invert(@callback)

        "it fails correctly": (err) ->
          assert.ifError err

      "and we PUT a new profile":
        topic: (pair, user, cl) ->
          profile =
            objectType: "person"
            id: "urn:uuid:8cec1280-28a6-4173-a523-2207ea964a2a"

          httputil.putJSON "http://localhost:4815/api/user/willy",
            consumer_key: cl.client_id
            consumer_secret: cl.client_secret
            token: pair.token
            token_secret: pair.token_secret
          ,
            nickname: "willy"
            password: "wonka"
            profile: profile
          , invert(@callback)

        "it fails correctly": (err) ->
          assert.ifError err

      "and we PUT new profile data":
        topic: (pair, user, cl) ->
          profile = user.profile
          profile.displayName = "William Q. Wonka"
          httputil.putJSON "http://localhost:4815/api/user/willy",
            consumer_key: cl.client_id
            consumer_secret: cl.client_secret
            token: pair.token
            token_secret: pair.token_secret
          ,
            nickname: "willy"
            password: "wonka"
            profile: profile
          , invert(@callback)

        "it fails correctly": (err) ->
          assert.ifError err

suite.addBatch "When we set up the app":
  topic: ->
    cb = @callback
    setupApp (err, app) ->
      if err
        cb err, null, null
      else
        newClient (err, cl) ->
          if err
            cb err, null, null
          else
            cb err, cl, app



  "it works": (err, cl, app) ->
    assert.ifError err
    assert.isObject cl

  teardown: (cl, app) ->
    if cl and cl.del
      cl.del (err) ->

    app.close()  if app

  "and we register a user":
    topic: (cl) ->
      register cl, "victor", "hugo", @callback

    "it works": (err, user) ->
      assert.ifError err

    "and we DELETE the user without OAuth credentials":
      topic: (user, cl) ->
        cb = @callback
        options =
          host: "localhost"
          port: 4815
          path: "/api/user/victor"
          method: "DELETE"
          headers:
            "User-Agent": "activitypump-test/0.1.0dev"

        req = http.request(options, (res) ->
          if res.statusCode >= 400 and res.statusCode < 500
            cb null
          else
            cb new Error("Unexpected status code")
        ).on("error", (err) ->
          cb err
        )
        req.end()

      "it fails correctly": (err) ->
        assert.ifError err

    "and we DELETE the user with invalid client credentials":
      topic: (user, cl) ->
        httputil.delJSON "http://localhost:4815/api/user/victor",
          consumer_key: "BADKEY"
          consumer_secret: "BADSECRET"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we DELETE the user with client credentials and no access token":
      topic: (user, cl) ->
        httputil.delJSON "http://localhost:4815/api/user/victor",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
        , invert(@callback)

      "it works": (err) ->
        assert.ifError err

    "and we DELETE the user with client credentials and an invalid access token":
      topic: (user, cl) ->
        httputil.delJSON "http://localhost:4815/api/user/victor",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
          token: "BADTOKEN"
          token_secret: "BADSECRET"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we DELETE the user with client credentials and a different user's access token":
      topic: (user, cl) ->
        cb = @callback
        Step (->
          register cl, "napoleon", "third", this
        ), ((err, res) ->
          throw err  if err
          accessToken cl,
            nickname: "napoleon"
            password: "third"
          , this
        ), (err, pair) ->
          if err
            cb err
          else
            httputil.delJSON "http://localhost:4815/api/user/victor",
              consumer_key: cl.client_id
              consumer_secret: cl.client_secret
              token: pair.token
              token_secret: pair.token_secret
            , invert(cb)


      "it fails correctly": (err) ->
        assert.ifError err

    "and we DELETE the user with client credentials and the same user's access token":
      topic: (user, cl) ->
        cb = @callback
        Step (->
          accessToken cl,
            nickname: "victor"
            password: "hugo"
          , this
        ), (err, pair) ->
          if err
            cb err
          else
            httputil.delJSON "http://localhost:4815/api/user/victor",
              consumer_key: cl.client_id
              consumer_secret: cl.client_secret
              token: pair.token
              token_secret: pair.token_secret
            , cb


      "it works": (err, body, result) ->
        assert.ifError err

suite["export"] module
