// activity-content-test.js
//
// Test the content generation for an activity
//
// Copyright 2012-2013, E14N https://e14n.com/
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    _ = require("lodash"),
    fs = require("fs"),
    path = require("path"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    schema = require("../lib/schema").schema,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("activity module content generation");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var contentCheck = function(actor, verb, object, expected) {
    return {
        topic: function(Activity) {
            var callback = this.callback,
                Collection = require("../lib/model/collection").Collection,
                thePublic = {
                    objectType: "collection",
                    id: Collection.PUBLIC
                },
                act = new Activity({actor: actor,
                                    to: [thePublic],
                                    verb: verb,
                                    object: object});

            Step(
                function() {
                    // First, ensure recipients
                    act.ensureRecipients(this);
                },
                function(err) {
                    if (err) throw err;
                    // Then, apply the activity
                    act.apply(null, this);
                },
                function(err) {
                    if (err) throw err;
                    // Then, save the activity
                    act.save(this);
                },
                function(err, saved) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, act);
                    }
                }
            );
        },
        "it works": function(err, act) {
            assert.ifError(err);
        },
        "content is correct": function(err, act) {
            assert.ifError(err);
            assert.include(act, "content");
            assert.isString(act.content);
            assert.equal(act.content, expected);
        }
    };
};

suite.addBatch({
    "When we get the Activity class": {
        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {

                var mod;

                if (err) {
                    cb(err, null);
                    return;
                }

                DatabankObject.bank = db;

                mod = require("../lib/model/activity");

                if (!mod) {
                    cb(new Error("No module"), null);
                    return;
                }

                cb(null, mod.Activity);
            });
        },
        "it works": function(err, Activity) {
            assert.ifError(err);
            assert.isFunction(Activity);
        },
        "and a person with no url posts a note":
        contentCheck({objectType: "person",
                      id: "urn:uuid:cbf1f0ca-2e10-11e2-8174-70f1a154e1aa",
                      displayName: "Jessie Belnap"},
                     "post",
                     {objectType: "note",
                      id: "urn:uuid:f4f859a0-2e10-11e2-9af6-70f1a154e1aa",
                      content: "Hello, world."},
                     "Jessie Belnap posted a note"),
        "and a person with an url posts a note":
        contentCheck({objectType: "person",
                      id: "urn:uuid:e67c969c-2e11-11e2-86dc-70f1a154e1aa",
                      url: "http://malloryfellman.example/",
                      displayName: "Mallory Fellman"},
                     "post",
                     {objectType: "note",
                      id: "urn:uuid:a453c0fa-2e12-11e2-9214-70f1a154e1aa",
                      content: "Hello, world."},
                     "<a href='http://malloryfellman.example/'>Mallory Fellman</a> posted a note"),
        "and a person with no url plays a video":
        contentCheck({objectType: "person",
                      id: "urn:uuid:6958bee6-2e13-11e2-be89-70f1a154e1aa",
                      displayName: "Mathew Penniman"},
                     "play",
                     {objectType: "video",
                      url: "http://www.youtube.com/watch?v=J---aiyznGQ",
                      displayName: "Keyboard Cat"},
                     "Mathew Penniman played <a href='http://www.youtube.com/watch?v=J---aiyznGQ'>Keyboard Cat</a>"),
        "and a person with no url closes a file":
        contentCheck({objectType: "person",
                      id: "urn:uuid:5abbfc3a-2e14-11e2-b27c-70f1a154e1aa",
                      displayName: "Clayton Barto"},
                     "close",
                     {objectType: "file",
                      id: "urn:uuid:8e5b739a-2e14-11e2-ab8e-70f1a154e1aa"},
                     "Clayton Barto closed a file"),
        "and a person posts a comment in reply to an image":
        contentCheck({objectType: "person",
                      id: "urn:uuid:dc3c3572-2e14-11e2-91fc-70f1a154e1aa",
                      displayName: "Lorrie Tynan"},
                     "post",
                     {objectType: "comment",
                      id: "urn:uuid:f58da61e-2e14-11e2-a207-70f1a154e1aa",
                      inReplyTo: {
                          objectType: "image",
                          id: "urn:uuid:0d61105a-2e15-11e2-b6b4-70f1a154e1aa",
                          author: {
                              displayName: "Karina Cosenza",
                              id: "urn:uuid:259e793c-2e15-11e2-b437-70f1a154e1aa",
                              objectType: "person"
                          }
                      }
                     },
                     "Lorrie Tynan posted a comment in reply to an image"),
        "and we create a person": {
            topic: function(Activity) {
                var Person = require("../lib/model/person").Person,
                    callback = this.callback;
                Person.create({id: "urn:uuid:3e2273f4-fec7-11e2-9db1-32b36b1a1850",
                               displayName: "Endicott Pettibone"},
                              function(err, person) {
                                  callback(err);
                              });
            },
            "it works": function(err) {
                assert.ifError(err);
            },
            "and we post an activity without the full actor data":
            contentCheck({objectType: "person",
                               id: "urn:uuid:3e2273f4-fec7-11e2-9db1-32b36b1a1850"},
                         "like",
                         {objectType: "image",
                          id: "urn:uuid:9f535cb0-fec7-11e2-9637-32b36b1a1850",
                          displayName: "La Giocanda"},
                         "Endicott Pettibone liked La Giocanda")
        },
        "and we create an image": {
            topic: function(Activity) {
                var Image = require("../lib/model/image").Image,
                    callback = this.callback;
                Image.create({id: "urn:uuid:1731d374-fec8-11e2-87ba-32b36b1a1850",
                              displayName: "John the Baptist"},
                              function(err, image) {
                                  callback(err);
                              });
            },
            "it works": function(err) {
                assert.ifError(err);
            },
            "and we post an activity without the full object data":
            contentCheck({objectType: "person",
                          id: "urn:uuid:6a8eab28-fec8-11e2-a39d-32b36b1a1850",
                          displayName: "Catherine Hawk"},
                         "like",
                         {id: "urn:uuid:1731d374-fec8-11e2-87ba-32b36b1a1850",
                          objectType: "image"},
                         "Catherine Hawk liked John the Baptist")
        },
        "and we create an article": {
            topic: function(Activity) {
                var Article = require("../lib/model/article").Article,
                    callback = this.callback;
                Article.create({id: "urn:uuid:af6ecc82-fec8-11e2-ac18-32b36b1a1850",
                                displayName: "The End of History"},
                               function(err, article) {
                                   callback(err);
                               });
            },
            "it works": function(err) {
                assert.ifError(err);
            },
            "and we post an activity without the full inReplyTo data":
            contentCheck({objectType: "person",
                          id: "urn:uuid:1f91eea4-fec9-11e2-8d0c-32b36b1a1850",
                          displayName: "Zee Modem"},
                         "post",
                         {id: "urn:uuid:47a5e800-fec9-11e2-8af9-32b36b1a1850",
                          objectType: "comment",
                          inReplyTo: {
                              id: "urn:uuid:af6ecc82-fec8-11e2-ac18-32b36b1a1850",
                              objectType: "article"
                          }
                         },
                         "Zee Modem posted a comment in reply to The End of History")
        }
    }
});

suite["export"](module);
