// replies-test.js
//
// Test adding and removing replies
//
// Copyright 2012, E14N https://e14n.com/
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
    fs = require("fs"),
    path = require("path"),
    schema = require("../lib/schema").schema,
    URLMaker = require("../lib/urlmaker").URLMaker,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("replies interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch({
    "When we initialize the environment": {
        topic: function() { 

            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

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
                        Comment.create({content: "Whatever.", inReplyTo: note}, this);
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
                assert.isObject(comment);
                assert.isObject(note);
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
                    assert.isObject(list[0]);
                    assert.include(list[0], "id");
                    assert.equal(list[0].id, comment.id);
                }
            }
        },
        "and we create a new object and post a reply and remove the reply": {
            topic: function() {
                var Note = require("../lib/model/note").Note,
                    note = null,
                    Comment = require("../lib/model/comment").Comment,
                    cb = this.callback;
                
                Step(
                    function() {
                        Note.create({content: "Another test note."}, this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        note = result;
                        Comment.create({content: "Still bad.", inReplyTo: note}, this);
                    },
                    function(err, comment) {
                        if (err) throw err;
                        comment.del(this);
                    },
                    function(err) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(null, note);
                        }
                    }
                );
            },
            "it works": function(err, note) {
                assert.ifError(err);
            },
            "and we check the replies of the first object": {
                topic: function(note) {
                    var cb = this.callback;
                    note.getReplies(0, 20, function(err, list) {
                        cb(err, list);
                    });
                },
                "it works": function(err, list, comment) {
                    assert.ifError(err);
                },
                "it looks correct": function(err, list, comment) {
                    assert.isArray(list);
                    assert.lengthOf(list, 0);
                }
            }
        },
        "and we create a new object and post a reply and post a reply to that": {
            topic: function() {
                var Note = require("../lib/model/note").Note,
                    note = null,
                    Comment = require("../lib/model/comment").Comment,
                    cb = this.callback,
                    comment1 = null;
                
                Step(
                    function() {
                        Note.create({content: "Test again."}, this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        note = result;
                        Comment.create({content: "PLBBBBTTTTBBTT.", inReplyTo: note}, this);
                    },
                    function(err, comment) {
                        if (err) throw err;
                        comment1 = comment;
                        Comment.create({content: "Uncalled for!", inReplyTo: comment}, this);
                    },
                    function(err, comment2) {
                        if (err) {
                            cb(err, null, null, null);
                        } else {
                            cb(null, comment2, comment1, note);
                        }
                    }
                );
            },
            "it works": function(err, comment2, comment1, note) {
                assert.ifError(err);
            },
            "and we check the replies of the first object": {
                topic: function(comment2, comment1, note) {
                    var cb = this.callback;
                    note.getReplies(0, 20, function(err, list) {
                        cb(err, list, comment1, comment2);
                    });
                },
                "it works": function(err, list, comment1, comment2) {
                    assert.ifError(err);
                },
                "it looks correct": function(err, list, comment1, comment2) {
                    assert.isArray(list);
                    assert.lengthOf(list, 1);
                    assert.equal(list[0].id, comment1.id);
                    assert.include(list[0], 'replies');
                }
            }
        },
        "and we create a new object and post a lot of replies": {
            topic: function() {
                var Note = require("../lib/model/note").Note,
                    note = null,
                    Comment = require("../lib/model/comment").Comment,
                    cb = this.callback,
                    comments = null;
                
                Step(
                    function() {
                        Note.create({content: "More testing."}, this);
                    },
                    function(err, result) {
                        var i, group = this.group();
                        if (err) throw err;
                        note = result;
                        for (i = 0; i < 100; i++) {
                            Comment.create({content: "YOU LIE.", inReplyTo: note}, group());
                        }
                    },
                    function(err, comments) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(null, comments, note);
                        }
                    }
                );
            },
            "it works": function(err, comments, note) {
                assert.ifError(err);
                assert.isArray(comments);
                assert.isObject(note);
            },
            "and we check the replies of the first object": {
                topic: function(comments, note) {
                    var cb = this.callback;
                    note.getReplies(0, 200, function(err, list) {
                        cb(err, list, comments, note);
                    });
                },
                "it works": function(err, list, comments, note) {
                    assert.ifError(err);
                },
                "it looks correct": function(err, list, comments, note) {
                    var i, listIDs = new Array(100), commentIDs = new Array(100);
                    assert.isArray(list);
                    assert.lengthOf(list, 100);
                    for (i = 0; i < 100; i++) {
                        listIDs[i] = list[i].id;
                        commentIDs[i] = comments[i].id;
                    }
                    for (i = 0; i < 100; i++) {
                        assert.include(listIDs, comments[i].id);
                        assert.include(commentIDs, list[i].id);
                    }
                }
            }
        },
        "and we create a new object and expand its feeds": {
            topic: function() {
                var Note = require("../lib/model/note").Note,
                    note = null,
                    cb = this.callback;
                
                Step(
                    function() {
                        Note.create({content: "Blow face."}, this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        note = result;
                        note.expandFeeds(this);
                    },
                    function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, note);
                        }
                    }
                );
            },
            "it works": function(err, note) {
                assert.ifError(err);
            },
            "its replies element looks right": function(err, note) {
                assert.ifError(err);
                assert.isObject(note);
                assert.include(note, "replies");
                assert.isObject(note.replies);
                assert.include(note.replies, "totalItems");
                assert.equal(note.replies.totalItems, 0);
                assert.include(note.replies, "url");
                assert.isString(note.replies.url);
            }
        },
        "and we create a new object and post a reply and expand the object's feeds": {
            topic: function() {
                var Note = require("../lib/model/note").Note,
                    note = null,
                    Comment = require("../lib/model/comment").Comment,
                    cb = this.callback,
                    comment = null;
                
                Step(
                    function() {
                        Note.create({content: "Test your face."}, this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        note = result;
                        Comment.create({content: "UR FACE", inReplyTo: note}, this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        comment = result;
                        note.expandFeeds(this);
                    },
                    function(err) {
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
            "its replies element looks right": function(err, comment, note) {
                assert.include(note, "replies");
                assert.isObject(note.replies);
                assert.include(note.replies, "totalItems");
                assert.equal(note.replies.totalItems, 1);
                assert.include(note.replies, "url");
                assert.isString(note.replies.url);
            }
        }
    }
});

suite["export"](module);
