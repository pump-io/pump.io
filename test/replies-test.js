// replies-test.js
//
// Test adding and removing replies
//
// Copyright 2012, StatusNet Inc.
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
    _ = require("underscore"),
    Step = require("step"),
    schema = require("../lib/schema").schema,
    URLMaker = require("../lib/urlmaker").URLMaker,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("replies interface");

suite.addBatch({
    "When we initialize the environment": {
        topic: function() { 

            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get("memory", params);

            db.connect({}, function(err) {
                if (err) {
                    cb(err);
                } else {
                    DatabankObject.bank = db;
                    cb(null);
                }
            });
        },
        "it works": function(err) {
            assert.ifError(err);
        },
        "and we create a new object": {
            topic: function() {
                var Note = require("../lib/model/note").Note;
                Note.create({content: "This sucks."}, this.callback);
            },
            "it works": function(err, note) {
                assert.ifError(err);
                assert.isObject(note);
            },
            "it has a getReplies() method": function(err, note) {
                assert.isFunction(note.getReplies);
            },
            "and we check its replies list": {
                topic: function(note) {
                    note.getReplies(0, 20, this.callback);
                },
                "it works": function(err, replies) {
                    assert.ifError(err);
                },
                "it is empty": function(err, replies) {
                    assert.isArray(replies);
                    assert.lengthOf(replies, 0);
                }
            }
        },
        "and we create a new object and post a reply": {
            topic: function() {
                var Note = require("../lib/model/note").Note,
                    note = null,
                    Comment = require("../lib/model/comment").Comment,
                    cb = this.callback;
                
                Step(
                    function() {
                        Note.create({content: "Testing testing 123."}, this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        note = result;
                        Comment.create({content: "Whatever.", inReplyTo: note.id}, this);
                    },
                    function(err, comment) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(null, comment, note);
                        }
                    }
                );
            },
            "it works": function(err, comment, note) {
                assert.ifError(err);
            },
            "and we check the replies of the first object": {
                topic: function(comment, note) {
                    var cb = this.callback;
                    note.getReplies(0, 20, function(err, list) {
                        cb(err, list, comment);
                    });
                },
                "it works": function(err, list, comment) {
                    assert.ifError(err);
                },
                "it looks correct": function(err, list, comment) {
                    assert.isArray(list);
                    assert.lengthOf(list, 1);
                    assert.deepEqual(list[0], comment);
                }
            }
        },
        "and we create a new object and post a reply and remove the reply": {
        },
        "and we create a new object and post a reply and post a reply to that": {
        },
        "and we create a new object and post a reply and favour the reply": {
        },
        "and we create a new object and post a lot of replies": {
        },
        "and we create a new object and post a reply and expand the object": {
        }
    }
});

suite["export"](module);
