# list-api-test.js
#
# Test user collections of people
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
OAuth = require("oauth").OAuth
httputil = require("./lib/http")
oauthutil = require("./lib/oauth")
actutil = require("./lib/activity")
Queue = require("../lib/jankyqueue").Queue
setupApp = oauthutil.setupApp
newClient = oauthutil.newClient
newPair = oauthutil.newPair
register = oauthutil.register
makeCred = (cl, pair) ->
  consumer_key: cl.client_id
  consumer_secret: cl.client_secret
  token: pair.token
  token_secret: pair.token_secret

assertValidList = (doc, count, itemCount) ->
  assert.include doc, "author"
  assert.include doc.author, "id"
  assert.include doc.author, "displayName"
  assert.include doc.author, "objectType"
  assert.include doc, "totalItems"
  assert.include doc, "items"
  assert.include doc, "displayName"
  assert.include doc, "id"
  assert.equal doc.totalItems, count  if _(count).isNumber()
  assert.lengthOf doc.items, itemCount  if _(itemCount).isNumber()

assertValidActivity = (act) ->
  assert.isString act.id
  assert.include act, "actor"
  assert.isObject act.actor
  assert.include act.actor, "id"
  assert.isString act.actor.id
  assert.include act, "verb"
  assert.isString act.verb
  assert.include act, "object"
  assert.isObject act.object
  assert.include act.object, "id"
  assert.isString act.object.id
  assert.include act, "published"
  assert.isString act.published
  assert.include act, "updated"
  assert.isString act.updated

suite = vows.describe("list api test")

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

    "and we get the list of lists owned by a new user":
      topic: (cl) ->
        cb = @callback
        Step (->
          newPair cl, "eekamouse", "bongbongdiggydiggydang", this
        ), ((err, pair) ->
          throw err  if err
          cred = makeCred(cl, pair)
          url = "http://localhost:4815/api/user/eekamouse/lists"
          httputil.getJSON url, cred, this
        ), (err, doc, response) ->
          cb err, doc


      "it works": (err, lists) ->
        assert.ifError err

      "it is valid": (err, lists) ->
        assert.ifError err
        assertValidList lists, 5

    "and a user creates a list":
      topic: (cl) ->
        cb = @callback
        pair = null
        Step (->
          newPair cl, "yellowman", "nobodymove", this
        ), ((err, results) ->
          throw err  if err
          pair = results
          cred = makeCred(cl, pair)
          url = "http://localhost:4815/api/user/yellowman/feed"
          act =
            verb: "post"
            object:
              objectType: "collection"
              displayName: "Bad Boys"
              objectTypes: ["person"]

          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          cb err, doc, pair


      "it works": (err, act, pair) ->
        assert.ifError err
        assert.isObject act

      "results look correct": (err, act, pair) ->
        assert.include act, "id"
        assertValidActivity act

      "object has correct data": (err, act) ->
        assert.ifError err
        assert.equal act.object.objectType, "collection"
        assert.equal act.object.displayName, "Bad Boys"
        assert.include act.object, "members"
        assert.isObject act.object.members
        assert.include act.object.members, "totalItems"
        assert.equal act.object.members.totalItems, 0

      "and we get the list of lists owned by the user":
        topic: (act, pair, cl) ->
          cb = @callback
          cred = makeCred(cl, pair)
          url = "http://localhost:4815/api/user/yellowman/lists"
          httputil.getJSON url, cred, (err, doc, response) ->
            cb err, doc, act.object


        "it works": (err, lists, collection) ->
          assert.ifError err
          assert.isObject lists

        "it looks correct": (err, lists, collection) ->
          assert.ifError err
          assertValidList lists, 6
          assert.include lists, "objectTypes"
          assert.isArray lists.objectTypes
          assert.include lists.objectTypes, "collection"

        "it contains the new list": (err, lists, collection) ->
          assert.ifError err
          assert.include lists, "items"
          assert.isArray lists.items
          assert.lengthOf lists.items, 6
          assert.equal lists.items[0].id, collection.id

    "and a user creates a lot of lists":
      topic: (cl) ->
        cb = @callback
        pair = null
        Step (->
          newPair cl, "dekker", "sabotage", this
        ), ((err, results) ->
          throw err  if err
          pair = results
          cred = makeCred(cl, pair)
          url = "http://localhost:4815/api/user/dekker/feed"
          act =
            verb: "post"
            object:
              objectType: "collection"
              objectTypes: ["person"]

          group = @group()
          q = new Queue(10)
          i = 0

          while i < 100
            q.enqueue httputil.postJSON, [url, cred,
              verb: "post"
              object:
                objectType: "collection"
                objectTypes: ["person"]
                displayName: "Israelites #" + i
            ], group()
            i++
        ), (err, docs, responses) ->
          cb err, docs, pair


      "it works": (err, lists) ->
        assert.ifError err
        assert.isArray lists
        assert.lengthOf lists, 100
        i = 0

        while i < 100
          assert.isObject lists[i]
          assertValidActivity lists[i]
          i++

      "and we get the list of lists owned by the user":
        topic: (acts, pair, cl) ->
          cb = @callback
          cred = makeCred(cl, pair)
          url = "http://localhost:4815/api/user/dekker/lists"
          httputil.getJSON url, cred, (err, doc, response) ->
            cb err, doc


        "it works": (err, lists, acts) ->
          assert.ifError err
          assert.isObject lists

        "it looks correct": (err, lists, acts) ->
          assert.ifError err
          assertValidList lists, 105, 20
          assert.include lists, "objectTypes"
          assert.isArray lists.objectTypes
          assert.include lists.objectTypes, "collection"

    "and a user deletes a list":
      topic: (cl) ->
        cb = @callback
        pair = null
        cred = null
        url = "http://localhost:4815/api/user/maxromeo/feed"
        list = null
        Step (->
          newPair cl, "maxromeo", "warina", this
        ), ((err, results) ->
          throw err  if err
          pair = results
          cred = makeCred(cl, pair)
          act =
            verb: "post"
            object:
              objectType: "collection"
              displayName: "Babylonians"
              objectTypes: ["person"]

          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          list = doc.object
          act =
            verb: "delete"
            object: list

          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          cb err, doc, pair


      "it works": (err, act) ->
        assert.ifError err
        assertValidActivity act

      "and we get the list of lists owned by the user":
        topic: (act, pair, cl) ->
          cb = @callback
          cred = makeCred(cl, pair)
          url = "http://localhost:4815/api/user/maxromeo/lists"
          httputil.getJSON url, cred, (err, doc, response) ->
            cb err, doc


        "it works": (err, lists, acts) ->
          assert.ifError err
          assert.isObject lists

        "it looks correct": (err, lists, acts) ->
          assert.ifError err
          assertValidList lists, 5
          assert.include lists, "objectTypes"
          assert.isArray lists.objectTypes
          assert.include lists.objectTypes, "collection"

    "and a user deletes a non-existent list":
      topic: (cl) ->
        cb = @callback
        pair = null
        cred = null
        url = "http://localhost:4815/api/user/scratch/feed"
        list = null
        Step (->
          newPair cl, "scratch", "roastfish&cornbread", this
        ), ((err, results) ->
          throw err  if err
          pair = results
          cred = makeCred(cl, pair)
          act =
            verb: "delete"
            object:
              objectType: "collection"
              id: "urn:uuid:88374dac-7ce7-40da-bbde-6655181d8458"

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

    "and a user creates a list that already exists":
      topic: (cl) ->
        cb = @callback
        pair = null
        cred = null
        url = "http://localhost:4815/api/user/petertosh/feed"
        Step (->
          newPair cl, "petertosh", "=rights", this
        ), ((err, results) ->
          throw err  if err
          pair = results
          cred = makeCred(cl, pair)
          act =
            verb: "post"
            object:
              objectType: "collection"
              displayName: "Wailers"
              objectTypes: ["person"]

          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          act =
            verb: "post"
            object:
              objectType: "collection"
              displayName: "Wailers"
              objectTypes: ["person"]

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

    "and a user adds another user to a created list":
      topic: (cl) ->
        cb = @callback
        pair = null
        cred = null
        url = "http://localhost:4815/api/user/patobanton/feed"
        list = undefined
        Step (->
          newPair cl, "patobanton", "myopinion", this
        ), ((err, results) ->
          throw err  if err
          pair = results
          cred = makeCred(cl, pair)
          act =
            verb: "post"
            object:
              objectType: "collection"
              displayName: "Collaborators"
              objectTypes: ["person"]

          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          list = doc.object
          register cl, "roger", "ranking", this
        ), ((err, user) ->
          if err
            cb err, null, null
            return
          act =
            verb: "add"
            object: user.profile
            target: list

          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          cb err, doc, pair


      "it works": (err, act, pair) ->
        assert.ifError err

      "and we get the collection of users in that list":
        topic: (act, pair, cl) ->
          cb = @callback
          cred = makeCred(cl, pair)
          url = act.target.id
          httputil.getJSON url, cred, (err, doc, response) ->
            cb err, doc, act.object


        "it works": (err, list, person) ->
          assert.ifError err
          assert.isObject list
          assert.isObject person

        "it includes that user": (err, list, person) ->
          assert.ifError err
          assert.lengthOf list.members.items, 1
          assert.equal list.members.items[0].id, person.id

        "and the user removes the other user from the list":
          topic: (list, person, act, pair, cl) ->
            cb = @callback
            cred = makeCred(cl, pair)
            url = "http://localhost:4815/api/user/patobanton/feed"
            ract =
              verb: "remove"
              object: person
              target: list

            httputil.postJSON url, cred, ract, cb

          "it works": (err, doc, response) ->
            assert.ifError err
            assertValidActivity doc

          "and we get the collection of users in that list":
            topic: (doc, response, list, person, act, pair, cl) ->
              cb = @callback
              cred = makeCred(cl, pair)
              url = act.target.id
              httputil.getJSON url, cred, (err, doc, response) ->
                cb err, doc, act.object


            "it works": (err, list, person) ->
              assert.ifError err
              assert.isObject list
              assert.isObject person

            "it does not include that user": (err, list, person) ->
              assert.ifError err
              assert.equal list.members.totalItems, 0

    "and a user adds an arbitrary person to a list":
      topic: (cl) ->
        cb = @callback
        pair = null
        cred = null
        url = "http://localhost:4815/api/user/toots/feed"
        list = undefined
        Step (->
          newPair cl, "toots", "54-46", this
        ), ((err, results) ->
          throw err  if err
          pair = results
          cred = makeCred(cl, pair)
          act =
            verb: "post"
            object:
              objectType: "collection"
              displayName: "Maytals"
              objectTypes: ["person"]

          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          list = doc.object
          act =
            verb: "add"
            object:
              id: "urn:uuid:bd4de1f6-b5dd-11e1-a58c-70f1a154e1aa"
              objectType: "person"
              displayName: "Raleigh Gordon"

            target: list

          httputil.postJSON url, cred, act, this
        ), (err, doc, response) ->
          cb err, doc, pair


      "it works": (err, doc, pair) ->
        assert.ifError err
        assertValidActivity doc

      "and we get the collection of users in that list":
        topic: (act, pair, cl) ->
          cb = @callback
          cred = makeCred(cl, pair)
          url = act.target.id
          httputil.getJSON url, cred, (err, doc, response) ->
            cb err, doc, act.object


        "it works": (err, list, person) ->
          assert.ifError err
          assert.isObject list
          assert.isObject person

        "it includes that user": (err, list, person) ->
          assert.ifError err
          assert.lengthOf list.members.items, 1
          assert.equal list.members.items[0].id, person.id

    "and a user removes another person from a list they're not in":
      topic: (cl) ->
        cb = @callback
        pair = null
        cred = null
        url = "http://localhost:4815/api/user/bunny/feed"
        list = undefined
        Step (->
          newPair cl, "bunny", "number3", this
        ), ((err, results) ->
          throw err  if err
          pair = results
          cred = makeCred(cl, pair)
          act =
            verb: "post"
            object:
              objectType: "collection"
              displayName: "Wailers"
              objectTypes: ["person"]

          httputil.postJSON url, cred, act, this
        ), ((err, doc, response) ->
          throw err  if err
          list = doc.object
          act =
            verb: "remove"
            object:
              id: "urn:uuid:88b33906-b9c9-11e1-98f5-70f1a154e1aa"
              objectType: "person"
              displayName: "Rita Marley"

            target: list

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

    "and a user adds another user to a list they don't own":
      topic: (cl) ->
        cb = @callback
        pair1 = null
        pair2 = null
        cred1 = null
        cred2 = null
        url1 = "http://localhost:4815/api/user/burningspear/feed"
        url2 = "http://localhost:4815/api/user/sugar/feed"
        list = undefined
        Step (->
          newPair cl, "burningspear", "m4rcus", @parallel()
          newPair cl, "sugar", "minott", @parallel()
        ), ((err, results1, results2) ->
          throw err  if err
          pair1 = results1
          pair2 = results2
          cred1 = makeCred(cl, pair1)
          cred2 = makeCred(cl, pair2)
          act =
            verb: "post"
            object:
              objectType: "collection"
              displayName: "Rastafarians"
              objectTypes: ["person"]

          httputil.postJSON url1, cred1, act, this
        ), ((err, doc, response) ->
          throw err  if err
          list = doc.object
          act =
            verb: "add"
            object:
              id: "urn:uuid:3db214bc-ba10-11e1-b5ac-70f1a154e1aa"
              objectType: "person"
              displayName: "Hillary Clinton"

            target: list

          httputil.postJSON url2, cred2, act, this
        ), (err, doc, response) ->
          if err and err.statusCode and err.statusCode >= 400 and err.statusCode < 500
            cb null
          else if err
            cb err
          else
            cb new Error("Unexpected success")


      "it fails correctly": (err) ->
        assert.ifError err

    "and a user adds a non-person object to a person list":
      topic: (cl) ->
        cb = @callback
        pair1 = null
        cred1 = null
        url1 = "http://localhost:4815/api/user/snooplion/feed"
        note = undefined
        list = undefined
        Step (->
          newPair cl, "snooplion", "lalala", this
        ), ((err, results1) ->
          throw err  if err
          pair1 = results1
          cred1 = makeCred(cl, pair1)
          act =
            verb: "post"
            object:
              objectType: "collection"
              displayName: "Friends"
              objectTypes: ["person"]

          httputil.postJSON url1, cred1, act, this
        ), ((err, doc, response) ->
          throw err  if err
          list = doc.object
          act =
            verb: "post"
            object:
              objectType: "note"
              content: "Yo."

          httputil.postJSON url1, cred1, act, this
        ), ((err, doc, response) ->
          throw err  if err
          note = doc.object
          act =
            verb: "add"
            object: note
            target: list

          httputil.postJSON url1, cred1, act, this
        ), (err, doc, response) ->
          if err and err.statusCode and err.statusCode >= 400 and err.statusCode < 500
            cb null
          else if err
            cb err
          else
            cb new Error("Unexpected success")


      "it fails correctly": (err) ->
        assert.ifError err

    "and a user removes another user from a list they don't own":
      topic: (cl) ->
        cb = @callback
        pair1 = null
        pair2 = null
        cred1 = null
        cred2 = null
        url1 = "http://localhost:4815/api/user/junior/feed"
        url2 = "http://localhost:4815/api/user/marcia/feed"
        list = undefined
        Step (->
          newPair cl, "junior", "murvin", @parallel()
          newPair cl, "marcia", "griffiths", @parallel()
        ), ((err, results1, results2) ->
          throw err  if err
          pair1 = results1
          pair2 = results2
          cred1 = makeCred(cl, pair1)
          cred2 = makeCred(cl, pair2)
          act =
            verb: "post"
            object:
              objectType: "collection"
              displayName: "Police"
              objectTypes: ["person"]

          httputil.postJSON url1, cred1, act, this
        ), ((err, doc, response) ->
          throw err  if err
          list = doc.object
          act =
            verb: "add"
            object:
              id: "urn:uuid:acfadb0a-ba16-11e1-bcbc-70f1a154e1aa"
              objectType: "person"
              displayName: "J. Edgar Hoover"

            target: list

          httputil.postJSON url1, cred1, act, this
        ), ((err, doc, response) ->
          if err
            
            # Got an error up to here; it"s an error
            cb err
            return
          act =
            verb: "remove"
            object: doc.object
            target: list

          httputil.postJSON url2, cred2, act, this
        ), (err, doc, response) ->
          if err and err.statusCode and err.statusCode >= 400 and err.statusCode < 500
            cb null
          else if err
            cb err
          else
            cb new Error("Unexpected success")


      "it fails correctly": (err) ->
        assert.ifError err

suite["export"] module
