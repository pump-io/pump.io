# filteredstream-test.js
#
# Test the filteredstream module
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
schema = require("../lib/schema").schema
URLMaker = require("../lib/urlmaker").URLMaker
Stream = require("../lib/model/stream").Stream
Activity = require("../lib/model/activity").Activity
Databank = databank.Databank
DatabankObject = databank.DatabankObject
suite = vows.describe("filtered stream interface")
suite.addBatch "When we set up the environment":
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

  "and we load the filteredstream module":
    topic: ->
      require "../lib/filteredstream"

    "it works": (mod) ->
      assert.isObject mod

    "and we get the FilteredStream class":
      topic: (mod) ->
        mod.FilteredStream

      "it works": (FilteredStream) ->
        assert.isFunction FilteredStream

      "and we create a stream with lots of activities":
        topic: (FilteredStream) ->
          callback = @callback
          str = undefined
          places = [
            displayName: "Montreal"
            id: "http://www.geonames.org/6077243/montreal.html"
          ,
            displayName: "San Francisco"
            id: "http://www.geonames.org/5391959/san-francisco.html"
          ]
          sentences = ["Hello, world!", "Testing 1, 2, 3.", "Now is the time for all good men to come to the aid of the party."]
          actorIds = ["8d75183c-e74c-11e1-8115-70f1a154e1aa", "8d7589a2-e74c-11e1-b7e1-70f1a154e1aa", "8d75f4fa-e74c-11e1-8cbe-70f1a154e1aa", "8d764306-e74c-11e1-848f-70f1a154e1aa", "8d76ad0a-e74c-11e1-b1bc-70f1a154e1aa"]
          moods = ["happy", "sad", "frightened", "mad", "excited", "glad", "bored"]
          tags = ["ggi", "winning", "justsayin", "ows", "sep17", "jan25", "egypt", "fail", "tigerblood", "bitcoin", "fsw"]
          total = undefined
          total = places.length * sentences.length * actorIds.length * moods.length * tags.length
          Step (->
            Stream.create
              name: "test"
            , this
          ), ((err, result) ->
            i = undefined
            act = undefined
            group = @group()
            throw err  if err
            str = result
            i = 0
            while i < total
              act =
                actor:
                  objectType: "person"
                  displayName: "Anonymous"
                  id: actorIds[i % actorIds.length]

                verb: "post"
                object:
                  objectType: "note"
                  content: sentences[i % sentences.length] + " #" + tags[i % tags.length]
                  tags: [
                    objectType: "http://activityschema.org/object/hashtag"
                    displayName: tags[i % tags.length]
                  ]

                location: places[i % places.length]
                mood:
                  displayName: moods[i % moods.length]

              Activity.create act, group()
              i++
          ), ((err, acts) ->
            i = undefined
            group = @group()
            throw err  if err
            i = 0
            while i < acts.length
              str.deliver acts[i].id, group()
              i++
          ), (err) ->
            if err
              callback err, null
            else
              callback null, str


        "it works": (err, str) ->
          assert.ifError err
          assert.isObject str
          assert.instanceOf str, Stream

        "and we add a filter by mood":
          topic: (str, FilteredStream) ->
            byMood = (mood) ->
              (id, callback) ->
                Step (->
                  Activity.get id, this
                ), (err, act) ->
                  if err
                    callback err, null
                  else if act.mood.displayName is mood
                    callback null, true
                  else
                    callback null, false


            new FilteredStream(str, byMood("happy"))

          "it works": (fs) ->
            assert.isObject fs

          "it has a getIDs() method": (fs) ->
            assert.isFunction fs.getIDs

          "it has a getIDsGreaterThan() method": (fs) ->
            assert.isFunction fs.getIDsGreaterThan

          "it has a getIDsLessThan() method": (fs) ->
            assert.isFunction fs.getIDsLessThan

          "it has a count() method": (fs) ->
            assert.isFunction fs.count

          "and we get the filtered stream's count":
            topic: (fs) ->
              fs.count @callback

            "it works": (err, cnt) ->
              assert.ifError err

            "it has the value of the full stream": (err, cnt) ->
              assert.ifError err
              assert.equal cnt, 2310

          "and we get the full stream by 20-item chunks":
            topic: (fs) ->
              Step (->
                i = undefined
                group = @group()
                i = 0
                while i < 17
                  fs.getIDs i * 20, (i + 1) * 20, group()
                  i++
              ), @callback

            "it works": (err, chunks) ->
              assert.ifError err
              assert.isArray chunks

            "data looks correct": (err, chunks) ->
              i = undefined
              j = undefined
              seen = {}
              assert.ifError err
              assert.isArray chunks
              assert.lengthOf chunks, 17
              i = 0
              while i < chunks.length
                assert.isArray chunks[i]
                if i is 16
                  
                  # total == 330, last is only 10
                  assert.lengthOf chunks[i], 10
                else
                  assert.lengthOf chunks[i], 20
                j = 0
                while j < chunks[i].length
                  assert.isString chunks[i][j]
                  assert.isUndefined seen[chunks[i][j]]
                  seen[chunks[i][j]] = 1
                  j++
                i++

          "and we get the IDs less than some middle value":
            topic: (fs) ->
              orig = undefined
              cb = @callback
              Step (->
                fs.getIDs 100, 150, this
              ), ((err, ids) ->
                throw err  if err
                orig = ids.slice(10, 30)
                fs.getIDsLessThan ids[30], 20, this
              ), (err, ids) ->
                if err
                  cb err, ids
                else
                  cb null, orig, ids


            "it works": (err, orig, ids) ->
              assert.ifError err
              assert.isArray orig
              assert.isArray ids

            "data looks correct": (err, orig, ids) ->
              assert.ifError err
              assert.isArray orig
              assert.isArray ids
              assert.deepEqual orig, ids

          "and we get the IDs less than some value close to the start":
            topic: (fs) ->
              orig = undefined
              cb = @callback
              Step (->
                fs.getIDs 0, 20, this
              ), ((err, ids) ->
                throw err  if err
                orig = ids.slice(0, 5)
                fs.getIDsLessThan ids[5], 20, this
              ), (err, ids) ->
                if err
                  cb err, ids
                else
                  cb null, orig, ids


            "it works": (err, orig, ids) ->
              assert.ifError err
              assert.isArray orig
              assert.isArray ids

            "data looks correct": (err, orig, ids) ->
              assert.ifError err
              assert.isArray orig
              assert.isArray ids
              assert.deepEqual orig, ids

          "and we get the IDs greater than some middle value":
            topic: (fs) ->
              orig = undefined
              cb = @callback
              Step (->
                fs.getIDs 200, 250, this
              ), ((err, ids) ->
                throw err  if err
                orig = ids.slice(20, 40)
                fs.getIDsGreaterThan ids[19], 20, this
              ), (err, ids) ->
                if err
                  cb err, ids
                else
                  cb null, orig, ids


            "it works": (err, orig, ids) ->
              assert.ifError err
              assert.isArray orig
              assert.isArray ids

            "data looks correct": (err, orig, ids) ->
              assert.ifError err
              assert.isArray orig
              assert.isArray ids
              assert.deepEqual orig, ids

          "and we get the IDs greater than some value close to the end":
            topic: (fs) ->
              orig = undefined
              cb = @callback
              Step (->
                fs.getIDs 319, 330, this
              ), ((err, ids) ->
                throw err  if err
                orig = ids.slice(1, 11)
                fs.getIDsGreaterThan ids[0], 20, this
              ), (err, ids) ->
                if err
                  cb err, ids
                else
                  cb null, orig, ids


            "it works": (err, orig, ids) ->
              assert.ifError err
              assert.isArray orig
              assert.isArray ids

            "data looks correct": (err, orig, ids) ->
              assert.ifError err
              assert.isArray orig
              assert.isArray ids
              assert.deepEqual orig, ids

suite["export"] module
