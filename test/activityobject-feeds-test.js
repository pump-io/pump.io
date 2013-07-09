// activityobject-feeds-test.js
//
// Test that activity object creates the right feeds at the right time
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
    Step = require("step"),
    _ = require("underscore"),
    fs = require("fs"),
    path = require("path"),
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    schema = require("../lib/schema").schema,
    URLMaker = require("../lib/urlmaker").URLMaker;

var suite = vows.describe("activityobject feeds interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch({
    "When we get the ActivityObject class": {
        topic: function() { 
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {
                var cls;

                DatabankObject.bank = db;
                
                cls = require("../lib/model/activityobject").ActivityObject;

                cb(null, cls);
            });
        },
        "we get a module": function(cls) {
            assert.isFunction(cls);
        },
        "and we ensure an object with no ID": {
            topic: function(ActivityObject) {
                var obj = {
                    objectType: "note",
                    content: "Hello, world!"
                };
                ActivityObject.ensureObject(obj, this.callback);
            },
            "it gets auto-created feeds": function(err, note) {
                assert.ifError(err);
                assert.isObject(note);
                assert.isObject(note.links);
                assert.isObject(note.links.self);
                assert.isString(note.links.self.href);
                assert.isObject(note.replies);
                assert.isString(note.replies.url);
                assert.isObject(note.likes);
                assert.isString(note.likes.url);
                assert.isObject(note.shares);
                assert.isString(note.shares.url);
            }
        },
        "and we ensure an object with an ID and no self link": {
            topic: function(ActivityObject) {
                var obj = {
                    id: "urn:uuid:391c0cae-e8c3-11e2-9ae8-c8f73398600c",
                    objectType: "note",
                    content: "Hello, world!"
                };
                ActivityObject.ensureObject(obj, this.callback);
            },
            "it gets auto-created feeds": function(err, note) {
                assert.ifError(err);
                assert.isObject(note);
                assert.isObject(note.links);
                assert.isObject(note.links.self);
                assert.isString(note.links.self.href);
                assert.isObject(note.replies);
                assert.isString(note.replies.url);
                assert.isObject(note.likes);
                assert.isString(note.likes.url);
                assert.isObject(note.shares);
                assert.isString(note.shares.url);
            }
        },
        "and we ensure an object with an ID and a self link": {
            topic: function(ActivityObject) {
                var obj = {
                    id: "urn:uuid:c88c04c4-e8c4-11e2-b129-c8f73398600c",
                    links: {
                        self: {
                            href: "http://example.com/note/123.json"
                        }
                    },
                    objectType: "note",
                    content: "Hello, world!"
                };
                ActivityObject.ensureObject(obj, this.callback);
            },
            "it does not get auto-created feeds": function(err, note) {
                assert.ifError(err);
                assert.isObject(note);
                assert.isFalse(_.isObject(note.replies));
                assert.isFalse(_.isObject(note.likes));
                assert.isFalse(_.isObject(note.shares));
            }
        }
    }
});

suite["export"](module);
