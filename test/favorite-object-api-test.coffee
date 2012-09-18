# favorite-object-api-test.js
#
# Test favoriting a posted object
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
OAuth = require("oauth").OAuth
httputil = require("./lib/http")
oauthutil = require("./lib/oauth")
actutil = require("./lib/activity")
setupApp = oauthutil.setupApp
newClient = oauthutil.newClient
newPair = oauthutil.newPair
ignore = (err) ->

makeCred = (cl, pair) ->
  consumer_key: cl.client_id
  consumer_secret: cl.client_secret
  token: pair.token
  token_secret: pair.token_secret

assertValidList = (doc, count) ->
  assert.include doc, "author"
  assert.include doc.author, "id"
  assert.include doc.author, "displayName"
  assert.include doc.author, "objectType"
  assert.include doc, "totalItems"
  assert.include doc, "items"
  assert.include doc, "displayName"
  assert.include doc, "id"
  if _(count).isNumber()
    assert.equal doc.totalItems, count
    assert.lengthOf doc.items, count

suite = vows.describe("favorite object activity api test")

# A batch to test favoriting/unfavoriting objects
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

    "and we get the list of favorites for a new user":
      topic: (cl) ->
        cb = @callback
        Step (->
          newPair cl, "marsha", "hair", this
        ), ((err, pair) ->
          throw err  if err
          cred = makeCred(cl, pair)
          url = "http://localhost:4815/api/user/marsha/favorites"
          httputil.getJSON url, cred, this
        ), (err, doc, response) ->
          cb err, doc


      "it exists": (err, doc) ->
        assert.ifError err

      "it looks correct": (err, doc) ->
        assert.ifError err
        assertValidList doc, 0

    "and we get the list of favorites for a brand-new object":
      topic: (cl) ->
        cb = @callback
        cred = undefined
        Step (->
          newPair cl, "jan", "marsha", this
        ), ((err, pair) ->
          throw err  if err
          url = "http://localhost:4815/api/user/jan/feed"
          act =
            verb: "post"
            object:
              objectType: "note"
              content: "MARSHA MARSHA MARSHA"

          cred = makeCred(cl, pair)
          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          url = doc.object.likes.url
          httputil.getJSON url, cred, this
        ), (err, doc, response) ->
          cb err, doc


      "it exists": (err, faves) ->
        assert.ifError err

      "it is empty": (err, faves) ->
        assert.ifError err
        assert.include faves, "totalItems"
        assert.include faves, "items"
        assert.include faves, "displayName"
        assert.include faves, "id"
        assert.equal faves.totalItems, 0
        assert.lengthOf faves.items, 0

    "and one user favorites another user's object":
      topic: (cl) ->
        cb = @callback
        pairs = {}
        Step (->
          newPair cl, "cindy", "pigtails", @parallel()
          newPair cl, "bobby", "baseball", @parallel()
        ), ((err, cpair, bpair) ->
          throw err  if err
          pairs.cindy = cpair
          pairs.bobby = bpair
          url = "http://localhost:4815/api/user/cindy/feed"
          act =
            verb: "post"
            object:
              objectType: "note"
              content: "Let's play dress-up."

          cred = makeCred(cl, pairs.cindy)
          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          url = "http://localhost:4815/api/user/bobby/feed"
          act =
            verb: "favorite"
            object:
              objectType: doc.object.objectType
              id: doc.object.id

          cred = makeCred(cl, pairs.bobby)
          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          cb err, doc, pairs


      "it works": (err, act, pairs) ->
        assert.ifError err

      "and we get the user's list of favorites":
        topic: (act, pairs, cl) ->
          cred = makeCred(cl, pairs.bobby)
          url = "http://localhost:4815/api/user/bobby/favorites"
          cb = @callback
          httputil.getJSON url, cred, (err, doc, response) ->
            cb err, doc, act


        "it works": (err, doc, act) ->
          assert.ifError err
          assertValidList doc, 1

        "it includes the object": (err, doc, act) ->
          assert.ifError err
          assert.equal doc.items[0].id, act.object.id

      "and we get the list of likes of the object":
        topic: (act, pairs, cl) ->
          cred = makeCred(cl, pairs.cindy)
          url = act.object.likes.url
          cb = @callback
          httputil.getJSON url, cred, (err, doc, response) ->
            cb err, doc, act


        "it works": (err, doc, act) ->
          assert.ifError err
          assert.include doc, "totalItems"
          assert.include doc, "items"
          assert.include doc, "displayName"
          assert.include doc, "id"
          assert.equal doc.totalItems, 1
          assert.lengthOf doc.items, 1

        "it includes the actor": (err, doc, act) ->
          assert.ifError err
          assert.equal doc.items[0].id, act.actor.id

    "and one user double-favorites another user's object":
      topic: (cl) ->
        cb = @callback
        pairs = {}
        Step (->
          newPair cl, "alice", "backpain", @parallel()
          newPair cl, "sam", "alice", @parallel()
        ), ((err, apair, spair) ->
          throw err  if err
          pairs.alice = apair
          pairs.sam = spair
          url = "http://localhost:4815/api/user/alice/feed"
          act =
            verb: "post"
            object:
              objectType: "note"
              content: "Pot roast tonight."

          cred = makeCred(cl, pairs.alice)
          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          url = "http://localhost:4815/api/user/sam/feed"
          act =
            verb: "favorite"
            object:
              objectType: doc.object.objectType
              id: doc.object.id

          cred = makeCred(cl, pairs.sam)
          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          url = "http://localhost:4815/api/user/sam/feed"
          act =
            verb: "favorite"
            object:
              objectType: doc.object.objectType
              id: doc.object.id

          cred = makeCred(cl, pairs.sam)
          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          if err and err.statusCode and err.statusCode >= 400 and err.statusCode < 500
            cb null
          else if err
            cb err
          else
            cb new Error("Unexpected success")


      "it fails correctly": (err) ->
        assert.ifError err

    "and one user favorites then unfavorites another user's object":
      topic: (cl) ->
        cb = @callback
        pairs = {}
        Step (->
          newPair cl, "greg", "groovy", @parallel()
          newPair cl, "peter", "vengeance", @parallel()
        ), ((err, gpair, ppair) ->
          throw err  if err
          pairs.greg = gpair
          pairs.peter = ppair
          url = "http://localhost:4815/api/user/peter/feed"
          act =
            verb: "post"
            object:
              objectType: "note"
              content: "I'm going to build a fort."

          cred = makeCred(cl, pairs.peter)
          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          url = "http://localhost:4815/api/user/greg/feed"
          act =
            verb: "favorite"
            object:
              objectType: doc.object.objectType
              id: doc.object.id

          cred = makeCred(cl, pairs.greg)
          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          url = "http://localhost:4815/api/user/greg/feed"
          act =
            verb: "unfavorite"
            object:
              objectType: doc.object.objectType
              id: doc.object.id

          cred = makeCred(cl, pairs.greg)
          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          cb err, doc, pairs


      "it works": (err, act) ->
        assert.ifError err

      "and we get the user's list of favorites":
        topic: (act, pairs, cl) ->
          cred = makeCred(cl, pairs.greg)
          url = "http://localhost:4815/api/user/greg/favorites"
          cb = @callback
          httputil.getJSON url, cred, (err, doc, response) ->
            cb err, doc, act


        "it works": (err, doc, act) ->
          assert.ifError err
          assertValidList doc, 0

      "and we get the list of favorites of the object":
        topic: (act, pairs, cl) ->
          cred = makeCred(cl, pairs.peter)
          url = act.object.likes.url
          cb = @callback
          httputil.getJSON url, cred, (err, doc, response) ->
            cb err, doc


        "it works": (err, doc) ->
          assert.ifError err
          assert.include doc, "totalItems"
          assert.include doc, "items"
          assert.include doc, "displayName"
          assert.include doc, "id"
          assert.equal doc.totalItems, 0
          assert.lengthOf doc.items, 0

    "and one user unfavorites another user's object they hadn't faved before":
      topic: (cl) ->
        cb = @callback
        pairs = {}
        Step (->
          newPair cl, "mike", "arch1tecture", @parallel()
          newPair cl, "carol", "mike", @parallel()
        ), ((err, mpair, cpair) ->
          throw err  if err
          pairs.mike = mpair
          pairs.carol = cpair
          url = "http://localhost:4815/api/user/mike/feed"
          act =
            verb: "post"
            object:
              objectType: "note"
              content: "We're going to Hawaii!"

          cred = makeCred(cl, pairs.mike)
          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          url = "http://localhost:4815/api/user/carol/feed"
          act =
            verb: "unfavorite"
            object:
              objectType: doc.object.objectType
              id: doc.object.id

          cred = makeCred(cl, pairs.carol)
          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          if err and err.statusCode and err.statusCode >= 400 and err.statusCode < 500
            cb null
          else if err
            cb err
          else
            cb new Error("Unexpected success")


      "it fails correctly": (err) ->
        assert.ifError err

    "and one user favorites an unknown or arbitrary object":
      topic: (cl) ->
        cb = @callback
        pairs = {}
        Step (->
          newPair cl, "tiger", "fleapowder", this
        ), ((err, pair) ->
          throw err  if err
          pairs.tiger = pair
          url = "http://localhost:4815/api/user/tiger/feed"
          act =
            verb: "favorite"
            object:
              objectType: "image"
              id: "urn:uuid:30b3f9aa-6e20-4e2a-8325-b72cfbccb4d0"

          cred = makeCred(cl, pairs.tiger)
          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          cb err, doc, pairs


      "it works": (err, act) ->
        assert.ifError err

      "and we get the user's list of favorites":
        topic: (act, pairs, cl) ->
          cred = makeCred(cl, pairs.tiger)
          url = "http://localhost:4815/api/user/tiger/favorites"
          cb = @callback
          httputil.getJSON url, cred, (err, doc, response) ->
            cb err, doc, act


        "it works": (err, doc, act) ->
          assert.ifError err
          assertValidList doc, 1

        "it includes our object": (err, doc, act) ->
          assert.ifError err
          assert.equal doc.items[0].id, act.object.id

    "and a user favorites an object by posting to their favorites stream":
      topic: (cl) ->
        cb = @callback
        pair = undefined
        Step (->
          newPair cl, "cousinoliver", "jump*the*shark", this
        ), ((err, result) ->
          throw err  if err
          pair = result
          url = "http://localhost:4815/api/user/cousinoliver/favorites"
          obj =
            objectType: "image"
            id: "urn:uuid:ab70a4c0-ed3a-11e1-965f-0024beb67924"

          cred = makeCred(cl, pair)
          httputil.postJSON url, cred, obj, this
        ), (err, doc, response) ->
          cb err, doc, pair


      "it works": (err, obj, pair) ->
        assert.ifError err

      "result is the object": (err, obj, pair) ->
        assert.ifError err
        assert.isObject obj
        assert.include obj, "id"
        assert.equal "urn:uuid:ab70a4c0-ed3a-11e1-965f-0024beb67924", obj.id

      "and we get the user's list of favorites":
        topic: (act, pair, cl) ->
          cb = @callback
          url = "http://localhost:4815/api/user/cousinoliver/favorites"
          cred = makeCred(cl, pair)
          httputil.getJSON url, cred, (err, feed, resp) ->
            cb err, feed


        "it works": (err, feed) ->
          assert.ifError err

        "it includes our object": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.isObject feed.items[0]
          assert.include feed.items[0], "id"
          assert.equal "urn:uuid:ab70a4c0-ed3a-11e1-965f-0024beb67924", feed.items[0].id

      "and we get the user's feed":
        topic: (act, pair, cl) ->
          cb = @callback
          url = "http://localhost:4815/api/user/cousinoliver/feed"
          cred = makeCred(cl, pair)
          httputil.getJSON url, cred, (err, feed, resp) ->
            cb err, feed


        "it works": (err, feed) ->
          assert.ifError err

        "it includes our favorite activity": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.isObject feed.items[0]
          assert.include feed.items[0], "verb"
          assert.equal "favorite", feed.items[0].verb
          assert.include feed.items[0], "object"
          assert.isObject feed.items[0].object
          assert.include feed.items[0].object, "id"
          assert.equal "urn:uuid:ab70a4c0-ed3a-11e1-965f-0024beb67924", feed.items[0].object.id

    "and a user tries to post to someone else's favorites stream":
      topic: (cl) ->
        cb = @callback
        Step (->
          newPair cl, "doug", "nose", @parallel()
          newPair cl, "rachel", "dare", @parallel()
        ), ((err, pair1, pair2) ->
          throw err  if err
          url = "http://localhost:4815/api/user/rachel/favorites"
          obj =
            objectType: "image"
            id: "urn:uuid:79ba04b8-ed3e-11e1-a70b-0024beb67924"

          cred = makeCred(cl, pair1)
          httputil.postJSON url, cred, obj, this
        ), (err, doc, response) ->
          if err and err.statusCode is 401
            cb null
          else if err
            cb err
          else
            cb new Error("Unexpected success!")


      "it fails with a 401 Forbidden": (err) ->
        assert.ifError err

suite["export"] module
