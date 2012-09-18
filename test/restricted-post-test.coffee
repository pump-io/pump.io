# default-recipient-test.js
#
# Test setting default recipients for an activity
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

clientCred = (cl) ->
  consumer_key: cl.client_id
  consumer_secret: cl.client_secret


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

    "and a user posts a note to another user":
      topic: (cl) ->
        cb = @callback
        users =
          mrmoose:
            password: "pingpongballs"

          mrbunnyrabbit:
            password: "carrots"

          townclown:
            password: "balloons"

        Step (->
          register cl, "mrmoose", users.mrmoose.password, @parallel()
          register cl, "mrbunnyrabbit", users.mrbunnyrabbit.password, @parallel()
          register cl, "townclown", users.townclown.password, @parallel()
        ), ((err, user1, user2, user3) ->
          throw err  if err
          users.mrmoose.profile = user1.profile
          users.mrbunnyrabbit.profile = user2.profile
          users.townclown.profile = user3.profile
          accessToken cl,
            nickname: "mrmoose"
            password: users.mrmoose.password
          , @parallel()
          accessToken cl,
            nickname: "mrbunnyrabbit"
            password: users.mrbunnyrabbit.password
          , @parallel()
          accessToken cl,
            nickname: "townclown"
            password: users.townclown.password
          , @parallel()
        ), ((err, pair1, pair2, pair3) ->
          url = undefined
          cred = undefined
          act = undefined
          throw err  if err
          users.mrmoose.pair = pair1
          users.mrbunnyrabbit.pair = pair2
          users.townclown.pair = pair3
          cred = makeCred(cl, pair3)
          act =
            verb: "follow"
            object:
              objectType: "person"
              id: users.mrmoose.profile.id

          url = "http://localhost:4815/api/user/townclown/feed"
          httputil.postJSON url, cred, act, this
        ), ((err, doc, resp) ->
          url = undefined
          cred = undefined
          act = undefined
          throw err  if err
          cred = makeCred(cl, users.mrmoose.pair)
          act =
            verb: "post"
            to: [
              id: users.mrbunnyrabbit.profile.id
              objectType: "person"
            ]
            object:
              objectType: "note"
              content: "Knock knock!"

          url = "http://localhost:4815/api/user/mrmoose/feed"
          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          if err
            cb err, null, null
          else
            cb null, doc, users


      "it works": (err, doc, users) ->
        assert.ifError err

      "and the author reads the activity":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrmoose.pair)
          cb = @callback
          url = doc.links.self.href
          httputil.getJSON url, cred, (err, act, response) ->
            cb err, doc, act


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and the author reads the note":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrmoose.pair)
          cb = @callback
          url = doc.object.id
          httputil.getJSON url, cred, (err, note, response) ->
            cb err, doc.object, note


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and the author reads the likes stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrmoose.pair)
          cb = @callback
          url = doc.object.likes.url
          httputil.getJSON url, cred, (err, likes, response) ->
            cb err, likes


        "it works": (err, likes) ->
          assert.ifError err
          assert.isObject likes

      "and the author reads the replies stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrmoose.pair)
          cb = @callback
          url = doc.object.replies.url
          httputil.getJSON url, cred, (err, replies, response) ->
            cb err, replies


        "it works": (err, replies) ->
          assert.ifError err
          assert.isObject replies

      "and the author reads their own feed":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrmoose.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/mrmoose/feed"
          httputil.getJSON url, cred, (err, feed, response) ->
            cb err, doc, feed


        "it works": (err, act, feed) ->
          assert.ifError err

        "it includes the private post-note activity": (err, act, feed) ->
          assert.ifError err
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.equal feed.items[0].id, act.id

      "and the author reads their own inbox":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrmoose.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/mrmoose/inbox"
          httputil.getJSON url, cred, (err, inbox, response) ->
            cb err, doc, inbox


        "it works": (err, act, inbox) ->
          assert.ifError err

        "it includes the private post-note activity": (err, act, inbox) ->
          assert.ifError err
          assert.include inbox, "items"
          assert.isArray inbox.items
          assert.lengthOf inbox.items, 2
          assert.equal inbox.items[0].id, act.id

      "and the recipient reads the activity":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrbunnyrabbit.pair)
          cb = @callback
          url = doc.links.self.href
          httputil.getJSON url, cred, (err, act, response) ->
            cb err, doc, act


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and the recipient reads the note":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrbunnyrabbit.pair)
          cb = @callback
          url = doc.object.id
          httputil.getJSON url, cred, (err, note, response) ->
            cb err, doc.object, note


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and the recipient reads the likes stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrbunnyrabbit.pair)
          cb = @callback
          url = doc.object.likes.url
          httputil.getJSON url, cred, (err, likes, response) ->
            cb err, likes


        "it works": (err, likes) ->
          assert.ifError err
          assert.isObject likes

      "and the recipient reads the replies stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrbunnyrabbit.pair)
          cb = @callback
          url = doc.object.replies.url
          httputil.getJSON url, cred, (err, replies, response) ->
            cb err, replies


        "it works": (err, replies) ->
          assert.ifError err
          assert.isObject replies

      "and the recipient reads the author's feed":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrbunnyrabbit.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/mrmoose/feed"
          httputil.getJSON url, cred, (err, feed, response) ->
            cb err, doc, feed


        "it works": (err, act, feed) ->
          assert.ifError err

        "it includes the private post-note activity": (err, act, feed) ->
          assert.ifError err
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.equal feed.items[0].id, act.id

      "and the recipient reads their own inbox":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrbunnyrabbit.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/mrbunnyrabbit/inbox"
          httputil.getJSON url, cred, (err, inbox, response) ->
            cb err, doc, inbox


        "it works": (err, act, inbox) ->
          assert.ifError err

        "it includes the private post-note activity": (err, act, inbox) ->
          assert.ifError err
          assert.include inbox, "items"
          assert.isArray inbox.items
          assert.lengthOf inbox.items, 1
          assert.equal inbox.items[0].id, act.id

      "and a follower reads the activity":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.townclown.pair)
          cb = @callback
          url = doc.links.self.href
          httputil.getJSON url, cred, (err, act, response) ->
            if err and err.statusCode and err.statusCode is 403
              cb null
            else if err
              cb err
            else
              cb new Error("Unexpected success")


        "it fails with a 403 Forbidden": (err) ->
          assert.ifError err

      "and a follower reads the note":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.townclown.pair)
          cb = @callback
          url = doc.object.id
          httputil.getJSON url, cred, (err, note, response) ->
            if err and err.statusCode and err.statusCode is 403
              cb null
            else if err
              cb err
            else
              cb new Error("Unexpected success")


        "it fails with a 403 Forbidden": (err) ->
          assert.ifError err

      "and a follower reads the likes stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.townclown.pair)
          cb = @callback
          url = doc.object.likes.url
          httputil.getJSON url, cred, (err, likes, response) ->
            if err and err.statusCode and err.statusCode is 403
              cb null
            else if err
              cb err
            else
              cb new Error("Unexpected success")


        "it fails with a 403 Forbidden": (err) ->
          assert.ifError err

      "and a follower reads the replies stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.townclown.pair)
          cb = @callback
          url = doc.object.replies.url
          httputil.getJSON url, cred, (err, replies, response) ->
            if err and err.statusCode and err.statusCode is 403
              cb null
            else if err
              cb err
            else
              cb new Error("Unexpected success")


        "it fails with a 403 Forbidden": (err) ->
          assert.ifError err

      "and a follower reads the author's feed":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.townclown.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/mrmoose/feed"
          httputil.getJSON url, cred, (err, feed, response) ->
            cb err, doc, feed


        "it works": (err, act, feed) ->
          assert.ifError err

        "it does not include the private post-note activity": (err, act, feed) ->
          assert.ifError err
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 0

      "and a follower reads their own inbox":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.townclown.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/townclown/inbox"
          httputil.getJSON url, cred, (err, inbox, response) ->
            cb err, doc, inbox


        "it works": (err, act, inbox) ->
          assert.ifError err

        "it doesn't include the private post-note activity": (err, act, inbox) ->
          assert.ifError err
          assert.include inbox, "items"
          assert.isArray inbox.items
          
          # should be the follow activity
          assert.lengthOf inbox.items, 1
          assert.notEqual inbox.items[0].id, act.id

      "and an anonymous user reads the activity":
        topic: (doc, users, cl) ->
          cred = clientCred(cl)
          cb = @callback
          url = doc.links.self.href
          httputil.getJSON url, cred, (err, act, response) ->
            if err and err.statusCode and err.statusCode is 403
              cb null
            else if err
              cb err
            else
              cb new Error("Unexpected success")


        "it fails with a 403 Forbidden": (err) ->
          assert.ifError err

      "and an anonymous user reads the note":
        topic: (doc, users, cl) ->
          cred = clientCred(cl)
          cb = @callback
          url = doc.object.id
          httputil.getJSON url, cred, (err, note, response) ->
            if err and err.statusCode and err.statusCode is 403
              cb null
            else if err
              cb err
            else
              cb new Error("Unexpected success")


        "it fails with a 403 Forbidden": (err) ->
          assert.ifError err

      "and an anonymous user reads the likes stream":
        topic: (doc, users, cl) ->
          cred = clientCred(cl)
          cb = @callback
          url = doc.object.likes.url
          httputil.getJSON url, cred, (err, likes, response) ->
            if err and err.statusCode and err.statusCode is 403
              cb null
            else if err
              cb err
            else
              cb new Error("Unexpected success")


        "it fails with a 403 Forbidden": (err) ->
          assert.ifError err

      "and an anonymous user reads the replies stream":
        topic: (doc, users, cl) ->
          cred = clientCred(cl)
          cb = @callback
          url = doc.object.replies.url
          httputil.getJSON url, cred, (err, replies, response) ->
            if err and err.statusCode and err.statusCode is 403
              cb null
            else if err
              cb err
            else
              cb new Error("Unexpected success")


        "it fails with a 403 Forbidden": (err) ->
          assert.ifError err

      "and an anonymous user reads the author's feed":
        topic: (doc, users, cl) ->
          cred = clientCred(cl)
          cb = @callback
          url = "http://localhost:4815/api/user/mrmoose/feed"
          httputil.getJSON url, cred, (err, feed, response) ->
            cb err, doc, feed


        "it works": (err, act, feed) ->
          assert.ifError err

        "it does not include the private post-note activity": (err, act, feed) ->
          assert.ifError err
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 0

    "and a user posts a public note":
      topic: (cl) ->
        cb = @callback
        users =
          captain:
            password: "kangaroo"

          mrgreenjeans:
            password: "animals"

          dancingbear:
            password: "doll"

        Step (->
          register cl, "captain", users.captain.password, @parallel()
          register cl, "mrgreenjeans", users.mrgreenjeans.password, @parallel()
          register cl, "dancingbear", users.dancingbear.password, @parallel()
        ), ((err, user1, user2, user3) ->
          throw err  if err
          users.captain.profile = user1.profile
          users.mrgreenjeans.profile = user2.profile
          users.dancingbear.profile = user3.profile
          accessToken cl,
            nickname: "captain"
            password: users.captain.password
          , @parallel()
          accessToken cl,
            nickname: "mrgreenjeans"
            password: users.mrgreenjeans.password
          , @parallel()
          accessToken cl,
            nickname: "dancingbear"
            password: users.dancingbear.password
          , @parallel()
        ), ((err, pair1, pair2, pair3) ->
          url = undefined
          cred = undefined
          act = undefined
          throw err  if err
          users.captain.pair = pair1
          users.mrgreenjeans.pair = pair2
          users.dancingbear.pair = pair3
          cred = makeCred(cl, pair3)
          act =
            verb: "follow"
            object:
              objectType: "person"
              id: users.captain.profile.id

          url = "http://localhost:4815/api/user/dancingbear/feed"
          httputil.postJSON url, cred, act, this
        ), ((err, doc, resp) ->
          url = undefined
          cred = undefined
          act = undefined
          Collection = require("../lib/model/collection").Collection
          throw err  if err
          cred = makeCred(cl, users.captain.pair)
          act =
            verb: "post"
            to: [
              id: Collection.PUBLIC
              objectType: "collection"
            ]
            object:
              objectType: "note"
              content: "Good morning!"

          url = "http://localhost:4815/api/user/captain/feed"
          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          if err
            cb err, null, null
          else
            cb null, doc, users


      "it works": (err, doc, users) ->
        assert.ifError err

      "and the author reads the activity":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.captain.pair)
          cb = @callback
          url = doc.links.self.href
          httputil.getJSON url, cred, (err, act, response) ->
            cb err, doc, act


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and the author reads the note":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.captain.pair)
          cb = @callback
          url = doc.object.id
          httputil.getJSON url, cred, (err, note, response) ->
            cb err, doc.object, note


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and the author reads the likes stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.captain.pair)
          cb = @callback
          url = doc.object.likes.url
          httputil.getJSON url, cred, (err, likes, response) ->
            cb err, likes


        "it works": (err, likes) ->
          assert.ifError err
          assert.isObject likes

      "and the author reads the replies stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.captain.pair)
          cb = @callback
          url = doc.object.replies.url
          httputil.getJSON url, cred, (err, replies, response) ->
            cb err, replies


        "it works": (err, replies) ->
          assert.ifError err
          assert.isObject replies

      "and the author reads their own feed":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.captain.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/captain/feed"
          httputil.getJSON url, cred, (err, feed, response) ->
            cb err, doc, feed


        "it works": (err, act, feed) ->
          assert.ifError err

        "it includes the public post-note activity": (err, act, feed) ->
          assert.ifError err
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.equal feed.items[0].id, act.id

      "and the author reads their own inbox":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.captain.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/captain/inbox"
          httputil.getJSON url, cred, (err, inbox, response) ->
            cb err, doc, inbox


        "it works": (err, act, inbox) ->
          assert.ifError err

        "it includes the public post-note activity": (err, act, inbox) ->
          assert.ifError err
          assert.include inbox, "items"
          assert.isArray inbox.items
          assert.lengthOf inbox.items, 2
          assert.equal inbox.items[0].id, act.id

      "and an unrelated user reads the activity":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrgreenjeans.pair)
          cb = @callback
          url = doc.links.self.href
          httputil.getJSON url, cred, (err, act, response) ->
            cb err, doc, act


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and an unrelated user reads the note":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrgreenjeans.pair)
          cb = @callback
          url = doc.object.id
          httputil.getJSON url, cred, (err, note, response) ->
            cb err, doc.object, note


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and an unrelated user reads the likes stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrgreenjeans.pair)
          cb = @callback
          url = doc.object.likes.url
          httputil.getJSON url, cred, (err, likes, response) ->
            cb err, likes


        "it works": (err, likes) ->
          assert.ifError err
          assert.isObject likes

      "and an unrelated user reads the replies stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrgreenjeans.pair)
          cb = @callback
          url = doc.object.replies.url
          httputil.getJSON url, cred, (err, replies, response) ->
            cb err, replies


        "it works": (err, replies) ->
          assert.ifError err
          assert.isObject replies

      "and an unrelated user reads the author's feed":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrgreenjeans.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/captain/feed"
          httputil.getJSON url, cred, (err, feed, response) ->
            cb err, doc, feed


        "it works": (err, act, feed) ->
          assert.ifError err

        "it includes the public post-note activity": (err, act, feed) ->
          assert.ifError err
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.equal feed.items[0].id, act.id

      "and an unrelated user reads their own inbox":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.mrgreenjeans.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/mrgreenjeans/inbox"
          httputil.getJSON url, cred, (err, inbox, response) ->
            cb err, doc, inbox


        "it works": (err, act, inbox) ->
          assert.ifError err

        "it does not include the public post-note activity": (err, act, inbox) ->
          assert.ifError err
          assert.include inbox, "totalItems"
          assert.isNumber inbox.totalItems
          assert.equal inbox.totalItems, 0

      "and a follower reads the activity":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.dancingbear.pair)
          cb = @callback
          url = doc.links.self.href
          httputil.getJSON url, cred, (err, act, response) ->
            cb err, doc, act


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and a follower reads the note":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.dancingbear.pair)
          cb = @callback
          url = doc.object.id
          httputil.getJSON url, cred, (err, note, response) ->
            cb err, doc.object, note


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and a follower reads the likes stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.dancingbear.pair)
          cb = @callback
          url = doc.object.likes.url
          httputil.getJSON url, cred, (err, likes, response) ->
            cb err, likes


        "it works": (err, likes) ->
          assert.ifError err
          assert.isObject likes

      "and a follower reads the replies stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.dancingbear.pair)
          cb = @callback
          url = doc.object.replies.url
          httputil.getJSON url, cred, (err, replies, response) ->
            cb err, replies


        "it works": (err, replies) ->
          assert.ifError err
          assert.isObject replies

      "and a follower reads the author's feed":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.dancingbear.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/captain/feed"
          httputil.getJSON url, cred, (err, feed, response) ->
            cb err, doc, feed


        "it works": (err, act, feed) ->
          assert.ifError err

        "it includes the public post-note activity": (err, act, feed) ->
          assert.ifError err
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.equal feed.items[0].id, act.id

      "and a follower reads their own inbox":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.dancingbear.pair)
          cb = @callback
          url = "http://localhost:4815/api/user/dancingbear/inbox"
          httputil.getJSON url, cred, (err, inbox, response) ->
            cb err, doc, inbox


        "it works": (err, act, inbox) ->
          assert.ifError err

        "it includes the public post-note activity": (err, act, feed) ->
          assert.ifError err
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 2
          assert.equal feed.items[0].id, act.id

      "and an anonymous user reads the activity":
        topic: (doc, users, cl) ->
          cred = clientCred(cl)
          cb = @callback
          url = doc.links.self.href
          httputil.getJSON url, cred, (err, act, response) ->
            cb err, doc, act


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and an anonymous user reads the note":
        topic: (doc, users, cl) ->
          cred = clientCred(cl)
          cb = @callback
          url = doc.object.id
          httputil.getJSON url, cred, (err, note, response) ->
            cb err, doc.object, note


        "it works": (err, orig, copy) ->
          assert.ifError err
          assert.isObject copy
          assert.equal orig.id, copy.id

      "and an anonymous user reads the likes stream":
        topic: (doc, users, cl) ->
          cred = clientCred(cl)
          cb = @callback
          url = doc.object.likes.url
          httputil.getJSON url, cred, (err, likes, response) ->
            cb err, likes


        "it works": (err, likes) ->
          assert.ifError err
          assert.isObject likes

      "and an anonymous user reads the replies stream":
        topic: (doc, users, cl) ->
          cred = makeCred(cl, users.dancingbear.pair)
          cb = @callback
          url = doc.object.replies.url
          httputil.getJSON url, cred, (err, replies, response) ->
            cb err, replies


        "it works": (err, replies) ->
          assert.ifError err
          assert.isObject replies

      "and an anonymous user reads the author's feed":
        topic: (doc, users, cl) ->
          cred = clientCred(cl)
          cb = @callback
          url = "http://localhost:4815/api/user/captain/feed"
          httputil.getJSON url, cred, (err, feed, response) ->
            cb err, doc, feed


        "it works": (err, act, feed) ->
          assert.ifError err

        "it includes the public post-note activity": (err, act, feed) ->
          assert.ifError err
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.equal feed.items[0].id, act.id

suite["export"] module
