# user-favorite-test.js
#
# Test the user favoriting mechanism
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
a2m = (arr, prop) ->
  i = undefined
  map = {}
  key = undefined
  value = undefined
  i = 0
  while i < arr.length
    value = arr[i]
    key = value[prop]
    map[key] = value
    i++
  map

suite = vows.describe("user favorite interface")
suite.addBatch "When we get the User class":
  topic: ->
    cb = @callback
    
    # Need this to make IDs
    URLMaker.hostname = "example.net"
    
    # Dummy databank
    params = schema: schema
    db = Databank.get("memory", params)
    db.connect {}, (err) ->
      User = undefined
      DatabankObject.bank = db
      User = require("../lib/model/user").User or null
      cb null, User


  "it exists": (User) ->
    assert.isFunction User

  "and we create a user":
    topic: (User) ->
      props =
        nickname: "bert"
        password: "pidgeons"

      User.create props, @callback

    teardown: (user) ->
      if user and user.del
        user.del (err) ->


    "it works": (user) ->
      assert.isObject user

    "and it favorites a known object":
      topic: (user) ->
        cb = @callback
        Image = require("../lib/model/image").Image
        obj = undefined
        Step (->
          Image.create
            displayName: "Courage Wolf"
            url: "http://i0.kym-cdn.com/photos/images/newsfeed/000/159/986/Couragewolf1.jpg"
          , this
        ), ((err, image) ->
          throw err  if err
          obj = image
          user.favorite image.id, image.objectType, this
        ), (err) ->
          if err
            cb err, null
          else
            cb err, obj


      "it works": (err, image) ->
        assert.ifError err

      "and it unfavorites that object":
        topic: (image, user) ->
          user.unfavorite image.id, image.objectType, @callback

        "it works": (err) ->
          assert.ifError err

    "and it favorites an unknown object":
      topic: (user) ->
        cb = @callback
        user.favorite "urn:uuid:5be685ef-f50b-458b-bfd3-3ca004eb0e89", "image", @callback

      "it works": (err) ->
        assert.ifError err

      "and it unfavorites that object":
        topic: (user) ->
          user.unfavorite "urn:uuid:5be685ef-f50b-458b-bfd3-3ca004eb0e89", "image", @callback

        "it works": (err) ->
          assert.ifError err

    "and it double-favorites an object":
      topic: (user) ->
        cb = @callback
        Video = require("../lib/model/video").Video
        obj = undefined
        Step (->
          Video.create
            displayName: "Winning"
            url: "http://www.youtube.com/watch?v=9QS0q3mGPGg"
          , this
        ), ((err, video) ->
          throw err  if err
          obj = video
          user.favorite obj.id, obj.objectType, this
        ), ((err) ->
          throw err  if err
          user.favorite obj.id, obj.objectType, this
        ), (err) ->
          if err
            cb null
          else
            cb new Error("Unexpected success")


      "it fails correctly": (err) ->
        assert.ifError err

    "and it unfavorites an object it never favorited":
      topic: (user) ->
        cb = @callback
        Audio = require("../lib/model/audio").Audio
        obj = undefined
        Step (->
          Audio.create
            displayName: "Spock"
            url: "http://musicbrainz.org/recording/c1038685-49f3-45d7-bb26-1372f1052126"
          , this
        ), ((err, video) ->
          throw err  if err
          obj = video
          user.unfavorite obj.id, obj.objectType, this
        ), (err) ->
          if err
            cb null
          else
            cb new Error("Unexpected success")


      "it fails correctly": (err) ->
        assert.ifError err

  "and we get the list of favorites for a new user":
    topic: (User) ->
      cb = @callback
      props =
        nickname: "carroway"
        password: "feldspar"

      Step (->
        User.create props, this
      ), ((err, user) ->
        throw err  if err
        user.getFavorites 0, 20, this
      ), (err, faves) ->
        if err
          cb err, null
        else
          cb null, faves


    "it works": (err, faves) ->
      assert.ifError err

    "it looks right": (err, faves) ->
      assert.ifError err
      assert.isArray faves
      assert.lengthOf faves, 0

  "and we get the count of favorites for a new user":
    topic: (User) ->
      cb = @callback
      props =
        nickname: "cookie"
        password: "cookie"

      Step (->
        User.create props, this
      ), ((err, user) ->
        throw err  if err
        user.favoritesCount this
      ), (err, count) ->
        if err
          cb err, null
        else
          cb null, count


    "it works": (err, count) ->
      assert.ifError err

    "it looks right": (err, count) ->
      assert.ifError err
      assert.equal count, 0

  "and a new user favors an object":
    topic: (User) ->
      cb = @callback
      user = undefined
      image = undefined
      Step (->
        User.create
          nickname: "ernie"
          password: "rubberduckie"
        , this
      ), ((err, results) ->
        Image = require("../lib/model/image").Image
        throw err  if err
        user = results
        Image.create
          displayName: "Evan's avatar"
          url: "https://c778552.ssl.cf2.rackcdn.com/evan/1-96-20120103014637.jpeg"
        , this
      ), ((err, results) ->
        throw err  if err
        image = results
        user.favorite image.id, image.objectType, this
      ), (err) ->
        if err
          cb err, null, null
        else
          cb null, user, image


    "it works": (err, user, image) ->
      assert.ifError err
      assert.isObject user
      assert.isObject image

    "and we check the user favorites list":
      topic: (user, image) ->
        cb = @callback
        user.getFavorites 0, 20, (err, faves) ->
          cb err, faves, image


      "it works": (err, faves, image) ->
        assert.ifError err

      "it is the right size": (err, faves, image) ->
        assert.ifError err
        assert.lengthOf faves, 1

      "it has the right data": (err, faves, image) ->
        assert.ifError err
        assert.equal faves[0].id, image.id

    "and we check the user favorites count":
      topic: (user, image) ->
        cb = @callback
        user.favoritesCount cb

      "it works": (err, count) ->
        assert.ifError err

      "it is correct": (err, count) ->
        assert.ifError err
        assert.equal count, 1

    "and we check the image favoriters list":
      topic: (user, image) ->
        cb = @callback
        image.getFavoriters 0, 20, (err, favers) ->
          cb err, favers, user


      "it works": (err, favers, user) ->
        assert.ifError err

      "it is the right size": (err, favers, user) ->
        assert.ifError err
        assert.lengthOf favers, 1

      "it has the right data": (err, favers, user) ->
        assert.ifError err
        assert.equal favers[0].id, user.profile.id

    "and we check the image favoriters count":
      topic: (user, image) ->
        cb = @callback
        image.favoritersCount cb

      "it works": (err, count) ->
        assert.ifError err

      "it is correct": (err, count) ->
        assert.ifError err
        assert.equal count, 1

  "and a new user favors a lot of objects":
    topic: (User) ->
      cb = @callback
      user = undefined
      images = undefined
      Step (->
        User.create
          nickname: "count"
          password: "123456"
        , this
      ), ((err, results) ->
        Image = require("../lib/model/image").Image
        i = 0
        group = @group()
        throw err  if err
        user = results
        i = 0
        while i < 5000
          Image.create
            displayName: "Image for #" + i
            increment: i
            url: "http://" + i + ".jpg.to"
          , group()
          i++
      ), ((err, results) ->
        i = 0
        group = @group()
        throw err  if err
        images = results
        i = 0
        while i < images.length
          user.favorite images[i].id, "image", group()
          i++
      ), (err) ->
        if err
          cb err, null, null
        else
          cb null, user, images


    "it works": (err, user, images) ->
      assert.ifError err
      assert.isObject user
      assert.isArray images
      assert.lengthOf images, 5000
      i = 0

      while i < images.length
        assert.isObject images[i]
        i++

    "and we check the user favorites list":
      topic: (user, images) ->
        cb = @callback
        user.getFavorites 0, 5001, (err, faves) ->
          cb err, faves, images


      "it works": (err, faves, images) ->
        assert.ifError err

      "it is the right size": (err, faves, images) ->
        assert.ifError err
        assert.lengthOf faves, 5000

      "it has the right data": (err, faves, images) ->
        fm = undefined
        im = undefined
        id = undefined
        assert.ifError err
        fm = a2m(faves, "id")
        im = a2m(images, "id")
        for id of im
          assert.include fm, id
        for id of fm
          assert.include im, id

    "and we check the user favorites count":
      topic: (user, image) ->
        cb = @callback
        user.favoritesCount cb

      "it works": (err, count) ->
        assert.ifError err

      "it is correct": (err, count) ->
        assert.ifError err
        assert.equal count, 5000

    "and we check the images favoriters list":
      topic: (user, images) ->
        cb = @callback
        Step (->
          i = undefined
          group = @group()
          i = 0
          while i < images.length
            images[i].getFavoriters 0, 20, group()
            i++
        ), (err, faverses) ->
          if err
            cb err, null, null
          else
            cb null, faverses, user


      "it works": (err, faverses, user) ->
        assert.ifError err

      "it is the right size": (err, faverses, user) ->
        assert.ifError err
        assert.lengthOf faverses, 5000
        i = 0

        while i < faverses.length
          assert.lengthOf faverses[i], 1
          i++

      "it has the right data": (err, faverses, user) ->
        assert.ifError err
        i = 0

        while i < faverses.length
          assert.equal faverses[i][0].id, user.profile.id
          i++

suite["export"] module
