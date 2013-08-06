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

var assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    _ = require("underscore"),
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
                      id: "cbf1f0ca-2e10-11e2-8174-70f1a154e1aa",
                      displayName: "Jessie Belnap"},
                     "post",
                     {objectType: "note",
                      id: "f4f859a0-2e10-11e2-9af6-70f1a154e1aa",
                      content: "Hello, world."},
                     "Jessie Belnap posted a note"),
        "and a person with an url posts a note":
        contentCheck({objectType: "person",
                      id: "e67c969c-2e11-11e2-86dc-70f1a154e1aa",
                      url: "http://malloryfellman.example/",
                      displayName: "Mallory Fellman"},
                     "post",
                     {objectType: "note",
                      id: "a453c0fa-2e12-11e2-9214-70f1a154e1aa",
                      content: "Hello, world."},
                     "<a href='http://malloryfellman.example/'>Mallory Fellman</a> posted a note"),
        "and a person with no url plays a video":
        contentCheck({objectType: "person",
                      id: "6958bee6-2e13-11e2-be89-70f1a154e1aa",
                      displayName: "Mathew Penniman"},
                     "play",
                     {objectType: "video",
                      url: "http://www.youtube.com/watch?v=J---aiyznGQ",
                      displayName: "Keyboard Cat"},
                     "Mathew Penniman played <a href='http://www.youtube.com/watch?v=J---aiyznGQ'>Keyboard Cat</a>"),
        "and a person with no url closes a file":
        contentCheck({objectType: "person",
                      id: "5abbfc3a-2e14-11e2-b27c-70f1a154e1aa",
                      displayName: "Clayton Barto"},
                     "close",
                     {objectType: "file",
                      id: "8e5b739a-2e14-11e2-ab8e-70f1a154e1aa"},
                     "Clayton Barto closed a file"),
        "and a person posts a comment in reply to an image":
        contentCheck({objectType: "person",
                      id: "dc3c3572-2e14-11e2-91fc-70f1a154e1aa",
                      displayName: "Lorrie Tynan"},
                     "post",
                     {objectType: "comment",
                      id: "f58da61e-2e14-11e2-a207-70f1a154e1aa",
                      inReplyTo: {
                          objectType: "image",
                          id: "0d61105a-2e15-11e2-b6b4-70f1a154e1aa",
                          author: {
                              displayName: "Karina Cosenza",
                              id: "259e793c-2e15-11e2-b437-70f1a154e1aa",
                              objectType: "person"
                          }
                      }
                     },
                     "Lorrie Tynan posted a comment in reply to an image")
    }
});

suite["export"](module);
