# user-stream-api.js
#
# Test user streams
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
setupApp = oauthutil.setupApp
register = oauthutil.register
accessToken = oauthutil.accessToken
newCredentials = oauthutil.newCredentials
ignore = (err) ->

suite = vows.describe("User stream API test")

# A batch for testing the read access to the API
suite.addBatch "When we set up the app":
  topic: ->
    setupApp @callback

  teardown: (app) ->
    app.close()  if app and app.close

  "it works": (err, app) ->
    assert.ifError err

  "and we get new credentials":
    topic: ->
      newCredentials "dora", "v4m0nos", @callback

    "it works": (err, cred) ->
      assert.ifError err
      assert.isObject cred
      assert.isString cred.consumer_key
      assert.isString cred.consumer_secret
      assert.isString cred.token
      assert.isString cred.token_secret

    "and we check the feed endpoint": httputil.endpoint("/api/user/dora/feed", ["GET", "POST"])
    "and we check the minor feed endpoint": httputil.endpoint("/api/user/dora/feed/minor", ["GET"])
    "and we check the major feed endpoint": httputil.endpoint("/api/user/dora/feed/major", ["GET"])
    "and we check the inbox endpoint": httputil.endpoint("/api/user/dora/inbox", ["GET", "POST"])
    "and we check the minor inbox endpoint": httputil.endpoint("/api/user/dora/inbox/minor", ["GET"])
    "and we check the major inbox endpoint": httputil.endpoint("/api/user/dora/inbox/major", ["GET"])
    "and we get the feed of a new user":
      topic: (cred) ->
        cb = @callback
        httputil.getJSON "http://localhost:4815/api/user/dora/feed", cred, (err, feed, result) ->
          cb err, feed


      "it works": (err, feed) ->
        assert.ifError err

      "it has the right members": (err, feed) ->
        assert.include feed, "author"
        assert.include feed.author, "id"
        assert.include feed.author, "displayName"
        assert.include feed.author, "objectType"
        assert.include feed, "totalItems"
        assert.include feed, "items"
        assert.include feed, "displayName"
        assert.include feed, "id"
        assert.include feed, "objectTypes"
        assert.include feed.objectTypes, "activity"

      "it is empty": (err, feed) ->
        assert.equal feed.totalItems, 0
        assert.isEmpty feed.items

      "and we get the inbox of a new user":
        topic: (feed, cred) ->
          cb = @callback
          httputil.getJSON "http://localhost:4815/api/user/dora/inbox", cred, (err, feed, result) ->
            cb err, feed


        "it works": (err, inbox) ->
          assert.ifError err

        "it has the right members": (err, inbox) ->
          assert.include inbox, "author"
          assert.include inbox.author, "id"
          assert.include inbox.author, "displayName"
          assert.include inbox.author, "objectType"
          assert.include inbox, "totalItems"
          assert.include inbox, "items"
          assert.include inbox, "displayName"
          assert.include inbox, "id"
          assert.include inbox, "objectTypes"
          assert.include inbox.objectTypes, "activity"

        "it is empty": (err, inbox) ->
          assert.equal inbox.totalItems, 0
          assert.isEmpty inbox.items

        "and we post a new activity":
          topic: (inbox, feed, cred) ->
            cb = @callback
            act =
              verb: "post"
              object:
                objectType: "note"
                content: "Hello, world!"

            httputil.postJSON "http://localhost:4815/api/user/dora/feed", cred, act, (err, feed, result) ->
              cb err, feed


          "it works": (err, act) ->
            assert.ifError err

          "results look right": (err, act) ->
            assert.isObject act
            assert.include act, "id"
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

          "and we read the feed":
            topic: (act, inbox, feed, cred) ->
              cb = @callback
              httputil.getJSON "http://localhost:4815/api/user/dora/feed", cred, (err, newf) ->
                if err
                  cb err
                else
                  cb null,
                    act: act
                    feed: newf



            "it works": (err, res) ->
              assert.ifError err

            "it has the right members": (err, res) ->
              assert.isObject res
              assert.include res, "feed"
              feed = res.feed
              assert.include feed, "author"
              assert.include feed.author, "id"
              assert.include feed.author, "displayName"
              assert.include feed.author, "objectType"
              assert.include feed, "totalItems"
              assert.include feed, "items"
              assert.include feed, "displayName"
              assert.include feed, "id"
              assert.include feed, "objectTypes"
              assert.include feed.objectTypes, "activity"

            "it has one object": (err, res) ->
              assert.isObject res
              assert.include res, "feed"
              feed = res.feed
              assert.equal feed.totalItems, 1
              assert.lengthOf feed.items, 1

            "it has our activity": (err, res) ->
              assert.isObject res
              assert.include res, "feed"
              assert.include res, "act"
              feed = res.feed
              act = res.act
              assert.equal feed.items[0].id, act.id

          "and we read the inbox":
            topic: (act, inbox, feed, cred) ->
              cb = @callback
              httputil.getJSON "http://localhost:4815/api/user/dora/inbox", cred, (err, newb) ->
                if err
                  cb err
                else
                  cb null,
                    act: act
                    inbox: newb



            "it works": (err, res) ->
              assert.ifError err

            "it has the right members": (err, res) ->
              assert.isObject res
              assert.include res, "inbox"
              inbox = res.inbox
              assert.include inbox, "author"
              assert.include inbox.author, "id"
              assert.include inbox.author, "displayName"
              assert.include inbox.author, "objectType"
              assert.include inbox, "totalItems"
              assert.include inbox, "items"
              assert.include inbox, "displayName"
              assert.include inbox, "id"
              assert.include inbox, "objectTypes"
              assert.include inbox.objectTypes, "activity"

            "it has one item": (err, res) ->
              assert.isObject res
              assert.include res, "inbox"
              inbox = res.inbox
              assert.equal inbox.totalItems, 1
              assert.lengthOf inbox.items, 1

            "it has our activity": (err, res) ->
              assert.isObject res
              assert.include res, "inbox"
              assert.include res, "act"
              inbox = res.inbox
              act = res.act
              assert.equal inbox.items[0].id, act.id


# Test some "bad" kinds of activity
suite.addBatch "When we set up the app":
  topic: ->
    setupApp @callback

  teardown: (app) ->
    app.close()  if app and app.close

  "it works": (err, app) ->
    assert.ifError err

  "and we get new credentials":
    topic: (app) ->
      newCredentials "diego", "rescue", @callback

    "it works": (err, cred) ->
      assert.ifError err
      assert.isObject cred
      assert.isString cred.consumer_key
      assert.isString cred.consumer_secret
      assert.isString cred.token
      assert.isString cred.token_secret

    "and we try to post an activity with a different actor":
      topic: (cred, app) ->
        cb = @callback
        act =
          actor:
            id: "urn:uuid:66822a4d-9f72-4168-8d5a-0b1319afeeb1"
            objectType: "person"
            displayName: "Not Diego"

          verb: "post"
          object:
            objectType: "note"
            content: "To the rescue!"

        httputil.postJSON "http://localhost:4815/api/user/diego/feed", cred, act, (err, feed, result) ->
          if err
            cb null
          else if result.statusCode < 400 or result.statusCode >= 500
            cb new Error("Unexpected result")
          else
            cb null


      "it fails correctly": (err) ->
        assert.ifError err

    "and we try to post an activity with no object":
      topic: (cred, app) ->
        cb = @callback
        act = verb: "noop"
        httputil.postJSON "http://localhost:4815/api/user/diego/feed", cred, act, (err, feed, result) ->
          if err
            cb null
          else if result.statusCode < 400 or result.statusCode >= 500
            cb new Error("Unexpected result")
          else
            cb null


      "it fails correctly": (err) ->
        assert.ifError err

    "and we try to post an activity as a different user":
      topic: (cred, app) ->
        cb = @callback
        cl =
          client_id: cred.consumer_key
          client_secret: cred.consumer_secret

        act =
          verb: "post"
          object:
            objectType: "note"
            content: "To the rescue!"

        Step (->
          register cl, "boots", "bananas", this
        ), ((err, user) ->
          throw err  if err
          accessToken cl,
            nickname: "boots"
            password: "bananas"
          , this
        ), (err, pair) ->
          nuke = undefined
          if err
            cb err
          else
            nuke = _(cred).clone()
            _(nuke).extend pair
            httputil.postJSON "http://localhost:4815/api/user/diego/feed", nuke, act, (err, feed, result) ->
              if err
                cb null
              else if result.statusCode < 400 or result.statusCode >= 500
                cb new Error("Unexpected result")
              else
                cb null



      "it fails correctly": (err) ->
        assert.ifError err

    "and we try to post an activity with a default verb":
      topic: (cred, app) ->
        cb = @callback
        act = object:
          objectType: "note"
          content: "Hello, llama!"

        httputil.postJSON "http://localhost:4815/api/user/diego/feed", cred, act, (err, posted, result) ->
          if err
            cb err, null
          else
            cb null, posted


      "it works": (err, act) ->
        assert.ifError err

      "it has the right verb": (err, act) ->
        assert.equal act.verb, "post"


# Test arguments to the feed
BASE = "http://localhost:4815/api/user/alicia/feed"
INBOX = "http://localhost:4815/api/user/alicia/inbox"
justDoc = (callback) ->
  (err, doc, resp) ->
    callback err, doc

docPlus = (callback, plus) ->
  (err, doc, resp) ->
    callback err, doc, plus

getDoc = (url) ->
  (cred) ->
    httputil.getJSON url, cred, justDoc(@callback)

failDoc = (url) ->
  (cred) ->
    cb = @callback
    httputil.getJSON url, cred, (err, doc, resp) ->
      if err and err.statusCode and err.statusCode >= 400 and err.statusCode < 500
        cb null
      else if err
        cb err
      else
        cb new Error("Unexpected success")


cmpDoc = (url) ->
  (full, cred) ->
    httputil.getJSON url, cred, docPlus(@callback, full)

cmpBefore = (base, idx, count) ->
  (full, cred) ->
    id = full.items[idx].id
    url = base + "?before=" + id
    url = url + "&count=" + count  unless _(count).isUndefined()
    httputil.getJSON url, cred, docPlus(@callback, full)

cmpSince = (base, idx, count) ->
  (full, cred) ->
    id = full.items[idx].id
    url = base + "?since=" + id
    url = url + "&count=" + count  unless _(count).isUndefined()
    httputil.getJSON url, cred, docPlus(@callback, full)

itWorks = (err, doc) ->
  assert.ifError err, doc

itFails = (err) ->
  assert.ifError err

validForm = (count, total) ->
  (err, doc) ->
    assert.include doc, "author"
    assert.include doc.author, "id"
    assert.include doc.author, "displayName"
    assert.include doc.author, "objectType"
    assert.include doc, "totalItems"
    assert.include doc, "items"
    assert.include doc, "displayName"
    assert.include doc, "id"
    assert.include doc, "url"
    assert.lengthOf doc.items, count  if _(count).isNumber()
    assert.equal doc.totalItems, total  if _(total).isNumber()
    assert.include doc, "links"
    assert.isObject doc.links
    assert.include doc.links, "self"
    assert.isString doc.links.self
    assert.include doc.links, "first"
    assert.isString doc.links.first
    assert.include doc.links, "prev"  if _(count).isNumber() and count isnt 0

validData = (start, end) ->
  (err, doc, full) ->
    assert.deepEqual doc.items, full.items.slice(start, end)

suite.addBatch "When we set up the app":
  topic: ->
    setupApp @callback

  teardown: (app) ->
    app.close()  if app and app.close

  "it works": (err, app) ->
    assert.ifError err

  "and we get new credentials":
    topic: (app) ->
      newCredentials "alicia", "base*station", @callback

    "it works": (err, cred) ->
      assert.ifError err
      assert.isObject cred
      assert.isString cred.consumer_key
      assert.isString cred.consumer_secret
      assert.isString cred.token
      assert.isString cred.token_secret

    "and we post a bunch of activities":
      topic: (cred) ->
        cb = @callback
        Step (->
          group = @group()
          i = undefined
          act =
            verb: "post"
            object:
              objectType: "note"
              content: "Hello, World!"

          newAct = undefined
          url = BASE
          i = 0
          while i < 100
            newAct = JSON.parse(JSON.stringify(act))
            newAct.object.content = "Hello, World #" + i + "!"
            httputil.postJSON url, cred, newAct, group()
            i++
        ), (err) ->
          cb err


      "it works": (err) ->
        assert.ifError err

      "and we get the default feed":
        topic: getDoc(BASE)
        "it works": itWorks
        "it looks right": validForm(20, 100)

      "and we get the full feed":
        topic: getDoc(BASE + "?count=100")
        "it works": itWorks
        "it looks right": validForm(100, 100)
        "and we get the feed with a non-zero offset":
          topic: cmpDoc(BASE + "?offset=50")
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(50, 70)

        "and we get the feed with a zero offset":
          topic: cmpDoc(BASE + "?offset=0")
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(0, 20)

        "and we get the feed with a non-zero offset and count":
          topic: cmpDoc(BASE + "?offset=20&count=20")
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(20, 40)

        "and we get the feed with a zero offset and count":
          topic: cmpDoc(BASE + "?offset=0")
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(0, 20)

        "and we get the feed with a non-zero count":
          topic: cmpDoc(BASE + "?count=50")
          "it works": itWorks
          "it looks right": validForm(50, 100)
          "it has the right data": validData(0, 50)

        "and we get the feed since a value":
          topic: cmpSince(BASE, 25)
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(5, 25)

        "and we get the feed before a value":
          topic: cmpBefore(BASE, 25)
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(26, 46)

        "and we get the feed since a small value":
          topic: cmpSince(BASE, 5)
          "it works": itWorks
          "it looks right": validForm(5, 100)
          "it has the right data": validData(0, 5)

        "and we get the feed before a big value":
          topic: cmpBefore(BASE, 94)
          "it works": itWorks
          "it looks right": validForm(5, 100)
          "it has the right data": validData(95, 100)

        "and we get the feed since a value with a count":
          topic: cmpSince(BASE, 75, 50)
          "it works": itWorks
          "it looks right": validForm(50, 100)
          "it has the right data": validData(25, 75)

        "and we get the feed before a value with a count":
          topic: cmpBefore(BASE, 35, 50)
          "it works": itWorks
          "it looks right": validForm(50, 100)
          "it has the right data": validData(36, 86)

        "and we get the feed since a value with a zero count":
          topic: cmpSince(BASE, 30, 0)
          "it works": itWorks
          "it looks right": validForm(0, 100)

        "and we get the feed before a value with a zero count":
          topic: cmpBefore(BASE, 60, 0)
          "it works": itWorks
          "it looks right": validForm(0, 100)

        "and we get the full feed by following 'next' links":
          topic: (full, cred) ->
            cb = @callback
            items = []
            addResultsOf = (url) ->
              httputil.getJSON url, cred, (err, doc, resp) ->
                if err
                  cb err, null, null
                else
                  if doc.items.length > 0
                    items = items.concat(doc.items)
                    if doc.links.next
                      addResultsOf doc.links.next
                    else
                      cb null, items, full
                  else
                    cb null, items, full


            addResultsOf BASE

          "it works": itWorks
          "it looks correct": (err, items, full) ->
            assert.isArray items
            assert.lengthOf items, full.items.length
            assert.deepEqual items, full.items

      "and we get the feed with a negative count":
        topic: failDoc(BASE + "?count=-30")
        "it fails correctly": itFails

      "and we get the feed with a negative offset":
        topic: failDoc(BASE + "?offset=-50")
        "it fails correctly": itFails

      "and we get the feed with a zero offset and zero count":
        topic: getDoc(BASE + "?offset=0&count=0")
        "it works": itWorks
        "it looks right": validForm(0, 100)

      "and we get the feed with a non-zero offset and zero count":
        topic: getDoc(BASE + "?offset=30&count=0")
        "it works": itWorks
        "it looks right": validForm(0, 100)

      "and we get the feed with a non-integer count":
        topic: failDoc(BASE + "?count=foo")
        "it fails correctly": itFails

      "and we get the feed with a non-integer offset":
        topic: failDoc(BASE + "?offset=bar")
        "it fails correctly": itFails

      "and we get the feed with a too-large offset":
        topic: getDoc(BASE + "?offset=200")
        "it works": itWorks
        "it looks right": validForm(0, 100)

      "and we get the feed with a too-large count":
        topic: getDoc(BASE + "?count=150")
        "it works": itWorks
        "it looks right": validForm(100, 100)

      "and we get the feed with a disallowed count":
        topic: failDoc(BASE + "?count=1000")
        "it fails correctly": itFails

      "and we get the feed before a nonexistent id":
        topic: failDoc(BASE + "?before=" + encodeURIComponent("http://example.net/nonexistent"))
        "it fails correctly": itFails

      "and we get the feed since a nonexistent id":
        topic: failDoc(BASE + "?since=" + encodeURIComponent("http://example.net/nonexistent"))
        "it fails correctly": itFails

      "and we get the default inbox":
        topic: getDoc(INBOX)
        "it works": itWorks
        "it looks right": validForm(20, 100)

      "and we get the full inbox":
        topic: getDoc(INBOX + "?count=100")
        "it works": itWorks
        "it looks right": validForm(100, 100)
        "and we get the inbox with a non-zero offset":
          topic: cmpDoc(INBOX + "?offset=50")
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(50, 70)

        "and we get the inbox with a zero offset":
          topic: cmpDoc(INBOX + "?offset=0")
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(0, 20)

        "and we get the inbox with a non-zero offset and count":
          topic: cmpDoc(INBOX + "?offset=20&count=20")
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(20, 40)

        "and we get the inbox with a zero offset and count":
          topic: cmpDoc(INBOX + "?offset=0")
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(0, 20)

        "and we get the inbox with a non-zero count":
          topic: cmpDoc(INBOX + "?count=50")
          "it works": itWorks
          "it looks right": validForm(50, 100)
          "it has the right data": validData(0, 50)

        "and we get the inbox since a value":
          topic: cmpSince(INBOX, 25)
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(5, 25)

        "and we get the inbox before a value":
          topic: cmpBefore(INBOX, 25)
          "it works": itWorks
          "it looks right": validForm(20, 100)
          "it has the right data": validData(26, 46)

        "and we get the inbox since a small value":
          topic: cmpSince(INBOX, 5)
          "it works": itWorks
          "it looks right": validForm(5, 100)
          "it has the right data": validData(0, 5)

        "and we get the inbox before a big value":
          topic: cmpBefore(INBOX, 94)
          "it works": itWorks
          "it looks right": validForm(5, 100)
          "it has the right data": validData(95, 100)

        "and we get the inbox since a value with a count":
          topic: cmpSince(INBOX, 75, 50)
          "it works": itWorks
          "it looks right": validForm(50, 100)
          "it has the right data": validData(25, 75)

        "and we get the inbox before a value with a count":
          topic: cmpBefore(INBOX, 35, 50)
          "it works": itWorks
          "it looks right": validForm(50, 100)
          "it has the right data": validData(36, 86)

        "and we get the inbox since a value with a zero count":
          topic: cmpSince(INBOX, 30, 0)
          "it works": itWorks
          "it looks right": validForm(0, 100)

        "and we get the inbox before a value with a zero count":
          topic: cmpBefore(INBOX, 60, 0)
          "it works": itWorks
          "it looks right": validForm(0, 100)

      "and we get the inbox with a negative count":
        topic: failDoc(INBOX + "?count=-30")
        "it fails correctly": itFails

      "and we get the inbox with a negative offset":
        topic: failDoc(INBOX + "?offset=-50")
        "it fails correctly": itFails

      "and we get the inbox with a zero offset and zero count":
        topic: getDoc(INBOX + "?offset=0&count=0")
        "it works": itWorks
        "it looks right": validForm(0, 100)

      "and we get the inbox with a non-zero offset and zero count":
        topic: getDoc(INBOX + "?offset=30&count=0")
        "it works": itWorks
        "it looks right": validForm(0, 100)

      "and we get the inbox with a non-integer count":
        topic: failDoc(INBOX + "?count=foo")
        "it fails correctly": itFails

      "and we get the inbox with a non-integer offset":
        topic: failDoc(INBOX + "?offset=bar")
        "it fails correctly": itFails

      "and we get the inbox with a too-large offset":
        topic: getDoc(INBOX + "?offset=200")
        "it works": itWorks
        "it looks right": validForm(0, 100)

      "and we get the inbox with a too-large count":
        topic: getDoc(INBOX + "?count=150")
        "it works": itWorks
        "it looks right": validForm(100, 100)

      "and we get the inbox with a disallowed count":
        topic: failDoc(INBOX + "?count=1000")
        "it fails correctly": itFails

      "and we get the inbox before a nonexistent id":
        topic: failDoc(INBOX + "?before=" + encodeURIComponent("http://example.net/nonexistent"))
        "it fails correctly": itFails

      "and we get the inbox since a nonexistent id":
        topic: failDoc(INBOX + "?since=" + encodeURIComponent("http://example.net/nonexistent"))
        "it fails correctly": itFails

suite["export"] module
