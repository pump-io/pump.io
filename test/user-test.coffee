# user-test.js
#
# Test the user module
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
Activity = require("../lib/model/activity").Activity
modelBatch = require("./lib/model").modelBatch
Databank = databank.Databank
DatabankObject = databank.DatabankObject
suite = vows.describe("user module interface")
testSchema =
  pkey: "nickname"
  fields: ["passwordHash", "published", "updated", "profile"]
  indices: ["profile.id"]

testData =
  create:
    nickname: "evan"
    password: "trustno1"
    profile:
      displayName: "Evan Prodromou"

  update:
    nickname: "evan"
    password: "correct horse battery staple" # the most secure password! see http://xkcd.com/936/


# XXX: hack hack hack
# modelBatch hard-codes ActivityObject-style
mb = modelBatch("user", "User", testSchema, testData)
mb["When we require the user module"]["and we get its User class export"]["and we create an user instance"]["auto-generated fields are there"] = (err, created) ->
  assert.isString created.passwordHash
  assert.isString created.published
  assert.isString created.updated

suite.addBatch mb
suite.addBatch "When we get the User class":
  topic: ->
    require("../lib/model/user").User

  "it exists": (User) ->
    assert.isFunction User

  "it has a fromPerson() method": (User) ->
    assert.isFunction User.fromPerson

  "it has a checkCredentials() method": (User) ->
    assert.isFunction User.checkCredentials

  "and we check the credentials for a non-existent user":
    topic: (User) ->
      cb = @callback
      User.checkCredentials "nosuchuser", "passw0rd", @callback

    "it returns null": (err, found) ->
      assert.ifError err
      assert.isNull found

  "and we create a user":
    topic: (User) ->
      props =
        nickname: "tom"
        password: "123456"

      User.create props, @callback

    teardown: (user) ->
      if user and user.del
        user.del (err) ->


    "it works": (user) ->
      assert.isObject user

    "it has the sanitize() method": (user) ->
      assert.isFunction user.sanitize

    "it has the getProfile() method": (user) ->
      assert.isFunction user.getProfile

    "it has the getOutboxStream() method": (user) ->
      assert.isFunction user.getOutboxStream

    "it has the getInboxStream() method": (user) ->
      assert.isFunction user.getInboxStream

    "it has the getMajorOutboxStream() method": (user) ->
      assert.isFunction user.getMajorOutboxStream

    "it has the getMajorInboxStream() method": (user) ->
      assert.isFunction user.getMajorInboxStream

    "it has the getMinorOutboxStream() method": (user) ->
      assert.isFunction user.getMinorOutboxStream

    "it has the getMinorInboxStream() method": (user) ->
      assert.isFunction user.getMinorInboxStream

    "it has the getLists() method": (user) ->
      assert.isFunction user.getLists

    "it has the expand() method": (user) ->
      assert.isFunction user.expand

    "it has the addToOutbox() method": (user) ->
      assert.isFunction user.addToOutbox

    "it has the addToInbox() method": (user) ->
      assert.isFunction user.addToInbox

    "it has the getFollowers() method": (user) ->
      assert.isFunction user.getFollowers

    "it has the getFollowing() method": (user) ->
      assert.isFunction user.getFollowing

    "it has the followerCount() method": (user) ->
      assert.isFunction user.followerCount

    "it has the followingCount() method": (user) ->
      assert.isFunction user.followingCount

    "it has the follow() method": (user) ->
      assert.isFunction user.follow

    "it has the stopFollowing() method": (user) ->
      assert.isFunction user.stopFollowing

    "it has the favorite() method": (user) ->
      assert.isFunction user.favorite

    "it has the unfavorite() method": (user) ->
      assert.isFunction user.unfavorite

    "it has a profile attribute": (user) ->
      assert.isObject user.profile
      assert.instanceOf user.profile, require("../lib/model/person").Person

    "and we check the credentials with the right password":
      topic: (user, User) ->
        User.checkCredentials "tom", "123456", @callback

      "it works": (err, user) ->
        assert.ifError err
        assert.isObject user

    "and we check the credentials with the wrong password":
      topic: (user, User) ->
        cb = @callback
        User.checkCredentials "tom", "654321", @callback

      "it returns null": (err, found) ->
        assert.ifError err
        assert.isNull found

    "and we try to retrieve it from the person id":
      topic: (user, User) ->
        User.fromPerson user.profile.id, @callback

      "it works": (err, found) ->
        assert.ifError err
        assert.isObject found
        assert.equal found.nickname, "tom"

    "and we try to get its profile":
      topic: (user) ->
        user.getProfile @callback

      "it works": (err, profile) ->
        assert.ifError err
        assert.isObject profile
        assert.instanceOf profile, require("../lib/model/person").Person

  "and we create a user and sanitize it":
    topic: (User) ->
      cb = @callback
      props =
        nickname: "dick"
        password: "foobar"

      User.create props, (err, user) ->
        if err
          cb err, null
        else
          user.sanitize()
          cb null, user


    teardown: (user) ->
      if user
        user.del (err) ->


    "it works": (err, user) ->
      assert.ifError err
      assert.isObject user

    "it is sanitized": (err, user) ->
      assert.isFalse _(user).has("password")
      assert.isFalse _(user).has("passwordHash")

  "and we create a new user and get its stream":
    topic: (User) ->
      cb = @callback
      user = null
      props =
        nickname: "harry"
        password: "un1c0rn"

      Step (->
        User.create props, this
      ), ((err, results) ->
        throw err  if err
        user = results
        user.getOutboxStream this
      ), ((err, outbox) ->
        throw err  if err
        outbox.getIDs 0, 20, this
      ), ((err, ids) ->
        throw err  if err
        Activity.readArray ids, this
      ), (err, activities) ->
        if err
          cb err, null
        else
          cb err,
            user: user
            activities: activities



    teardown: (results) ->
      if results
        results.user.del (err) ->


    "it works": (err, results) ->
      assert.ifError err
      assert.isObject results.user
      assert.isArray results.activities

    "it is empty": (err, results) ->
      assert.lengthOf results.activities, 0

    "and we add an activity to its stream":
      topic: (results) ->
        cb = @callback
        user = results.user
        props =
          verb: "checkin"
          object:
            objectType: "place"
            displayName: "Les Folies"
            url: "http://nominatim.openstreetmap.org/details.php?place_id=5001033"
            position: "+45.5253965-73.5818537/"
            address:
              streetAddress: "701 Mont-Royal Est"
              locality: "Montreal"
              region: "Quebec"
              postalCode: "H2J 2T5"

        Activity = require("../lib/model/activity").Activity
        act = new Activity(props)
        Step (->
          act.apply user.profile, this
        ), ((err) ->
          throw err  if err
          act.save this
        ), ((err) ->
          throw err  if err
          user.addToOutbox act, this
        ), (err) ->
          if err
            cb err, null
          else
            cb null,
              user: user
              activity: act



      "it works": (err, results) ->
        assert.ifError err

      "and we get the user stream":
        topic: (results) ->
          cb = @callback
          user = results.user
          activity = results.activity
          Step (->
            user.getOutboxStream this
          ), ((err, outbox) ->
            throw err  if err
            outbox.getIDs 0, 20, this
          ), ((err, ids) ->
            throw err  if err
            Activity.readArray ids, this
          ), (err, activities) ->
            if err
              cb err, null
            else
              cb null,
                user: user
                activity: activity
                activities: activities



        "it works": (err, results) ->
          assert.ifError err
          assert.isArray results.activities

        "it includes the added activity": (err, results) ->
          assert.lengthOf results.activities, 1
          assert.equal results.activities[0].id, results.activity.id

  "and we create a new user and get its lists stream":
    topic: (User) ->
      props =
        nickname: "gary"
        password: "cows"

      Step (->
        User.create props, this
      ), ((err, user) ->
        throw err  if err
        user.getLists this
      ), @callback

    "it works": (err, stream) ->
      assert.ifError err
      assert.isObject stream

    "and we get the count of lists":
      topic: (stream) ->
        stream.count @callback

      "it is five": (err, count) ->
        assert.ifError err
        assert.equal count, 5

    "and we get the first few lists":
      topic: (stream) ->
        stream.getItems 0, 20, @callback

      "it is a five-element list": (err, ids) ->
        assert.ifError err
        assert.isArray ids
        assert.lengthOf ids, 5

  "and we create a new user and get its inbox":
    topic: (User) ->
      cb = @callback
      user = null
      props =
        nickname: "maurice"
        password: "cappadoccia"

      Step (->
        User.create props, this
      ), ((err, results) ->
        throw err  if err
        user = results
        user.getInboxStream this
      ), ((err, inbox) ->
        throw err  if err
        inbox.getIDs 0, 20, this
      ), ((err, ids) ->
        throw err  if err
        Activity.readArray ids, this
      ), (err, activities) ->
        if err
          cb err, null
        else
          cb err,
            user: user
            activities: activities



    teardown: (results) ->
      if results
        results.user.del (err) ->


    "it works": (err, results) ->
      assert.ifError err
      assert.isObject results.user
      assert.isArray results.activities

    "it is empty": (err, results) ->
      assert.lengthOf results.activities, 0

    "and we add an activity to its inbox":
      topic: (results) ->
        cb = @callback
        user = results.user
        props =
          actor:
            id: "urn:uuid:8f7be1de-3f48-4a54-bf3f-b4fc18f3ae77"
            objectType: "person"
            displayName: "Abraham Lincoln"

          verb: "post"
          object:
            objectType: "note"
            content: "Remember to get eggs, bread, and milk."

        Activity = require("../lib/model/activity").Activity
        act = new Activity(props)
        Step (->
          act.apply user.profile, this
        ), ((err) ->
          throw err  if err
          act.save this
        ), ((err) ->
          throw err  if err
          user.addToInbox act, this
        ), (err) ->
          if err
            cb err, null
          else
            cb null,
              user: user
              activity: act



      "it works": (err, results) ->
        assert.ifError err

      "and we get the user inbox":
        topic: (results) ->
          cb = @callback
          user = results.user
          activity = results.activity
          Step (->
            user.getInboxStream this
          ), ((err, inbox) ->
            throw err  if err
            inbox.getIDs 0, 20, this
          ), ((err, ids) ->
            throw err  if err
            Activity.readArray ids, this
          ), (err, activities) ->
            if err
              cb err, null
            else
              cb null,
                user: user
                activity: activity
                activities: activities



        "it works": (err, results) ->
          assert.ifError err
          assert.isArray results.activities

        "it includes the added activity": (err, results) ->
          assert.lengthOf results.activities, 1
          assert.equal results.activities[0].id, results.activity.id

  "and we create a pair of users":
    topic: (User) ->
      cb = @callback
      Step (->
        User.create
          nickname: "shields"
          password: "wind"
        , @parallel()
        User.create
          nickname: "yarnell"
          password: "rope"
        , @parallel()
      ), (err, shields, yarnell) ->
        if err
          cb err, null
        else
          cb null,
            shields: shields
            yarnell: yarnell



    "it works": (err, users) ->
      assert.ifError err

    "and we make one follow the other":
      topic: (users) ->
        users.shields.follow users.yarnell.profile.id, @callback

      "it works": (err) ->
        assert.ifError err

      "and we check the first user's following list":
        topic: (users) ->
          cb = @callback
          users.shields.getFollowing 0, 20, (err, following) ->
            cb err, following, users.yarnell


        "it works": (err, following, other) ->
          assert.ifError err
          assert.isArray following

        "it is the right size": (err, following, other) ->
          assert.ifError err
          assert.lengthOf following, 1

        "it has the right data": (err, following, other) ->
          assert.ifError err
          assert.equal following[0].id, other.profile.id

      "and we check the first user's following count":
        topic: (users) ->
          users.shields.followingCount @callback

        "it works": (err, fc) ->
          assert.ifError err

        "it is correct": (err, fc) ->
          assert.ifError err
          assert.equal fc, 1

      "and we check the second user's followers list":
        topic: (users) ->
          cb = @callback
          users.yarnell.getFollowers 0, 20, (err, following) ->
            cb err, following, users.shields


        "it works": (err, followers, other) ->
          assert.ifError err
          assert.isArray followers

        "it is the right size": (err, followers, other) ->
          assert.ifError err
          assert.lengthOf followers, 1

        "it has the right data": (err, followers, other) ->
          assert.ifError err
          assert.equal followers[0].id, other.profile.id

      "and we check the second user's followers count":
        topic: (users) ->
          users.yarnell.followerCount @callback

        "it works": (err, fc) ->
          assert.ifError err

        "it is correct": (err, fc) ->
          assert.ifError err
          assert.equal fc, 1

  "and we create another pair of users following":
    topic: (User) ->
      cb = @callback
      users = {}
      Step (->
        User.create
          nickname: "captain"
          password: "beachboy"
        , @parallel()
        User.create
          nickname: "tenille"
          password: "muskrat"
        , @parallel()
      ), ((err, captain, tenille) ->
        throw err  if err
        users.captain = captain
        users.tenille = tenille
        captain.follow tenille.profile.id, this
      ), ((err) ->
        throw err  if err
        users.captain.stopFollowing users.tenille.profile.id, this
      ), (err) ->
        if err
          cb err, null
        else
          cb null, users


    "it works": (err, users) ->
      assert.ifError err

    "and we check the first user's following list":
      topic: (users) ->
        cb = @callback
        users.captain.getFollowing 0, 20, @callback

      "it works": (err, following, other) ->
        assert.ifError err
        assert.isArray following

      "it is the right size": (err, following, other) ->
        assert.ifError err
        assert.lengthOf following, 0

    "and we check the first user's following count":
      topic: (users) ->
        users.captain.followingCount @callback

      "it works": (err, fc) ->
        assert.ifError err

      "it is correct": (err, fc) ->
        assert.ifError err
        assert.equal fc, 0

    "and we check the second user's followers list":
      topic: (users) ->
        users.tenille.getFollowers 0, 20, @callback

      "it works": (err, followers, other) ->
        assert.ifError err
        assert.isArray followers

      "it is the right size": (err, followers, other) ->
        assert.ifError err
        assert.lengthOf followers, 0

    "and we check the second user's followers count":
      topic: (users) ->
        users.tenille.followerCount @callback

      "it works": (err, fc) ->
        assert.ifError err

      "it is correct": (err, fc) ->
        assert.ifError err
        assert.equal fc, 0

  "and one user follows another twice":
    topic: (User) ->
      cb = @callback
      users = {}
      Step (->
        User.create
          nickname: "boris"
          password: "squirrel"
        , @parallel()
        User.create
          nickname: "natasha"
          password: "moose"
        , @parallel()
      ), ((err, boris, natasha) ->
        throw err  if err
        users.boris = boris
        users.natasha = natasha
        users.boris.follow users.natasha.profile.id, this
      ), ((err) ->
        throw err  if err
        users.boris.follow users.natasha.profile.id, this
      ), (err) ->
        if err
          cb null
        else
          cb new Error("Unexpected success")


    "it fails correctly": (err) ->
      assert.ifError err

  "and one user stops following a user they never followed":
    topic: (User) ->
      cb = @callback
      users = {}
      Step (->
        User.create
          nickname: "rocky"
          password: "flying"
        , @parallel()
        User.create
          nickname: "bullwinkle"
          password: "rabbit"
        , @parallel()
      ), ((err, rocky, bullwinkle) ->
        throw err  if err
        users.rocky = rocky
        users.bullwinkle = bullwinkle
        users.rocky.stopFollowing users.bullwinkle.profile.id, this
      ), (err) ->
        if err
          cb null
        else
          cb new Error("Unexpected success")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we create a bunch of users":
    topic: (User) ->
      cb = @callback
      MAX_USERS = 50
      Step (->
        i = undefined
        group = @group()
        i = 0
        while i < MAX_USERS
          User.create
            nickname: "clown" + i
            password: "hahaha"
          , group()
          i++
      ), (err, users) ->
        if err
          cb err, null
        else
          cb null, users


    "it works": (err, users) ->
      assert.ifError err
      assert.isArray users
      assert.lengthOf users, 50

    "and they all follow someone":
      topic: (users) ->
        cb = @callback
        MAX_USERS = 50
        Step (->
          i = undefined
          group = @group()
          i = 1
          while i < users.length
            users[i].follow users[0].profile.id, group()
            i++
        ), (err) ->
          cb err


      "it works": (err) ->
        assert.ifError err

      "and we check the followed user's followers list":
        topic: (users) ->
          users[0].getFollowers 0, users.length + 1, @callback

        "it works": (err, followers) ->
          assert.ifError err
          assert.isArray followers
          assert.lengthOf followers, 49

      "and we check the followed user's followers count":
        topic: (users) ->
          users[0].followerCount @callback

        "it works": (err, fc) ->
          assert.ifError err

        "it is correct": (err, fc) ->
          assert.ifError err
          assert.equal fc, 49

      "and we check the following users' following lists":
        topic: (users) ->
          cb = @callback
          MAX_USERS = 50
          Step (->
            i = undefined
            group = @group()
            i = 1
            while i < users.length
              users[i].getFollowing 0, 20, group()
              i++
          ), cb

        "it works": (err, lists) ->
          i = undefined
          assert.ifError err
          assert.isArray lists
          assert.lengthOf lists, 49
          i = 0
          while i < lists.length
            assert.isArray lists[i]
            assert.lengthOf lists[i], 1
            i++

      "and we check the following users' following counts":
        topic: (users) ->
          cb = @callback
          MAX_USERS = 50
          Step (->
            i = undefined
            group = @group()
            i = 1
            while i < users.length
              users[i].followingCount group()
              i++
          ), cb

        "it works": (err, counts) ->
          i = undefined
          assert.ifError err
          assert.isArray counts
          assert.lengthOf counts, 49
          i = 0
          while i < counts.length
            assert.equal counts[i], 1
            i++


# Tests for major, minor streams
suite.addBatch
  "When we create a new user":
    topic: ->
      User = require("../lib/model/user").User
      props =
        nickname: "archie"
        password: "bunker"

      User.create props, @callback

    "it works": (err, user) ->
      assert.ifError err

    "and we check their minor inbox":
      topic: (user) ->
        callback = @callback
        Step (->
          user.getMinorInboxStream this
        ), ((err, str) ->
          throw err  if err
          str.getItems 0, 20, this
        ), callback

      "it's empty": (err, activities) ->
        assert.ifError err
        assert.isEmpty activities

    "and we check their minor outbox":
      topic: (user) ->
        callback = @callback
        Step (->
          user.getMinorOutboxStream this
        ), ((err, str) ->
          throw err  if err
          str.getItems 0, 20, this
        ), callback

      "it's empty": (err, activities) ->
        assert.ifError err
        assert.isEmpty activities

    "and we check their major inbox":
      topic: (user) ->
        callback = @callback
        Step (->
          user.getMajorInboxStream this
        ), ((err, str) ->
          throw err  if err
          str.getItems 0, 20, this
        ), callback

      "it's empty": (err, activities) ->
        assert.ifError err
        assert.isEmpty activities

    "and we check their major outbox":
      topic: (user) ->
        callback = @callback
        Step (->
          user.getMajorOutboxStream this
        ), ((err, str) ->
          throw err  if err
          str.getItems 0, 20, this
        ), callback

      "it's empty": (err, activities) ->
        assert.ifError err
        assert.isEmpty activities

  "When we create another user":
    topic: ->
      User = require("../lib/model/user").User
      props =
        nickname: "edith"
        password: "bunker"

      User.create props, @callback

    "it works": (err, user) ->
      assert.ifError err

    "and we add a major activity":
      topic: (user) ->
        act = undefined
        props =
          actor: user.profile
          verb: "post"
          object:
            objectType: "note"
            content: "Cling peaches"

        callback = @callback
        Step (->
          Activity.create props, this
        ), ((err, result) ->
          throw err  if err
          act = result
          user.addToInbox act, @parallel()
          user.addToOutbox act, @parallel()
        ), (err) ->
          if err
            callback err, null, null
          else
            callback null, user, act


      "it works": (err, user, activity) ->
        assert.ifError err

      "and we check their minor inbox":
        topic: (user, activity) ->
          callback = @callback
          Step (->
            user.getMinorInboxStream this
          ), ((err, str) ->
            throw err  if err
            str.getItems 0, 20, this
          ), callback

        "it's empty": (err, activities) ->
          assert.ifError err
          assert.isEmpty activities

      "and we check their minor outbox":
        topic: (user, activity) ->
          callback = @callback
          Step (->
            user.getMinorOutboxStream this
          ), ((err, str) ->
            throw err  if err
            str.getItems 0, 20, this
          ), callback

        "it's empty": (err, activities) ->
          assert.ifError err
          assert.isEmpty activities

      "and we check their major inbox":
        topic: (user, activity) ->
          callback = @callback
          Step (->
            user.getMajorInboxStream this
          ), ((err, str) ->
            throw err  if err
            str.getItems 0, 20, this
          ), (err, activities) ->
            if err
              callback err, null, null
            else
              callback err, activity, activities


        "it's in there": (err, activity, activities) ->
          assert.ifError err
          assert.isArray activities
          assert.lengthOf activities, 1
          assert.equal activities[0], activity.id

      "and we check their major outbox":
        topic: (user, activity) ->
          callback = @callback
          Step (->
            user.getMajorOutboxStream this
          ), ((err, str) ->
            throw err  if err
            str.getItems 0, 20, this
          ), (err, activities) ->
            if err
              callback err, null, null
            else
              callback err, activity, activities


        "it's in there": (err, activity, activities) ->
          assert.ifError err
          assert.isArray activities
          assert.lengthOf activities, 1
          assert.equal activities[0], activity.id

  "When we create yet another user":
    topic: ->
      User = require("../lib/model/user").User
      props =
        nickname: "gloria"
        password: "bunker"

      User.create props, @callback

    "it works": (err, user) ->
      assert.ifError err

    "and we add a minor activity":
      topic: (user) ->
        act = undefined
        props =
          actor: user.profile
          verb: "favorite"
          object:
            objectType: "image"
            id: "3740ed6e-fa2b-11e1-9287-70f1a154e1aa"

        callback = @callback
        Step (->
          Activity.create props, this
        ), ((err, result) ->
          throw err  if err
          act = result
          user.addToInbox act, @parallel()
          user.addToOutbox act, @parallel()
        ), (err) ->
          if err
            callback err, null, null
          else
            callback null, user, act


      "it works": (err, user, activity) ->
        assert.ifError err

      "and we check their major inbox":
        topic: (user, activity) ->
          callback = @callback
          Step (->
            user.getMajorInboxStream this
          ), ((err, str) ->
            throw err  if err
            str.getItems 0, 20, this
          ), callback

        "it's empty": (err, activities) ->
          assert.ifError err
          assert.isEmpty activities

      "and we check their major outbox":
        topic: (user, activity) ->
          callback = @callback
          Step (->
            user.getMajorOutboxStream this
          ), ((err, str) ->
            throw err  if err
            str.getItems 0, 20, this
          ), callback

        "it's empty": (err, activities) ->
          assert.ifError err
          assert.isEmpty activities

      "and we check their minor inbox":
        topic: (user, activity) ->
          callback = @callback
          Step (->
            user.getMinorInboxStream this
          ), ((err, str) ->
            throw err  if err
            str.getItems 0, 20, this
          ), (err, activities) ->
            if err
              callback err, null, null
            else
              callback err, activity, activities


        "it's in there": (err, activity, activities) ->
          assert.ifError err
          assert.isArray activities
          assert.lengthOf activities, 1
          assert.equal activities[0], activity.id

      "and we check their minor outbox":
        topic: (user, activity) ->
          callback = @callback
          Step (->
            user.getMinorOutboxStream this
          ), ((err, str) ->
            throw err  if err
            str.getItems 0, 20, this
          ), (err, activities) ->
            if err
              callback err, null, null
            else
              callback err, activity, activities


        "it's in there": (err, activity, activities) ->
          assert.ifError err
          assert.isArray activities
          assert.lengthOf activities, 1
          assert.equal activities[0], activity.id

suite["export"] module
