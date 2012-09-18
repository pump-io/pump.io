# user-followers-api-test.js
#
# Test the user followers/following endpoints for the API
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
Queue = require("../lib/jankyqueue").Queue
setupApp = oauthutil.setupApp
newClient = oauthutil.newClient
newPair = oauthutil.newPair
register = oauthutil.register
accessToken = oauthutil.accessToken
suite = vows.describe("user followers API")
invert = (callback) ->
  (err) ->
    if err
      callback null
    else
      callback new Error("Unexpected success")

makeCred = (cl, pair) ->
  consumer_key: cl.client_id
  consumer_secret: cl.client_secret
  token: pair.token
  token_secret: pair.token_secret

assertValidList = (doc, total, count) ->
  assert.include doc, "author"
  assert.include doc.author, "id"
  assert.include doc.author, "displayName"
  assert.include doc.author, "objectType"
  assert.include doc, "totalItems"
  assert.include doc, "items"
  assert.include doc, "displayName"
  assert.include doc, "id"
  assert.include doc, "itemsPerPage"
  assert.include doc, "startIndex"
  assert.include doc, "links"
  assert.include doc.links, "current"
  assert.include doc.links.current, "href"
  assert.include doc.links, "self"
  assert.include doc.links.self, "href"
  assert.include doc, "objectTypes"
  assert.include doc.objectTypes, "person"
  assert.equal doc.totalItems, total  if _(total).isNumber()
  assert.lengthOf doc.items, count  if _(count).isNumber()

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
    cl.app.close()  if cl.app

  "and we try to get followers for a non-existent user":
    topic: (cl) ->
      cb = @callback
      httputil.getJSON "http://localhost:4815/api/user/nonexistent/followers",
        consumer_key: cl.client_id
        consumer_secret: cl.client_secret
      , (err, followers, result) ->
        if err and err.statusCode and err.statusCode is 404
          cb null
        else if err
          cb err
        else
          cb new Error("Unexpected success")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we try to get following for a non-existent user":
    topic: (cl) ->
      cb = @callback
      httputil.getJSON "http://localhost:4815/api/user/nonexistent/following",
        consumer_key: cl.client_id
        consumer_secret: cl.client_secret
      , (err, followers, result) ->
        if err and err.statusCode and err.statusCode is 404
          cb null
        else if err
          cb err
        else
          cb new Error("Unexpected success")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we register a user":
    topic: (cl) ->
      register cl, "tyrion", "payURdebts", @callback

    "it works": (err, user) ->
      assert.ifError err

    "and we get the options on the user followers endpoint": httputil.endpoint("/api/user/tyrion/followers", ["GET"])
    "and we get the options on the user following endpoint": httputil.endpoint("/api/user/tyrion/followers", ["GET"])
    "and we GET the followers list without OAuth credentials":
      topic: ->
        cb = @callback
        options =
          host: "localhost"
          port: 4815
          path: "/api/user/tyrion/followers"

        http.get(options, (res) ->
          if res.statusCode >= 400 and res.statusCode < 500
            cb null
          else
            cb new Error("Unexpected status code")
        ).on "error", (err) ->
          cb err


      "it fails correctly": (err) ->
        assert.ifError err

    "and we GET the followers list with invalid client credentials":
      topic: (user, cl) ->
        httputil.getJSON "http://localhost:4815/api/user/tyrion/followers",
          consumer_key: "NOTACLIENT"
          consumer_secret: "NOTASECRET"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we GET the followers list with client credentials and no access token":
      topic: (user, cl) ->
        httputil.getJSON "http://localhost:4815/api/user/tyrion/followers",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
        , @callback

      "it works": (err, doc) ->
        assert.ifError err
        assertValidList doc, 0

    "and we GET the followers list with client credentials and an invalid access token":
      topic: (user, cl) ->
        httputil.getJSON "http://localhost:4815/api/user/tyrion/followers",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
          token: "NOTATOKEN"
          token_secret: "NOTASECRET"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we get an access token":
      topic: (user, cl) ->
        accessToken cl,
          nickname: "tyrion"
          password: "payURdebts"
        , @callback

      "it works": (err, pair) ->
        assert.ifError err

      "and we GET the following list with client credentials and the same user's access token":
        topic: (pair, user, cl) ->
          cb = @callback
          Step (->
            httputil.getJSON "http://localhost:4815/api/user/tyrion/following",
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
          assertValidList doc, 0

      "and we GET the followers list with client credentials and the same user's access token":
        topic: (pair, user, cl) ->
          cb = @callback
          Step (->
            httputil.getJSON "http://localhost:4815/api/user/tyrion/followers",
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
          assertValidList doc, 0

    "and we GET the followers list with client credentials and a different user's access token":
      topic: (user, cl) ->
        cb = @callback
        Step (->
          register cl, "cersei", "p0wer", this
        ), ((err, user2) ->
          throw err  if err
          accessToken cl,
            nickname: "cersei"
            password: "p0wer"
          , this
        ), ((err, pair) ->
          throw err  if err
          httputil.getJSON "http://localhost:4815/api/user/tyrion/followers",
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
        assertValidList doc, 0

    "and we GET the following list without OAuth credentials":
      topic: ->
        cb = @callback
        options =
          host: "localhost"
          port: 4815
          path: "/api/user/tyrion/following"

        http.get(options, (res) ->
          if res.statusCode >= 400 and res.statusCode < 500
            cb null
          else
            cb new Error("Unexpected status code")
        ).on "error", (err) ->
          cb err


      "it fails correctly": (err) ->
        assert.ifError err

    "and we GET the following list with invalid client credentials":
      topic: (user, cl) ->
        httputil.getJSON "http://localhost:4815/api/user/tyrion/following",
          consumer_key: "NOTACLIENT"
          consumer_secret: "NOTASECRET"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we GET the following list with client credentials and no access token":
      topic: (user, cl) ->
        httputil.getJSON "http://localhost:4815/api/user/tyrion/following",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
        , @callback

      "it works": (err, doc) ->
        assert.ifError err
        assertValidList doc, 0

    "and we GET the following list with client credentials and an invalid access token":
      topic: (user, cl) ->
        httputil.getJSON "http://localhost:4815/api/user/tyrion/following",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
          token: "NOTATOKEN"
          token_secret: "NOTASECRET"
        , invert(@callback)

      "it fails correctly": (err) ->
        assert.ifError err

    "and we GET the following list with client credentials and a different user's access token":
      topic: (user, cl) ->
        cb = @callback
        Step (->
          register cl, "tywin", "c4st3rly*r0ck", this
        ), ((err, user2) ->
          throw err  if err
          accessToken cl,
            nickname: "tywin"
            password: "c4st3rly*r0ck"
          , this
        ), ((err, pair) ->
          throw err  if err
          httputil.getJSON "http://localhost:4815/api/user/tyrion/following",
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
        assertValidList doc, 0

  "and one user follows another":
    topic: (cl) ->
      cb = @callback
      users = undefined
      pairs = undefined
      Step (->
        register cl, "robb", "gr3yw1nd", @parallel()
        register cl, "greatjon", "bl00dyt0ugh", @parallel()
      ), ((err, robb, greatjon) ->
        throw err  if err
        users =
          robb: robb
          greatjon: greatjon

        accessToken cl,
          nickname: "robb"
          password: "gr3yw1nd"
        , @parallel()
        accessToken cl,
          nickname: "greatjon"
          password: "bl00dyt0ugh"
        , @parallel()
      ), (err, robbPair, greatjonPair) ->
        act = undefined
        url = undefined
        cred = undefined
        throw err  if err
        pairs =
          robb: robbPair
          greatjon: greatjonPair

        act =
          verb: "follow"
          object:
            objectType: "person"
            id: users.robb.profile.id

          mood:
            displayName: "Raucous"

        url = "http://localhost:4815/api/user/greatjon/feed"
        cred = makeCred(cl, pairs.greatjon)

        httputil.postJSON url, cred, act, (err, posted, result) ->
          if err
            cb err, null, null
          else
            cb null, users, pairs



    "it works": (err, users, pairs) ->
      assert.ifError err

    "and we check the first user's following list":
      topic: (users, pairs, cl) ->
        cb = @callback
        cred = makeCred(cl, pairs.greatjon)
        url = "http://localhost:4815/api/user/greatjon/following"
        httputil.getJSON url, cred, (err, doc, results) ->
          cb err, doc, users.robb.profile


      "it works": (err, doc, person) ->
        assert.ifError err

      "it is valid": (err, doc, person) ->
        assert.ifError err
        assertValidList doc, 1

      "it contains the second person": (err, doc, person) ->
        assert.ifError err
        assert.equal doc.items[0].id, person.id
        assert.equal doc.items[0].objectType, person.objectType

    "and we check the first user's followers list":
      topic: (users, pairs, cl) ->
        cb = @callback
        cred = makeCred(cl, pairs.greatjon)
        url = "http://localhost:4815/api/user/greatjon/followers"
        httputil.getJSON url, cred, (err, doc, results) ->
          cb err, doc


      "it works": (err, doc) ->
        assert.ifError err

      "it is valid": (err, doc) ->
        assert.ifError err
        assertValidList doc, 0

    "and we check the second user's followers list":
      topic: (users, pairs, cl) ->
        cb = @callback
        cred = makeCred(cl, pairs.robb)
        url = "http://localhost:4815/api/user/robb/followers"
        httputil.getJSON url, cred, (err, doc, results) ->
          cb err, doc, users.greatjon.profile


      "it works": (err, doc, person) ->
        assert.ifError err

      "it is valid": (err, doc, person) ->
        assert.ifError err
        assertValidList doc, 1

      "it contains the first person": (err, doc, person) ->
        assert.ifError err
        assert.equal doc.items[0].id, person.id
        assert.equal doc.items[0].objectType, person.objectType

    "and we check the second user's following list":
      topic: (users, pairs, cl) ->
        cb = @callback
        cred = makeCred(cl, pairs.robb)
        url = "http://localhost:4815/api/user/robb/following"
        httputil.getJSON url, cred, (err, doc, results) ->
          cb err, doc


      "it works": (err, doc) ->
        assert.ifError err

      "it is valid": (err, doc) ->
        assert.ifError err
        assertValidList doc, 0

  "and a lot of users follow one user":
    topic: (cl) ->
      cb = @callback
      user = undefined
      pair = undefined
      Step (->
        register cl, "nymeria", "growl", this
      ), ((err, nymeria) ->
        throw err  if err
        user = nymeria
        accessToken cl,
          nickname: "nymeria"
          password: "growl"
        , this
      ), ((err, result) ->
        i = undefined
        group = @group()
        q = new Queue(10)
        throw err  if err
        pair = result
        i = 0
        while i < 100
          q.enqueue newPair, [cl, "wolf" + i, "grrrrrr"], group()
          i++
      ), ((err, pairs) ->
        act = undefined
        url = undefined
        cred = undefined
        i = undefined
        group = @group()
        q = new Queue(10)
        throw err  if err
        act =
          verb: "follow"
          object:
            objectType: "person"
            id: user.profile.id

        i = 0
        while i < 100
          q.enqueue httputil.postJSON, ["http://localhost:4815/api/user/wolf" + i + "/feed", makeCred(cl, pairs[i]), act], group()
          i++
      ), (err, docs, responses) ->
        cb err, pair


    "it works": (err, pair) ->
      assert.ifError err

    "and we get the tip of the followers feed":
      topic: (pair, cl) ->
        callback = @callback
        url = "http://localhost:4815/api/user/nymeria/followers"
        cred = makeCred(cl, pair)
        httputil.getJSON url, cred, (err, doc, resp) ->
          callback err, doc


      "it works": (err, feed) ->
        assert.ifError err

      "it is valid": (err, feed) ->
        assert.ifError err
        assertValidList feed, 100, 20

      "it has next but no prev": (err, feed) ->
        assert.ifError err
        assert.include feed.links, "next"
        assert.include feed.links.next, "href"
        assert.isFalse feed.links.hasOwnProperty("prev")

    "and we get a non-default count from the feed":
      topic: (pair, cl) ->
        callback = @callback
        url = "http://localhost:4815/api/user/nymeria/followers?count=40"
        cred = makeCred(cl, pair)
        httputil.getJSON url, cred, (err, doc, resp) ->
          callback err, doc


      "it works": (err, feed) ->
        assert.ifError err

      "it is valid": (err, feed) ->
        assert.ifError err
        assertValidList feed, 100, 40

      "it has next but no prev": (err, feed) ->
        assert.ifError err
        assert.include feed.links, "next"
        assert.include feed.links.next, "href"
        assert.isFalse feed.links.hasOwnProperty("prev")

    "and we get a very large count from the feed":
      topic: (pair, cl) ->
        callback = @callback
        url = "http://localhost:4815/api/user/nymeria/followers?count=200"
        cred = makeCred(cl, pair)
        httputil.getJSON url, cred, (err, doc, resp) ->
          callback err, doc


      "it works": (err, feed) ->
        assert.ifError err

      "it is valid": (err, feed) ->
        assert.ifError err
        assertValidList feed, 100, 100

      "it has no next and no prev": (err, feed) ->
        assert.ifError err
        assert.isFalse feed.links.hasOwnProperty("prev")
        assert.isFalse feed.links.hasOwnProperty("next")

    "and we get an offset subset from the feed":
      topic: (pair, cl) ->
        callback = @callback
        url = "http://localhost:4815/api/user/nymeria/followers?offset=20"
        cred = makeCred(cl, pair)
        httputil.getJSON url, cred, (err, doc, resp) ->
          callback err, doc


      "it works": (err, feed) ->
        assert.ifError err

      "it is valid": (err, feed) ->
        assert.ifError err
        assertValidList feed, 100, 20

      "it has next and prev": (err, feed) ->
        assert.ifError err
        assert.isTrue feed.links.hasOwnProperty("prev")
        assert.isTrue feed.links.hasOwnProperty("next")

  "and a user follows a lot of other users":
    topic: (cl) ->
      cb = @callback
      user = undefined
      pair = undefined
      Step (->
        register cl, "varys", "magic", this
      ), ((err, varys) ->
        throw err  if err
        user = varys
        accessToken cl,
          nickname: "varys"
          password: "magic"
        , this
      ), ((err, result) ->
        i = undefined
        group = @group()
        throw err  if err
        pair = result
        i = 0
        while i < 50
          register cl, "littlebird" + i, "sekrit", group()
          i++
      ), ((err, users) ->
        cred = undefined
        i = undefined
        group = @group()
        throw err  if err
        cred = makeCred(cl, pair)
        i = 0
        while i < 50
          httputil.postJSON "http://localhost:4815/api/user/varys/feed", cred,
            verb: "follow"
            object:
              objectType: "person"
              id: users[i].profile.id
          , group()
          i++
      ), (err, docs, responses) ->
        cb err, pair


    "it works": (err, pair) ->
      assert.ifError err

    "and we get the tip of the following feed":
      topic: (pair, cl) ->
        callback = @callback
        url = "http://localhost:4815/api/user/varys/following"
        cred = makeCred(cl, pair)
        httputil.getJSON url, cred, (err, doc, resp) ->
          callback err, doc


      "it works": (err, feed) ->
        assert.ifError err

      "it is valid": (err, feed) ->
        assert.ifError err
        assertValidList feed, 50, 20

      "it has next but no prev": (err, feed) ->
        assert.ifError err
        assert.include feed.links, "next"
        assert.include feed.links.next, "href"
        assert.isFalse feed.links.hasOwnProperty("prev")

    "and we get a non-default count from the feed":
      topic: (pair, cl) ->
        callback = @callback
        url = "http://localhost:4815/api/user/varys/following?count=40"
        cred = makeCred(cl, pair)
        httputil.getJSON url, cred, (err, doc, resp) ->
          callback err, doc


      "it works": (err, feed) ->
        assert.ifError err

      "it is valid": (err, feed) ->
        assert.ifError err
        assertValidList feed, 50, 40

      "it has next but no prev": (err, feed) ->
        assert.ifError err
        assert.include feed.links, "next"
        assert.include feed.links.next, "href"
        assert.isFalse feed.links.hasOwnProperty("prev")

    "and we get a very large count from the feed":
      topic: (pair, cl) ->
        callback = @callback
        url = "http://localhost:4815/api/user/varys/following?count=100"
        cred = makeCred(cl, pair)
        httputil.getJSON url, cred, (err, doc, resp) ->
          callback err, doc


      "it works": (err, feed) ->
        assert.ifError err

      "it is valid": (err, feed) ->
        assert.ifError err
        assertValidList feed, 50, 50

      "it has no next and no prev": (err, feed) ->
        assert.ifError err
        assert.isFalse feed.links.hasOwnProperty("prev")
        assert.isFalse feed.links.hasOwnProperty("next")

    "and we get an offset subset from the feed":
      topic: (pair, cl) ->
        callback = @callback
        url = "http://localhost:4815/api/user/varys/following?offset=20"
        cred = makeCred(cl, pair)
        httputil.getJSON url, cred, (err, doc, resp) ->
          callback err, doc


      "it works": (err, feed) ->
        assert.ifError err

      "it is valid": (err, feed) ->
        assert.ifError err
        assertValidList feed, 50, 20

      "it has next and prev": (err, feed) ->
        assert.ifError err
        assert.isTrue feed.links.hasOwnProperty("prev")
        assert.isTrue feed.links.hasOwnProperty("next")

suite["export"] module
