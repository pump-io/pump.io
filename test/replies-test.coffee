# replies-test.js
#
# Test adding and removing replies
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
_ = require("underscore")
Step = require("step")
schema = require("../lib/schema").schema
URLMaker = require("../lib/urlmaker").URLMaker
Databank = databank.Databank
DatabankObject = databank.DatabankObject
suite = vows.describe("replies interface")
suite.addBatch "When we initialize the environment":
  topic: ->
    cb = @callback
    
    # Need this to make IDs
    URLMaker.hostname = "example.net"
    
    # Dummy databank
    params = schema: schema
    db = Databank.get("memory", params)
    db.connect {}, (err) ->
      if err
        cb err
      else
        DatabankObject.bank = db
        cb null


  "it works": (err) ->
    assert.ifError err

  "and we create a new object":
    topic: ->
      Note = require("../lib/model/note").Note
      Note.create
        content: "This sucks."
      , @callback

    "it works": (err, note) ->
      assert.ifError err
      assert.isObject note

    "it has a getReplies() method": (err, note) ->
      assert.isFunction note.getReplies

    "and we check its replies list":
      topic: (note) ->
        note.getReplies 0, 20, @callback

      "it works": (err, replies) ->
        assert.ifError err

      "it is empty": (err, replies) ->
        assert.isArray replies
        assert.lengthOf replies, 0

  "and we create a new object and post a reply":
    topic: ->
      Note = require("../lib/model/note").Note
      note = null
      Comment = require("../lib/model/comment").Comment
      cb = @callback
      Step (->
        Note.create
          content: "Testing testing 123."
        , this
      ), ((err, result) ->
        throw err  if err
        note = result
        Comment.create
          content: "Whatever."
          inReplyTo: note
        , this
      ), (err, comment) ->
        if err
          cb err, null, null
        else
          cb null, comment, note


    "it works": (err, comment, note) ->
      assert.ifError err
      assert.isObject comment
      assert.isObject note

    "and we check the replies of the first object":
      topic: (comment, note) ->
        cb = @callback
        note.getReplies 0, 20, (err, list) ->
          cb err, list, comment


      "it works": (err, list, comment) ->
        assert.ifError err

      "it looks correct": (err, list, comment) ->
        assert.isArray list
        assert.lengthOf list, 1
        assert.isObject list[0]
        assert.include list[0], "id"
        assert.equal list[0].id, comment.id

  "and we create a new object and post a reply and remove the reply":
    topic: ->
      Note = require("../lib/model/note").Note
      note = null
      Comment = require("../lib/model/comment").Comment
      cb = @callback
      Step (->
        Note.create
          content: "Another test note."
        , this
      ), ((err, result) ->
        throw err  if err
        note = result
        Comment.create
          content: "Still bad."
          inReplyTo: note
        , this
      ), ((err, comment) ->
        throw err  if err
        comment.del this
      ), (err) ->
        if err
          cb err, null, null
        else
          cb null, note


    "it works": (err, note) ->
      assert.ifError err

    "and we check the replies of the first object":
      topic: (note) ->
        cb = @callback
        note.getReplies 0, 20, (err, list) ->
          cb err, list


      "it works": (err, list, comment) ->
        assert.ifError err

      "it looks correct": (err, list, comment) ->
        assert.isArray list
        assert.lengthOf list, 0

  "and we create a new object and post a reply and post a reply to that":
    topic: ->
      Note = require("../lib/model/note").Note
      note = null
      Comment = require("../lib/model/comment").Comment
      cb = @callback
      comment1 = null
      Step (->
        Note.create
          content: "Test again."
        , this
      ), ((err, result) ->
        throw err  if err
        note = result
        Comment.create
          content: "PLBBBBTTTTBBTT."
          inReplyTo: note
        , this
      ), ((err, comment) ->
        throw err  if err
        comment1 = comment
        Comment.create
          content: "Uncalled for!"
          inReplyTo: comment
        , this
      ), (err, comment2) ->
        if err
          cb err, null, null, null
        else
          cb null, comment2, comment1, note


    "it works": (err, comment2, comment1, note) ->
      assert.ifError err

    "and we check the replies of the first object":
      topic: (comment2, comment1, note) ->
        cb = @callback
        note.getReplies 0, 20, (err, list) ->
          cb err, list, comment1, comment2


      "it works": (err, list, comment1, comment2) ->
        assert.ifError err

      "it looks correct": (err, list, comment1, comment2) ->
        assert.isArray list
        assert.lengthOf list, 1
        assert.equal list[0].id, comment1.id
        assert.include list[0], "replies"
        assert.include list[0].replies, "items"
        assert.lengthOf list[0].replies.items, 1
        assert.equal list[0].replies.items[0].id, comment2.id

  "and we create a new object and post a lot of replies":
    topic: ->
      Note = require("../lib/model/note").Note
      note = null
      Comment = require("../lib/model/comment").Comment
      cb = @callback
      comments = null
      Step (->
        Note.create
          content: "More testing."
        , this
      ), ((err, result) ->
        i = undefined
        group = @group()
        throw err  if err
        note = result
        i = 0
        while i < 100
          Comment.create
            content: "YOU LIE."
            inReplyTo: note
          , group()
          i++
      ), (err, comments) ->
        if err
          cb err, null, null
        else
          cb null, comments, note


    "it works": (err, comments, note) ->
      assert.ifError err
      assert.isArray comments
      assert.isObject note

    "and we check the replies of the first object":
      topic: (comments, note) ->
        cb = @callback
        note.getReplies 0, 200, (err, list) ->
          cb err, list, comments, note


      "it works": (err, list, comments, note) ->
        assert.ifError err

      "it looks correct": (err, list, comments, note) ->
        i = undefined
        listIDs = new Array(100)
        commentIDs = new Array(100)
        assert.isArray list
        assert.lengthOf list, 100
        i = 0
        while i < 100
          listIDs[i] = list[i].id
          commentIDs[i] = comments[i].id
          i++
        i = 0
        while i < 100
          assert.include listIDs, comments[i].id
          assert.include commentIDs, list[i].id
          i++

  "and we create a new object and expand its feeds":
    topic: ->
      Note = require("../lib/model/note").Note
      note = null
      cb = @callback
      Step (->
        Note.create
          content: "Blow face."
        , this
      ), ((err, result) ->
        throw err  if err
        note = result
        note.expandFeeds this
      ), (err) ->
        if err
          cb err, null
        else
          cb null, note


    "it works": (err, note) ->
      assert.ifError err

    "its replies element looks right": (err, note) ->
      assert.ifError err
      assert.isObject note
      assert.include note, "replies"
      assert.isObject note.replies
      assert.include note.replies, "totalItems"
      assert.equal note.replies.totalItems, 0
      assert.include note.replies, "url"
      assert.isString note.replies.url

  "and we create a new object and post a reply and expand the object's feeds":
    topic: ->
      Note = require("../lib/model/note").Note
      note = null
      Comment = require("../lib/model/comment").Comment
      cb = @callback
      comment = null
      Step (->
        Note.create
          content: "Test your face."
        , this
      ), ((err, result) ->
        throw err  if err
        note = result
        Comment.create
          content: "UR FACE"
          inReplyTo: note
        , this
      ), ((err, result) ->
        throw err  if err
        comment = result
        note.expandFeeds this
      ), (err) ->
        if err
          cb err, null, null
        else
          cb null, comment, note


    "it works": (err, comment, note) ->
      assert.ifError err

    "its replies element looks right": (err, comment, note) ->
      assert.include note, "replies"
      assert.isObject note.replies
      assert.include note.replies, "totalItems"
      assert.equal note.replies.totalItems, 1
      assert.include note.replies, "url"
      assert.isString note.replies.url
      assert.include note.replies, "items"
      assert.isArray note.replies.items
      assert.lengthOf note.replies.items, 1
      assert.equal note.replies.items[0].id, comment.id

suite["export"] module
