# bcc-api-test.js
#
# Test visibility of bcc and bto
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
setupApp = oauthutil.setupApp
register = oauthutil.register
accessToken = oauthutil.accessToken
newCredentials = oauthutil.newCredentials
newPair = oauthutil.newPair
newClient = oauthutil.newClient
ignore = (err) ->

suite = vows.describe("Post note API test")
makeCred = (cl, pair) ->
  consumer_key: cl.client_id
  consumer_secret: cl.client_secret
  token: pair.token
  token_secret: pair.token_secret


# A batch for testing the visibility of bcc and bto addressing
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

    "and a user posts an activity with bcc":
      topic: (cl) ->
        cb = @callback
        users =
          gilligan: {}
          skipper: {}
          professor: {}
          mrshowell: {}

        Step (->
          register cl, "gilligan", "sailorhat", @parallel()
          register cl, "skipper", "coconuts", @parallel()
          register cl, "professor", "radio", @parallel()
          register cl, "mrshowell", "pearls", @parallel()
        ), ((err, user1, user2, user3, user4) ->
          throw err  if err
          users.gilligan.profile = user1.profile
          users.skipper.profile = user2.profile
          users.professor.profile = user3.profile
          users.mrshowell.profile = user4.profile
          accessToken cl,
            nickname: "gilligan"
            password: "sailorhat"
          , @parallel()
          accessToken cl,
            nickname: "skipper"
            password: "coconuts"
          , @parallel()
          accessToken cl,
            nickname: "professor"
            password: "radio"
          , @parallel()
          accessToken cl,
            nickname: "mrshowell"
            password: "pearls"
          , @parallel()
        ), ((err, pair1, pair2, pair3, pair4) ->
          url = undefined
          cred = undefined
          act = undefined
          throw err  if err
          users.gilligan.pair = pair1
          users.skipper.pair = pair2
          users.professor.pair = pair3
          users.mrshowell.pair = pair4
          cred = makeCred(cl, pair4)
          act =
            verb: "follow"
            object:
              objectType: "person"
              id: users.gilligan.profile.id

          url = "http://localhost:4815/api/user/mrshowell/feed"
          httputil.postJSON url, cred, act, this
        ), ((err, doc, resp) ->
          url = undefined
          cred = undefined
          act = undefined
          throw err  if err
          cred = makeCred(cl, users.gilligan.pair)
          act =
            verb: "post"
            to: [
              objectType: "collection"
              id: "http://activityschema.org/collection/public"
            ]
            bcc: [
              id: users.skipper.profile.id
              objectType: "person"
            ]
            object:
              objectType: "note"
              content: "Sorry!"

          url = "http://localhost:4815/api/user/gilligan/feed"
          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          if err
            cb err, null, null
          else
            cb null, doc, users


      "it works": (err, doc, users) ->
        assert.ifError err

      "and another user views the activity":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.professor.pair)
          callback = @callback
          url = doc.id
          httputil.getJSON url, cred, (err, act, resp) ->
            callback err, act


        "it works": (err, act) ->
          assert.ifError err

        "they can't see the bcc": (err, act) ->
          assert.ifError err
          assert.isObject act
          assert.isFalse act.hasOwnProperty("bcc")

      "and the author views the activity":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.gilligan.pair)
          callback = @callback
          url = doc.id
          httputil.getJSON url, cred, (err, act, resp) ->
            callback err, act


        "it works": (err, act) ->
          assert.ifError err

        "they can see the bcc": (err, act) ->
          assert.ifError err
          assert.isObject act
          assert.isTrue act.hasOwnProperty("bcc")

      "and another user views the author's timeline":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.professor.pair)
          callback = @callback
          url = "http://localhost:4815/api/user/gilligan/feed"
          httputil.getJSON url, cred, (err, feed, resp) ->
            callback err, feed


        "it works": (err, feed) ->
          assert.ifError err

        "they can't see the bcc": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.isObject feed.items[0]
          assert.isFalse feed.items[0].hasOwnProperty("bcc")

      "and the author views their own timeline":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.gilligan.pair)
          callback = @callback
          url = "http://localhost:4815/api/user/gilligan/feed"
          httputil.getJSON url, cred, (err, feed, resp) ->
            callback err, feed


        "it works": (err, feed) ->
          assert.ifError err

        "they can see the bcc": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.isObject feed.items[0]
          assert.isTrue feed.items[0].hasOwnProperty("bcc")

      "and a follower views their own inbox":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrshowell.pair)
          callback = @callback
          url = "http://localhost:4815/api/user/mrshowell/inbox"
          
          # Give it a couple of seconds to be distributed
          setTimeout (->
            httputil.getJSON url, cred, (err, feed, resp) ->
              callback err, feed

          ), 2000

        "it works": (err, feed) ->
          assert.ifError err

        "they can't see the bcc": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.isArray feed.items
          assert.lengthOf feed.items, 2
          assert.isObject feed.items[0]
          assert.isFalse feed.items[0].hasOwnProperty("bcc")

      "and the author views their own inbox":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.gilligan.pair)
          callback = @callback
          url = "http://localhost:4815/api/user/gilligan/inbox"
          
          # Give it a couple of seconds to be distributed
          setTimeout (->
            httputil.getJSON url, cred, (err, feed, resp) ->
              callback err, feed

          ), 2000

        "it works": (err, feed) ->
          assert.ifError err

        "they can see the bcc": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.isArray feed.items
          assert.lengthOf feed.items, 2
          assert.isObject feed.items[0]
          assert.isTrue feed.items[0].hasOwnProperty("bcc")

    "and a user posts an activity with bto":
      topic: (cl) ->
        cb = @callback
        users =
          maryanne: {}
          ginger: {}
          mrhowell: {}
          santa: {}

        Step (->
          register cl, "maryanne", "gingham", @parallel()
          register cl, "ginger", "glamour", @parallel()
          register cl, "mrhowell", "wealth", @parallel()
          register cl, "santa", "hohoho", @parallel()
        ), ((err, user1, user2, user3, user4) ->
          throw err  if err
          users.maryanne.profile = user1.profile
          users.ginger.profile = user2.profile
          users.mrhowell.profile = user3.profile
          users.santa.profile = user4.profile
          accessToken cl,
            nickname: "maryanne"
            password: "gingham"
          , @parallel()
          accessToken cl,
            nickname: "ginger"
            password: "glamour"
          , @parallel()
          accessToken cl,
            nickname: "mrhowell"
            password: "wealth"
          , @parallel()
          accessToken cl,
            nickname: "santa"
            password: "hohoho"
          , @parallel()
        ), ((err, pair1, pair2, pair3, pair4) ->
          url = undefined
          cred = undefined
          act = undefined
          throw err  if err
          users.maryanne.pair = pair1
          users.ginger.pair = pair2
          users.mrhowell.pair = pair3
          users.santa.pair = pair4
          cred = makeCred(cl, pair4)
          act =
            verb: "follow"
            object:
              objectType: "person"
              id: users.maryanne.profile.id

          url = "http://localhost:4815/api/user/santa/feed"
          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          act = undefined
          cred = undefined
          throw err  if err
          cred = makeCred(cl, users.maryanne.pair)
          act =
            verb: "post"
            to: [
              objectType: "collection"
              id: "http://activityschema.org/collection/public"
            ]
            bto: [
              id: users.ginger.profile.id
              objectType: "person"
            ]
            object:
              objectType: "note"
              content: "Dinner's ready!"

          url = "http://localhost:4815/api/user/maryanne/feed"
          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          if err
            cb err, null, null
          else
            cb null, doc, users


      "it works": (err, doc, users) ->
        assert.ifError err

      "and another user views the activity":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrhowell.pair)
          callback = @callback
          url = doc.id
          httputil.getJSON url, cred, (err, act, resp) ->
            callback err, act


        "it works": (err, act) ->
          assert.ifError err

        "they can't see the bto": (err, act) ->
          assert.ifError err
          assert.isObject act
          assert.isFalse act.hasOwnProperty("bto")

      "and the author views the activity":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.maryanne.pair)
          callback = @callback
          url = doc.id
          httputil.getJSON url, cred, (err, act, resp) ->
            callback err, act


        "it works": (err, act) ->
          assert.ifError err

        "they can see the bto": (err, act) ->
          assert.ifError err
          assert.isObject act
          assert.isTrue act.hasOwnProperty("bto")

      "and another user views the author's timeline":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrhowell.pair)
          callback = @callback
          url = "http://localhost:4815/api/user/maryanne/feed"
          httputil.getJSON url, cred, (err, feed, resp) ->
            callback err, feed


        "it works": (err, feed) ->
          assert.ifError err

        "they can't see the bto": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.isObject feed.items[0]
          assert.isFalse feed.items[0].hasOwnProperty("bto")

      "and the author views their own timeline":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.maryanne.pair)
          callback = @callback
          url = "http://localhost:4815/api/user/maryanne/feed"
          httputil.getJSON url, cred, (err, feed, resp) ->
            callback err, feed


        "it works": (err, feed) ->
          assert.ifError err

        "they can see the bto": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.isObject feed.items[0]
          assert.isTrue feed.items[0].hasOwnProperty("bto")

      "and a follower views their own inbox":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.santa.pair)
          callback = @callback
          url = "http://localhost:4815/api/user/santa/inbox"
          
          # Give it a couple of seconds to be distributed
          setTimeout (->
            httputil.getJSON url, cred, (err, feed, resp) ->
              callback err, feed

          ), 2000

        "it works": (err, feed) ->
          assert.ifError err

        "they can't see the bto": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.isArray feed.items
          assert.lengthOf feed.items, 2
          assert.isObject feed.items[0]
          assert.isFalse feed.items[0].hasOwnProperty("bto")

      "and the author views their own inbox":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.maryanne.pair)
          callback = @callback
          url = "http://localhost:4815/api/user/maryanne/inbox"
          
          # Give it a couple of seconds to be distributed
          setTimeout (->
            httputil.getJSON url, cred, (err, feed, resp) ->
              callback err, feed

          ), 2000

        "it works": (err, feed) ->
          assert.ifError err

        "they can see the bto": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.isArray feed.items
          assert.lengthOf feed.items, 2
          assert.isObject feed.items[0]
          assert.isTrue feed.items[0].hasOwnProperty("bto")

suite["export"] module
