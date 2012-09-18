# follow-person-test.js
#
# Test posting an activity to follow a person
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
actutil = require("./lib/activity")
setupApp = oauthutil.setupApp
newCredentials = oauthutil.newCredentials
newPair = oauthutil.newPair
newClient = oauthutil.newClient
register = oauthutil.register
accessToken = oauthutil.accessToken
ignore = (err) ->

makeCred = (cl, pair) ->
  consumer_key: cl.client_id
  consumer_secret: cl.client_secret
  token: pair.token
  token_secret: pair.token_secret

suite = vows.describe("follow person activity test")

# A batch to test following/unfollowing users
suite.addBatch "When we set up the app":
  topic: ->
    setupApp @callback

  teardown: (app) ->
    app.close()  if app and app.close

  "it works": (err, app) ->
    assert.ifError err

  "and we register a client":
    topic: ->
      newClient @callback

    "it works": (err, cl) ->
      assert.ifError err
      assert.isObject cl

    "and one user follows another":
      topic: (cl) ->
        cb = @callback
        users =
          larry: {}
          moe: {}
          curly: {}

        Step (->
          register cl, "larry", "wiry1", @parallel()
          register cl, "moe", "bowlcut", @parallel()
          register cl, "curly", "nyuknyuk", @parallel()
        ), ((err, user1, user2, user3) ->
          throw err  if err
          users.larry.profile = user1.profile
          users.moe.profile = user2.profile
          users.curly.profile = user3.profile
          accessToken cl,
            nickname: "larry"
            password: "wiry1"
          , @parallel()
          accessToken cl,
            nickname: "moe"
            password: "bowlcut"
          , @parallel()
          accessToken cl,
            nickname: "curly"
            password: "nyuknyuk"
          , @parallel()
        ), ((err, pair1, pair2, pair3) ->
          throw err  if err
          users.larry.pair = pair1
          users.moe.pair = pair2
          users.curly.pair = pair3
          act =
            verb: "follow"
            object:
              objectType: "person"
              id: users.moe.profile.id

          url = "http://localhost:4815/api/user/larry/feed"
          cred = makeCred(cl, users.larry.pair)
          httputil.postJSON url, cred, act, this
        ), (err, posted, result) ->
          if err
            cb err, null
          else
            cb null, posted


      "it works": (err, act) ->
        assert.ifError err

      "results are valid": (err, act) ->
        assert.ifError err
        actutil.validActivity act

      "results are correct": (err, act) ->
        assert.ifError err
        assert.equal act.verb, "follow"

    "and one user double-follows another":
      topic: (cl) ->
        cb = @callback
        users = {}
        hpair = undefined
        Step (->
          register cl, "heckle", "cigar", @parallel()
          register cl, "jeckle", "hijinks", @parallel()
        ), ((err, heckle, jeckle) ->
          throw err  if err
          users.heckle = heckle
          users.jeckle = jeckle
          accessToken cl,
            nickname: "heckle"
            password: "cigar"
          , this
        ), ((err, pair) ->
          throw err  if err
          hpair = pair
          act =
            verb: "follow"
            object:
              objectType: "person"
              id: users.jeckle.profile.id

          url = "http://localhost:4815/api/user/heckle/feed"
          cred = makeCred(cl, users.heckle.pair)
          httputil.postJSON url, cred, act, this
        ), ((err, posted, result) ->
          throw err  if err
          act =
            verb: "follow"
            object:
              objectType: "person"
              id: users.jeckle.profile.id

          url = "http://localhost:4815/api/user/heckle/feed"
          cred = makeCred(cl, users.heckle.pair)
          httputil.postJSON url, cred, act, this
        ), (err, posted, result) ->
          if err
            cb null
          else
            cb new Error("Unexpected success")


      "it fails correctly": (err) ->
        assert.ifError err

    "and one user follows a remote person":
      topic: (cl) ->
        cb = @callback
        Step (->
          register cl, "tom", "cat", this
        ), ((err, tom) ->
          throw err  if err
          accessToken cl,
            nickname: "tom"
            password: "cat"
          , this
        ), ((err, pair) ->
          throw err  if err
          act =
            verb: "follow"
            object:
              objectType: "person"
              id: "urn:uuid:6e621028-cdbc-4550-a593-4268e0f729f5"
              displayName: "Jerry"

          url = "http://localhost:4815/api/user/tom/feed"
          cred = makeCred(cl, pair)
          httputil.postJSON url, cred, act, this
        ), (err, posted, result) ->
          if err
            cb err, null
          else
            cb null, posted


      "it works": (err, act) ->
        assert.ifError err

      "results are valid": (err, act) ->
        assert.ifError err
        actutil.validActivity act

      "results are correct": (err, act) ->
        assert.ifError err
        assert.equal act.verb, "follow"

    "and one user follows a person who then posts":
      topic: (cl) ->
        cb = @callback
        users =
          jack: {}
          jill: {}

        postnote = undefined
        Step (->
          register cl, "jack", "upthehill", @parallel()
          register cl, "jill", "pailofwater", @parallel()
        ), ((err, user1, user2) ->
          throw err  if err
          users.jack.profile = user1.profile
          users.jill.profile = user2.profile
          accessToken cl,
            nickname: "jack"
            password: "upthehill"
          , @parallel()
          accessToken cl,
            nickname: "jill"
            password: "pailofwater"
          , @parallel()
        ), ((err, pair1, pair2) ->
          throw err  if err
          users.jack.pair = pair1
          users.jill.pair = pair2
          act =
            verb: "follow"
            object:
              objectType: "person"
              id: users.jill.profile.id

          url = "http://localhost:4815/api/user/jack/feed"
          cred = makeCred(cl, users.jack.pair)
          httputil.postJSON url, cred, act, this
        ), ((err, posted, result) ->
          throw err  if err
          act =
            verb: "post"
            to: [
              id: "http://localhost:4815/api/user/jill/followers"
              objectType: "collection"
            ]
            object:
              objectType: "note"
              content: "Hello, world."

          url = "http://localhost:4815/api/user/jill/feed"
          cred = makeCred(cl, users.jill.pair)
          httputil.postJSON url, cred, act, this
        ), ((err, posted, result) ->
          throw err  if err
          postnote = posted
          url = "http://localhost:4815/api/user/jack/inbox"
          cred = makeCred(cl, users.jack.pair)
          callback = this
          
          # Need non-zero time for async distribution
          # to work. 2s seems reasonable for unit test.
          setTimeout (->
            httputil.getJSON url, cred, callback
          ), 2000
        ), (err, doc, result) ->
          if err
            cb err, null, null
          else
            cb null, doc, postnote


      "it works": (err, inbox, postnote) ->
        assert.ifError err

      "posted item goes to inbox": (err, inbox, postnote) ->
        assert.ifError err
        assert.isObject inbox
        assert.include inbox, "totalItems"
        assert.isNumber inbox.totalItems
        assert.equal inbox.totalItems, 2
        assert.include inbox, "items"
        assert.isArray inbox.items
        assert.lengthOf inbox.items, 2
        assert.isObject inbox.items[0]
        assert.include inbox.items[0], "id"
        assert.isObject postnote
        assert.include postnote, "id"
        assert.equal inbox.items[0].id, postnote.id

    "and a user posts a person to their following stream":
      topic: (cl) ->
        cb = @callback
        users =
          abbott: {}
          costello: {}

        Step (->
          register cl, "abbott", "what", @parallel()
          register cl, "costello", "who", @parallel()
        ), ((err, user1, user2) ->
          throw err  if err
          users.abbott.profile = user1.profile
          users.costello.profile = user2.profile
          accessToken cl,
            nickname: "abbott"
            password: "what"
          , @parallel()
          accessToken cl,
            nickname: "costello"
            password: "who"
          , @parallel()
        ), ((err, pair1, pair2) ->
          throw err  if err
          users.abbott.pair = pair1
          users.costello.pair = pair2
          url = "http://localhost:4815/api/user/abbott/following"
          cred = makeCred(cl, users.abbott.pair)
          httputil.postJSON url, cred, users.costello.profile, this
        ), (err, posted, result) ->
          cb err, posted, users


      "it works": (err, posted, users) ->
        assert.ifError err

      "posted item is person": (err, posted, users) ->
        assert.ifError err
        assert.isObject posted
        assert.include posted, "id"
        assert.equal users.costello.profile.id, posted.id

      "and we check the user's following stream":
        topic: (posted, users, cl) ->
          cb = @callback
          url = "http://localhost:4815/api/user/abbott/following"
          cred = makeCred(cl, users.abbott.pair)
          httputil.getJSON url, cred, (err, doc, resp) ->
            cb err, doc


        "it works": (err, feed) ->
          assert.ifError err

        "it includes the followed user": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.isObject feed.items[0]
          assert.equal "costello", feed.items[0].displayName

      "and we check the user's activity feed":
        topic: (posted, users, cl) ->
          cb = @callback
          url = "http://localhost:4815/api/user/abbott/feed"
          cred = makeCred(cl, users.abbott.pair)
          httputil.getJSON url, cred, (err, doc, resp) ->
            cb err, doc


        "it works": (err, feed) ->
          assert.ifError err

        "it includes the follow activity": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.isObject feed.items[0]
          assert.include feed.items[0], "verb"
          assert.equal "follow", feed.items[0].verb
          assert.include feed.items[0], "object"
          assert.isObject feed.items[0].object
          assert.include feed.items[0].object, "displayName"
          assert.equal "costello", feed.items[0].object.displayName
          assert.include feed.items[0].object, "objectType"
          assert.equal "person", feed.items[0].object.objectType

    "and a user posts to someone else's following stream":
      topic: (cl) ->
        cb = @callback
        users =
          laurel: {}
          hardy: {}
          cop: {}

        Step (->
          register cl, "laurel", "what", @parallel()
          register cl, "hardy", "who", @parallel()
          register cl, "cop", "why", @parallel()
        ), ((err, user1, user2, user3) ->
          throw err  if err
          users.laurel.profile = user1.profile
          users.hardy.profile = user2.profile
          users.hardy.profile = user3.profile
          accessToken cl,
            nickname: "laurel"
            password: "what"
          , @parallel()
          accessToken cl,
            nickname: "hardy"
            password: "who"
          , @parallel()
          accessToken cl,
            nickname: "cop"
            password: "why"
          , @parallel()
        ), ((err, pair1, pair2, pair3) ->
          throw err  if err
          users.laurel.pair = pair1
          users.hardy.pair = pair2
          users.cop.pair = pair3
          url = "http://localhost:4815/api/user/hardy/following"
          cred = makeCred(cl, users.laurel.pair)
          httputil.postJSON url, cred, users.cop.profile, this
        ), (err, posted, result) ->
          if err and err.statusCode is 401
            cb null
          else if err
            cb err
          else
            cb new Error("Unexpected success!")


      "it fails with a 401 error": (err) ->
        assert.ifError err

suite["export"] module
