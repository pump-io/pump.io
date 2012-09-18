# replies-api-test.js
#
# Test replies over the API
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
http = require("http")
urlparse = require("url").parse
httputil = require("./lib/http")
oauthutil = require("./lib/oauth")
actutil = require("./lib/activity")
setupApp = oauthutil.setupApp
register = oauthutil.register
accessToken = oauthutil.accessToken
newCredentials = oauthutil.newCredentials
suite = vows.describe("Activity API test")
assertGoodCred = (cred) ->
  assert.isObject cred
  assert.isString cred.consumer_key
  assert.isString cred.consumer_secret
  assert.isString cred.token
  assert.isString cred.token_secret


# A batch for testing the read-write access to the API
suite.addBatch "When we set up the app":
  topic: ->
    setupApp @callback

  teardown: (app) ->
    app.close()  if app and app.close

  "it works": (err, app) ->
    assert.ifError err

  "and we get new credentials":
    topic: ->
      newCredentials "macdonald", "theoldflag", @callback

    "it works": (err, cred) ->
      assert.ifError err
      assertGoodCred cred

    "and we post a new activity":
      topic: (cred) ->
        cb = @callback
        act =
          verb: "post"
          object:
            objectType: "note"
            content: "The people would prefer John A. drunk to George Brown sober."

        httputil.postJSON "http://localhost:4815/api/user/macdonald/feed", cred, act, (err, act, response) ->
          cb err, act


      "it works": (err, act) ->
        assert.ifError err
        assert.isObject act

      "the object includes a replies property": (err, act) ->
        assert.ifError err
        assert.isObject act
        assert.includes act, "object"
        assert.isObject act.object
        assert.includes act.object, "replies"
        assert.isObject act.object.replies
        assert.includes act.object.replies, "url"
        assert.isString act.object.replies.url
        assert.includes act.object.replies, "totalItems"
        assert.isNumber act.object.replies.totalItems
        assert.equal act.object.replies.totalItems, 0

      "and we fetch the replies feed":
        topic: (act, cred) ->
          cb = @callback
          url = act.object.replies.url
          httputil.getJSON url, cred, (err, coll, response) ->
            cb err, coll


        "it works": (err, coll) ->
          assert.ifError err
          assert.isObject coll

        "it is an empty collection": (err, coll) ->
          assert.ifError err
          assert.isObject coll
          assert.includes coll, "id"
          assert.isString coll.id
          assert.includes coll, "totalItems"
          assert.isNumber coll.totalItems
          assert.equal coll.totalItems, 0
          assert.includes coll, "items"
          assert.isArray coll.items
          assert.lengthOf coll.items, 0

  "and we make two new sets of credentials":
    topic: ->
      Step (->
        newCredentials "mackenzie", "railroad", @parallel()
        newCredentials "thompson", "beringsea", @parallel()
      ), @callback

    "it works": (err, cred1, cred2) ->
      assert.ifError err
      assertGoodCred cred1
      assertGoodCred cred2

    "and we post a photo and a comment":
      topic: (cred1, cred2) ->
        cb = @callback
        photo = undefined
        Step (->
          act =
            verb: "post"
            object:
              objectType: "image"
              url: "http://photos.example/1"
              summary: "New Parliament Buildings."

          httputil.postJSON "http://localhost:4815/api/user/mackenzie/feed", cred1, act, this
        ), ((err, act, response) ->
          reply = undefined
          throw err  if err
          photo = act
          reply =
            verb: "post"
            object:
              objectType: "comment"
              content: "Nice one!"
              inReplyTo: act.object

          httputil.postJSON "http://localhost:4815/api/user/thompson/feed", cred2, reply, this
        ), (err, reply, response) ->
          cb err, photo, reply


      "it works": (err, photo, reply) ->
        assert.ifError err
        assert.isObject photo
        assert.isObject reply
        assert.include photo, "id"
        assert.include photo, "object"
        assert.include photo.object, "replies"
        assert.include photo.object.replies, "url"
        assert.isString photo.object.replies.url
        assert.include reply, "object"
        assert.include reply.object, "inReplyTo"
        assert.include reply.object.inReplyTo, "id"
        assert.equal reply.object.inReplyTo.id, photo.object.id

      "and we check the replies feed":
        topic: (photo, reply, cred1, cred2) ->
          cb = @callback
          url = photo.object.replies.url
          httputil.getJSON url, cred1, (err, coll, response) ->
            cb err, coll, reply


        "it works": (err, coll, reply) ->
          assert.ifError err
          assert.isObject coll

        "it includes our reply": (err, coll, reply) ->
          assert.ifError err
          assert.isObject coll
          assert.includes coll, "totalItems"
          assert.isNumber coll.totalItems
          assert.equal coll.totalItems, 1
          assert.includes coll, "items"
          assert.isArray coll.items
          assert.lengthOf coll.items, 1
          assert.equal coll.items[0].id, reply.object.id

        "and we delete the reply and re-check the feed":
          topic: (coll, reply, photo, replyAgain, cred1, cred2) ->
            cb = @callback
            Step (->
              httputil.delJSON reply.object.id, cred2, this
            ), ((err, del, response) ->
              throw err  if err
              url = photo.object.replies.url
              httputil.getJSON url, cred1, this
            ), (err, coll, response) ->
              cb err, coll


          "it works": (err, coll) ->
            assert.ifError err
            assert.isObject coll

          "it is an empty collection": (err, coll) ->
            assert.ifError err
            assert.isObject coll
            assert.includes coll, "id"
            assert.isString coll.id
            assert.includes coll, "totalItems"
            assert.isNumber coll.totalItems
            assert.equal coll.totalItems, 0
            assert.includes coll, "items"
            assert.isArray coll.items
            assert.lengthOf coll.items, 0

  "and we make two more new sets of credentials":
    topic: ->
      Step (->
        newCredentials "laurier", "moderation", @parallel()
        newCredentials "borden", "overthere", @parallel()
      ), @callback

    "it works": (err, cred1, cred2) ->
      assert.ifError err
      assertGoodCred cred1
      assertGoodCred cred2

    "and we post a note and a lot of comments":
      topic: (cred1, cred2) ->
        cb = @callback
        note = undefined
        Step (->
          act =
            verb: "post"
            object:
              objectType: "note"
              summary: "I must get back to work."

          httputil.postJSON "http://localhost:4815/api/user/laurier/feed", cred1, act, this
        ), ((err, act, response) ->
          i = undefined
          comment = undefined
          group = @group()
          throw err  if err
          note = act
          i = 0
          while i < 100
            comment =
              verb: "post"
              object:
                objectType: "comment"
                content: "FIRST POST"
                inReplyTo: act.object

            httputil.postJSON "http://localhost:4815/api/user/borden/feed", cred2, comment, group()
            i++
        ), (err, comments, responses) ->
          cb err, note, comments


      "it works": (err, note, comments) ->
        assert.ifError err
        assert.isObject note
        assert.isArray comments
        assert.lengthOf comments, 100

      "and we get the full replies feed":
        topic: (note, comments, cred1, cred2) ->
          cb = @callback
          url = note.object.replies.url + "?count=100"
          httputil.getJSON url, cred1, (err, coll, response) ->
            cb err, coll, comments


        "it works": (err, coll, comments) ->
          assert.ifError err
          assert.isObject coll
          assert.isArray comments

        "it has the right data": (err, coll, comments) ->
          i = undefined
          collIDs = {}
          commentIDs = {}
          assert.isObject coll
          assert.includes coll, "id"
          assert.isString coll.id
          assert.includes coll, "totalItems"
          assert.isNumber coll.totalItems
          assert.equal coll.totalItems, 100
          assert.includes coll, "items"
          assert.isArray coll.items
          assert.lengthOf coll.items, 100
          i = 0
          while i < 100
            collIDs[coll.items[i].id] = 1
            commentIDs[comments[i].object.id] = 1
            i++
          i = 0
          while i < 100
            assert.include collIDs, comments[i].object.id
            assert.include commentIDs, coll.items[i].id
            i++

      "and we get the original item":
        topic: (note, comments, cred1, cred2) ->
          cb = @callback
          url = note.object.id
          httputil.getJSON url, cred1, (err, note, response) ->
            cb err, note, comments


        "it works": (err, note, comments) ->
          assert.ifError err
          assert.isObject note
          assert.isArray comments

        "it has the correct replies": (err, note, comments) ->
          i = undefined
          commentIDs = {}
          assert.ifError err
          assert.isObject note
          assert.include note, "replies"
          assert.include note.replies, "totalItems"
          assert.isNumber note.replies.totalItems
          assert.equal note.replies.totalItems, 100
          assert.include note.replies, "items"
          assert.isArray note.replies.items
          i = 0
          while i < 100
            commentIDs[comments[i].object.id] = 1
            i++
          i = 0
          while i < note.replies.items.length
            assert.include commentIDs, note.replies.items[i].id
            i++

suite["export"] module
