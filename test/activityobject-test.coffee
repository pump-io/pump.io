# activityobject-test.js
#
# Test the activityobject module's class methods
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
Step = require("step")
_ = require("underscore")
Databank = databank.Databank
DatabankObject = databank.DatabankObject
schema = require("../lib/schema").schema
URLMaker = require("../lib/urlmaker").URLMaker
suite = vows.describe("activityobject class interface")
suite.addBatch "When we require the activityobject module":
  topic: ->
    cb = @callback
    
    # Need this to make IDs
    URLMaker.hostname = "example.net"
    
    # Dummy databank
    params = schema: schema
    db = Databank.get("memory", params)
    db.connect {}, (err) ->
      mod = undefined
      DatabankObject.bank = db
      mod = require("../lib/model/activityobject") or null
      cb null, mod


  "we get a module": (mod) ->
    assert.isObject mod

  "and we get its UnknownTypeError member":
    topic: (mod) ->
      mod.UnknownTypeError

    "it exists": (ActivityObject) ->
      assert.isFunction ActivityObject

  "and we get its ActivityObject member":
    topic: (mod) ->
      mod.ActivityObject

    "it exists": (ActivityObject) ->
      assert.isFunction ActivityObject

    "it has a makeURI member": (ActivityObject) ->
      assert.isFunction ActivityObject.makeURI

    "it has a toClass member": (ActivityObject) ->
      assert.isFunction ActivityObject.toClass

    "it has a toObject member": (ActivityObject) ->
      assert.isFunction ActivityObject.toObject

    "it has a getObject member": (ActivityObject) ->
      assert.isFunction ActivityObject.getObject

    "it has a createObject member": (ActivityObject) ->
      assert.isFunction ActivityObject.createObject

    "it has an ensureObject member": (ActivityObject) ->
      assert.isFunction ActivityObject.ensureObject

    "it has a compressProperty member": (ActivityObject) ->
      assert.isFunction ActivityObject.compressProperty

    "it has an expandProperty member": (ActivityObject) ->
      assert.isFunction ActivityObject.expandProperty

    "it has a getObjectStream member": (ActivityObject) ->
      assert.isFunction ActivityObject.getObjectStream

    "it has a sameID member": (ActivityObject) ->
      assert.isFunction ActivityObject.sameID

    "it has a canonicalID member": (ActivityObject) ->
      assert.isFunction ActivityObject.canonicalID

    "it has an objectTypes member": (ActivityObject) ->
      assert.isArray ActivityObject.objectTypes

    "it has constant-ish members for known types": (ActivityObject) ->
      assert.equal ActivityObject.ALERT, "alert"
      assert.equal ActivityObject.APPLICATION, "application"
      assert.equal ActivityObject.ARTICLE, "article"
      assert.equal ActivityObject.AUDIO, "audio"
      assert.equal ActivityObject.BADGE, "badge"
      assert.equal ActivityObject.BINARY, "binary"
      assert.equal ActivityObject.BOOKMARK, "bookmark"
      assert.equal ActivityObject.COLLECTION, "collection"
      assert.equal ActivityObject.COMMENT, "comment"
      assert.equal ActivityObject.DEVICE, "device"
      assert.equal ActivityObject.EVENT, "event"
      assert.equal ActivityObject.FILE, "file"
      assert.equal ActivityObject.GAME, "game"
      assert.equal ActivityObject.GROUP, "group"
      assert.equal ActivityObject.IMAGE, "image"
      assert.equal ActivityObject.ISSUE, "issue"
      assert.equal ActivityObject.JOB, "job"
      assert.equal ActivityObject.NOTE, "note"
      assert.equal ActivityObject.OFFER, "offer"
      assert.equal ActivityObject.ORGANIZATION, "organization"
      assert.equal ActivityObject.PAGE, "page"
      assert.equal ActivityObject.PERSON, "person"
      assert.equal ActivityObject.PLACE, "place"
      assert.equal ActivityObject.PROCESS, "process"
      assert.equal ActivityObject.PRODUCT, "product"
      assert.equal ActivityObject.QUESTION, "question"
      assert.equal ActivityObject.REVIEW, "review"
      assert.equal ActivityObject.SERVICE, "service"
      assert.equal ActivityObject.TASK, "task"
      assert.equal ActivityObject.VIDEO, "video"

    "and we make a new URI":
      topic: (ActivityObject) ->
        ActivityObject.makeURI ActivityObject.AUDIO, "AAAAAAAAAAAAAAAAAAAAAAA"

      "it returns a string": (uri) ->
        assert.isString uri

    "and we get a class by typename":
      topic: (ActivityObject) ->
        ActivityObject.toClass ActivityObject.VIDEO

      "it returns the right one": (Video) ->
        assert.equal Video, require("../lib/model/video").Video

    "and we get an object by properties":
      topic: (ActivityObject) ->
        props =
          objectType: ActivityObject.REVIEW
          id: "http://example.org/reviews/1"
          content: "I hate your blog."

        ActivityObject.toObject props

      "it exists": (review) ->
        assert.isObject review

      "it is the right type": (review) ->
        assert.instanceOf review, require("../lib/model/review").Review

      "it has the right properties": (review) ->
        assert.equal review.objectType, "review"
        assert.equal review.id, "http://example.org/reviews/1"
        assert.equal review.content, "I hate your blog."

      "it has an expand() method": (review) ->
        assert.isFunction review.expand

      "it has a favoritedBy() method": (review) ->
        assert.isFunction review.favoritedBy

      "it has an unfavoritedBy() method": (review) ->
        assert.isFunction review.unfavoritedBy

      "it has a getFavoriters() method": (review) ->
        assert.isFunction review.getFavoriters

      "it has a favoritersCount() method": (review) ->
        assert.isFunction review.favoritersCount

      "it has an expandFeeds() method": (review) ->
        assert.isFunction review.expandFeeds

      "it has an efface() method": (review) ->
        assert.isFunction review.efface

    "and we get a non-activityobject model object by its properties":
      topic: (ActivityObject) ->
        props =
          objectType: "user"
          nickname: "evan"

        ActivityObject.toObject props

      "it fails": (client) ->
        assert.isObject client

    "and we create an activityobject object":
      topic: (ActivityObject) ->
        props =
          objectType: ActivityObject.ARTICLE
          content: "Blah blah blah."

        ActivityObject.createObject props, @callback

      teardown: (article) ->
        if article and article.del
          article.del (err) ->


      "it works": (err, article) ->
        assert.ifError err

      "it exists": (err, article) ->
        assert.isObject article

      "it has the right class": (err, article) ->
        assert.instanceOf article, require("../lib/model/article").Article

      "it has the right passed-in attributes": (err, article) ->
        assert.equal article.objectType, "article"
        assert.equal article.content, "Blah blah blah."

      "it has the right auto-created attributes": (err, article) ->
        assert.isString article.id
        assert.isString article.published
        assert.isString article.updated

      "and we get the same object":
        topic: (article, ActivityObject) ->
          ActivityObject.getObject ActivityObject.ARTICLE, article.id, @callback

        "it works": (err, article) ->
          assert.ifError err

        "it exists": (err, article) ->
          assert.isObject article

        "it has the right class": (err, article) ->
          assert.instanceOf article, require("../lib/model/article").Article

        "it has the right passed-in attributes": (err, article) ->
          assert.equal article.objectType, "article"
          assert.equal article.content, "Blah blah blah."

        "it has the right auto-created attributes": (err, article) ->
          assert.isString article.id
          assert.isString article.published
          assert.isString article.updated

    "and we ensure a new activityobject object":
      topic: (ActivityObject) ->
        props =
          id: "urn:uuid:2b7cc63f-dd9a-438f-b6d3-846fee2634bf"
          objectType: ActivityObject.GROUP
          displayName: "ActivityPump Devs"

        ActivityObject.ensureObject props, @callback

      teardown: (group) ->
        if group and group.del
          group.del (err) ->


      "it works": (err, article) ->
        assert.ifError err

      "it exists": (err, group) ->
        assert.isObject group

      "it has the right class": (err, group) ->
        assert.instanceOf group, require("../lib/model/group").Group

      "it has the right passed-in attributes": (err, group) ->
        assert.equal group.objectType, "group"
        assert.equal group.displayName, "ActivityPump Devs"

      "it has the right auto-created attributes": (err, group) ->
        assert.isString group.id
        assert.isString group.published
        assert.isString group.updated

    "and we ensure an existing activityobject object":
      topic: (ActivityObject) ->
        cb = @callback
        Comment = require("../lib/model/comment").Comment
        props =
          objectType: ActivityObject.COMMENT
          content: "FIRST POST"
          inReplyTo:
            objectType: ActivityObject.ARTICLE
            id: "http://example.net/articles/3"

        Comment.create props, (err, comment) ->
          p = {}
          if err
            cb err, null
          else
            DatabankObject.copy p, comment
            ActivityObject.ensureObject p, cb


      teardown: (comment) ->
        if comment and comment.del
          comment.del (err) ->


      "it works": (err, comment) ->
        assert.ifError err

      "it exists": (err, comment) ->
        assert.isObject comment

      "it has the right class": (err, comment) ->
        assert.instanceOf comment, require("../lib/model/comment").Comment

      "it has the right passed-in attributes": (err, comment) ->
        assert.equal comment.objectType, "comment"
        assert.equal comment.content, "FIRST POST"
        assert.equal comment.inReplyTo.id, "http://example.net/articles/3"
        assert.equal comment.inReplyTo.objectType, "article"

      "it has the right auto-created attributes": (err, comment) ->
        assert.isString comment.id
        assert.isString comment.published
        assert.isString comment.updated

    "and we compress an existing object property of an object":
      topic: (ActivityObject) ->
        cb = @callback
        Image = require("../lib/model/image").Image
        Person = require("../lib/model/person").Person
        image = new Image(
          author:
            id: "urn:uuid:8a9d0e92-3210-4ea3-920f-3950ca8d5306"
            displayName: "Barney Miller"
            objectType: "person"

          url: "http://example.net/images/1.jpg"
        )
        ActivityObject.compressProperty image, "author", (err) ->
          if err
            cb err, null
          else
            cb null, image


      "it works": (err, image) ->
        assert.ifError err

      "the property is compressed": (err, image) ->
        assert.ifError err
        assert.include image, "author"
        assert.isObject image.author
        assert.instanceOf image.author, require("../lib/model/person").Person
        assert.include image.author, "id"
        assert.isString image.author.id
        assert.equal image.author.id, "urn:uuid:8a9d0e92-3210-4ea3-920f-3950ca8d5306"
        assert.include image.author, "objectType"
        assert.isString image.author.objectType
        assert.equal image.author.objectType, "person"
        assert.isFalse _(image.author).has("displayName")

    "and we compress a non-existent object property of an object":
      topic: (ActivityObject) ->
        cb = @callback
        Image = require("../lib/model/image").Image
        image = new Image(url: "http://example.net/images/2.jpg")
        ActivityObject.compressProperty image, "author", (err) ->
          if err
            cb err, null
          else
            cb null, image


      "it works": (err, image) ->
        assert.ifError err

      "the property remains non-existent": (err, image) ->
        assert.ifError err
        assert.isFalse _(image).has("author")

    "and we expand an existing object property of an object":
      topic: (ActivityObject) ->
        cb = @callback
        Image = require("../lib/model/image").Image
        Person = require("../lib/model/person").Person
        image = undefined
        Step (->
          Person.create
            id: "urn:uuid:bbd313d1-6f8d-4d72-bc05-bde69ba795d7"
            displayName: "Theo Kojak"
          , this
        ), ((err, person) ->
          throw err  if err
          image = new Image(
            url: "http://example.net/images/1.jpg"
            author:
              id: person.id
              objectType: "person"
          )
          ActivityObject.expandProperty image, "author", this
        ), (err) ->
          if err
            cb err, null
          else
            cb null, image


      "it works": (err, image) ->
        assert.ifError err

      "the property is expanded": (err, image) ->
        assert.ifError err
        assert.include image, "author"
        assert.isObject image.author
        assert.instanceOf image.author, require("../lib/model/person").Person
        assert.include image.author, "id"
        assert.isString image.author.id
        assert.equal image.author.id, "urn:uuid:bbd313d1-6f8d-4d72-bc05-bde69ba795d7"
        assert.include image.author, "objectType"
        assert.isString image.author.objectType
        assert.equal image.author.objectType, "person"
        assert.include image.author, "displayName"
        assert.isString image.author.displayName
        assert.equal image.author.displayName, "Theo Kojak"

    "and we expand a non-existent object property of an object":
      topic: (ActivityObject) ->
        cb = @callback
        Image = require("../lib/model/image").Image
        image = new Image(url: "http://example.net/images/4.jpg")
        ActivityObject.expandProperty image, "author", (err) ->
          if err
            cb err, null
          else
            cb null, image


      "it works": (err, image) ->
        assert.ifError err

      "the property remains non-existent": (err, image) ->
        assert.ifError err
        assert.isFalse _(image).has("author")

    "and we compress a scalar property of an object":
      topic: (ActivityObject) ->
        cb = @callback
        Image = require("../lib/model/image").Image
        image = new Image(url: "http://example.net/images/5.jpg")
        ActivityObject.compressProperty image, "url", (err) ->
          if err
            cb null, image
          else
            cb new Error("Unexpected success"), null


      "it fails correctly": (err, image) ->
        assert.ifError err

      "the property remains non-existent": (err, image) ->
        assert.ifError err
        assert.isString image.url
        assert.equal image.url, "http://example.net/images/5.jpg"

    "and we expand a scalar property of an object":
      topic: (ActivityObject) ->
        cb = @callback
        Image = require("../lib/model/image").Image
        image = new Image(url: "http://example.net/images/6.jpg")
        ActivityObject.expandProperty image, "url", (err) ->
          if err
            cb null, image
          else
            cb new Error("Unexpected success"), null


      "it fails correctly": (err, image) ->
        assert.ifError err

      "the property remains non-existent": (err, image) ->
        assert.ifError err
        assert.isString image.url
        assert.equal image.url, "http://example.net/images/6.jpg"

    "and we create an activityobject with an author":
      topic: (ActivityObject) ->
        cb = @callback
        Note = require("../lib/model/note").Note
        Person = require("../lib/model/person").Person
        props =
          objectType: ActivityObject.NOTE
          content: "HELLO WORLD"

        author = undefined
        Step (->
          Person.create
            displayName: "peter"
            preferredUsername: "p65"
          , this
        ), ((err, person) ->
          throw err  if err
          author = props.author = person
          Note.create props, this
        ), (err, note) ->
          cb err, note, author


      "it works": (err, object, author) ->
        assert.ifError err
        assert.isObject object

      "results contain the author information": (err, object, author) ->
        assert.ifError err
        assert.isObject object.author
        assert.equal object.author.id, author.id
        assert.equal object.author.objectType, author.objectType
        assert.equal object.author.displayName, author.displayName
        assert.equal object.author.preferredUsername, author.preferredUsername

    "and we create an activityobject with an author reference":
      topic: (ActivityObject) ->
        cb = @callback
        Note = require("../lib/model/note").Note
        Person = require("../lib/model/person").Person
        props =
          objectType: ActivityObject.NOTE
          content: "HELLO WORLD"

        author = undefined
        Step (->
          Person.create
            displayName: "quincy"
            preferredUsername: "qbert"
          , this
        ), ((err, person) ->
          throw err  if err
          author = person
          props.author =
            id: person.id
            objectType: person.objectType

          Note.create props, this
        ), (err, note) ->
          cb err, note, author


      "it works": (err, object, author) ->
        assert.ifError err
        assert.isObject object

      "results contain the author information": (err, object, author) ->
        assert.ifError err
        assert.isObject object.author
        assert.equal object.author.id, author.id
        assert.equal object.author.objectType, author.objectType
        assert.equal object.author.displayName, author.displayName
        assert.equal object.author.preferredUsername, author.preferredUsername

    "and we update an activityobject with an author":
      topic: (ActivityObject) ->
        cb = @callback
        Note = require("../lib/model/note").Note
        Person = require("../lib/model/person").Person
        props =
          objectType: ActivityObject.NOTE
          content: "HELLO WORLD"

        author = undefined
        Step (->
          Person.create
            displayName: "randy"
            preferredUsername: "rman99"
          , this
        ), ((err, person) ->
          throw err  if err
          author = person
          props.author = person
          Note.create props, this
        ), ((err, note) ->
          throw err  if err
          note.update
            summary: "A helpful greeting"
          , this
        ), (err, note) ->
          cb err, note, author


      "it works": (err, object, author) ->
        assert.ifError err
        assert.isObject object

      "results contain the author information": (err, object, author) ->
        assert.ifError err
        assert.isObject object.author
        assert.equal object.author.id, author.id
        assert.equal object.author.objectType, author.objectType
        assert.equal object.author.displayName, author.displayName
        assert.equal object.author.preferredUsername, author.preferredUsername

    "and we update an activityobject with an author reference":
      topic: (ActivityObject) ->
        cb = @callback
        Note = require("../lib/model/note").Note
        Person = require("../lib/model/person").Person
        props =
          objectType: ActivityObject.NOTE
          content: "HELLO WORLD"

        author = undefined
        Step (->
          Person.create
            displayName: "steven"
            preferredUsername: "billabong"
          , this
        ), ((err, person) ->
          throw err  if err
          author = person
          props.author = person
          Note.create props, this
        ), ((err, note) ->
          throw err  if err
          note.author =
            id: note.author.id
            objectType: note.author.objectType

          note.update
            summary: "A helpful greeting"
          , this
        ), (err, note) ->
          cb err, note, author


      "it works": (err, object, author) ->
        assert.ifError err
        assert.isObject object

      "results contain the author information": (err, object, author) ->
        assert.ifError err
        assert.isObject object.author
        assert.equal object.author.id, author.id
        assert.equal object.author.objectType, author.objectType
        assert.equal object.author.displayName, author.displayName
        assert.equal object.author.preferredUsername, author.preferredUsername

    "and we get a non-existent stream of objects":
      topic: (ActivityObject) ->
        ActivityObject.getObjectStream "person", "nonexistent", 0, 20, @callback

      "it works": (err, objects) ->
        assert.ifError err

      "it returns an empty array": (err, objects) ->
        assert.ifError err
        assert.isArray objects
        assert.lengthOf objects, 0

    "and we get an empty object stream":
      topic: (ActivityObject) ->
        cb = @callback
        Stream = require("../lib/model/stream").Stream
        Step (->
          Stream.create
            name: "activityobject-test-1"
          , this
        ), (err, stream) ->
          throw err  if err
          ActivityObject.getObjectStream "person", "activityobject-test-1", 0, 20, cb


      "it works": (err, objects) ->
        assert.ifError err

      "it returns an empty array": (err, objects) ->
        assert.ifError err
        assert.isArray objects
        assert.lengthOf objects, 0

    "and we get an object stream with stuff in it":
      topic: (ActivityObject) ->
        cb = @callback
        Stream = require("../lib/model/stream").Stream
        Service = require("../lib/model/service").Service
        stream = undefined
        Step (->
          Stream.create
            name: "activityobject-test-2"
          , this
        ), ((err, results) ->
          i = undefined
          group = @group()
          throw err  if err
          stream = results
          i = 0
          while i < 100
            Service.create
              displayName: "Service #" + i
            , group()
            i++
        ), ((err, services) ->
          i = undefined
          group = @group()
          throw err  if err
          i = 0
          while i < 100
            stream.deliver services[i].id, group()
            i++
        ), (err) ->
          throw err  if err
          ActivityObject.getObjectStream "service", "activityobject-test-2", 0, 20, cb


      "it works": (err, objects) ->
        assert.ifError err

      "it returns a non-empty array": (err, objects) ->
        assert.ifError err
        assert.isArray objects
        assert.lengthOf objects, 20

      "members are the correct type": (err, objects) ->
        Service = require("../lib/model/service").Service
        assert.ifError err
        i = 0

        while i < objects.length
          assert.isObject objects[i]
          assert.instanceOf objects[i], Service
          i++

    "and we get the favoriters of a brand-new object":
      topic: (ActivityObject) ->
        cb = @callback
        Place = require("../lib/model/place").Place
        Step (->
          Place.create
            displayName: "Mount Everest"
            position: "+27.5916+086.5640+8850/"
          , this
        ), ((err, place) ->
          throw err  if err
          place.getFavoriters 0, 20, this
        ), (err, favers) ->
          if err
            cb err, null
          else
            cb null, favers


      "it works": (err, objects) ->
        assert.ifError err

      "it returns an empty array": (err, objects) ->
        assert.ifError err
        assert.isArray objects
        assert.lengthOf objects, 0

    "and we get the favoriters count of a brand-new object":
      topic: (ActivityObject) ->
        cb = @callback
        Place = require("../lib/model/place").Place
        Step (->
          Place.create
            displayName: "South Pole"
            position: "-90.0000+0.0000/"
          , this
        ), ((err, place) ->
          throw err  if err
          place.favoritersCount this
        ), (err, count) ->
          if err
            cb err, null
          else
            cb null, count


      "it works": (err, count) ->
        assert.ifError err

      "it returns zero": (err, count) ->
        assert.ifError err
        assert.equal count, 0

    "and we add a favoriter for an object":
      topic: (ActivityObject) ->
        cb = @callback
        Place = require("../lib/model/place").Place
        Person = require("../lib/model/person").Person
        place = null
        person = null
        Step (->
          Place.create
            displayName: "North Pole"
            position: "+90.0000+0.0000/"
          , @parallel()
          Person.create
            displayName: "Robert Peary"
          , @parallel()
        ), ((err, results1, results2) ->
          throw err  if err
          place = results1
          person = results2
          place.favoritedBy person.id, this
        ), (err) ->
          if err
            cb err, null, null
          else
            cb null, place, person


      "it worked": (err, place, person) ->
        assert.ifError err

      "and we get its favoriters list":
        topic: (place, person) ->
          cb = @callback
          place.getFavoriters 0, 20, (err, favers) ->
            cb err, favers, person


        "it worked": (err, favers, person) ->
          assert.ifError err

        "it is the right size": (err, favers, person) ->
          assert.ifError err
          assert.isArray favers
          assert.lengthOf favers, 1

        "it contains our data": (err, favers, person) ->
          assert.ifError err
          assert.equal favers[0].id, person.id

      "and we get its favoriters count":
        topic: (place, person) ->
          place.favoritersCount @callback

        "it works": (err, count) ->
          assert.ifError err

        "it returns one": (err, count) ->
          assert.ifError err
          assert.equal count, 1

    "and we add then remove a favoriter for an object":
      topic: (ActivityObject) ->
        cb = @callback
        Place = require("../lib/model/place").Place
        Person = require("../lib/model/person").Person
        place = null
        person = null
        Step (->
          Place.create
            displayName: "Montreal"
            position: "+45.5124-73.5547/"
          , @parallel()
          Person.create
            displayName: "Evan Prodromou"
          , @parallel()
        ), ((err, results1, results2) ->
          throw err  if err
          place = results1
          person = results2
          place.favoritedBy person.id, this
        ), ((err) ->
          throw err  if err
          place.unfavoritedBy person.id, this
        ), (err) ->
          if err
            cb err, null, null
          else
            cb null, place, person


      "and we get its favoriters list":
        topic: (place, person) ->
          cb = @callback
          place.getFavoriters 0, 20, (err, favers) ->
            cb err, favers, person


        "it worked": (err, favers, person) ->
          assert.ifError err

        "it is the right size": (err, favers, person) ->
          assert.ifError err
          assert.isArray favers
          assert.lengthOf favers, 0

      "and we get its favoriters count":
        topic: (place, person) ->
          place.favoritersCount @callback

        "it works": (err, count) ->
          assert.ifError err

        "it returns zero": (err, count) ->
          assert.ifError err
          assert.equal count, 0

    "and we expand the feeds for an object":
      topic: (ActivityObject) ->
        cb = @callback
        Place = require("../lib/model/place").Place
        place = null
        Step (->
          Place.create
            displayName: "San Francisco"
            position: "+37.7771-122.4196/"
          , this
        ), ((err, results) ->
          throw err  if err
          place = results
          place.expandFeeds this
        ), (err) ->
          if err
            cb err, null
          else
            cb null, place


      "it works": (err, place) ->
        assert.ifError err

      "it adds the 'likes' property": (err, place) ->
        assert.ifError err
        assert.includes place, "likes"
        assert.isObject place.likes
        assert.includes place.likes, "totalItems"
        assert.equal place.likes.totalItems, 0
        assert.includes place.likes, "url"
        assert.isString place.likes.url

    "and we create then efface an object":
      topic: (ActivityObject) ->
        cb = @callback
        Comment = require("../lib/model/comment").Comment
        comment = undefined
        Step (->
          props =
            author:
              id: "mailto:evan@status.net"
              objectType: "person"

            inReplyTo:
              url: "http://scripting.com/stories/2012/07/25/anOpenTwitterlikeEcosystem.html"
              objectType: "article"

            content: "Right on, Dave."

          Comment.create props, this
        ), ((err, results) ->
          throw err  if err
          comment = results
          comment.efface this
        ), (err) ->
          if err
            cb err, null
          else
            cb null, comment


      "it works": (err, comment) ->
        assert.ifError err

      "it looks right": (err, comment) ->
        assert.ifError err
        assert.ok comment.id
        assert.ok comment.objectType
        assert.ok comment.author
        assert.ok comment.inReplyTo
        assert.ok comment.published
        assert.ok comment.updated
        assert.ok comment.deleted
        assert.isUndefined comment.content

    "and we canonicalize an http: ID":
      topic: (ActivityObject) ->
        ActivityObject.canonicalID "http://social.example/user/1"

      "it is unchanged": (id) ->
        assert.equal id, "http://social.example/user/1"

    "and we canonicalize an https: ID":
      topic: (ActivityObject) ->
        ActivityObject.canonicalID "https://photo.example/user/1"

      "it is unchanged": (id) ->
        assert.equal id, "https://photo.example/user/1"

    "and we canonicalize an acct: ID":
      topic: (ActivityObject) ->
        ActivityObject.canonicalID "acct:user@checkin.example"

      "it is unchanged": (id) ->
        assert.equal id, "acct:user@checkin.example"

    "and we canonicalize a bare Webfinger":
      topic: (ActivityObject) ->
        ActivityObject.canonicalID "user@checkin.example"

      "it is unchanged": (id) ->
        assert.equal id, "acct:user@checkin.example"

    "and we compare an acct: URI and a bare Webfinger":
      topic: (ActivityObject) ->
        ActivityObject.sameID "acct:user@checkin.example", "user@checkin.example"

      "it is a match": (res) ->
        assert.isTrue res

suite["export"] module
