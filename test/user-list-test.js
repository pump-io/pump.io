// user-list-test.js
//
// Test the user module's list methods
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
    URLMaker = require('../lib/urlmaker').URLMaker,
    schema = require('../lib/schema').schema,
    Stream = require("../lib/model/stream").Stream,
    NotInStreamError = require("../lib/model/stream").NotInStreamError,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("user module list interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch({
    "When we get the User class": {
        topic: function() { 

            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {
                var User;

                DatabankObject.bank = db;
                
                User = require("../lib/model/user").User || null;

                cb(null, User);
            });
        },
        "it exists": function(User) {
            assert.isFunction(User);
        },
        "and we create a user": {
            topic: function(User) {
                var props = {
                    nickname: "fred",
                    password: "a cardigan"
                };
                User.create(props, this.callback);
            },
            teardown: function(user) {
                if (user && user.del) {
                    user.del(function(err) {});
                }
            },
            "it works": function(err, user) {
                assert.ifError(err);
            },
            "it has a getLists() method": function(err, user) {
                assert.isFunction(user.getLists);
            },
            "and we get their list stream": {
                topic: function(user) {
                    user.getLists("person", this.callback);
                },
                "it works": function(err, stream) {
                    assert.ifError(err);
                    assert.isObject(stream);
                    assert.instanceOf(stream, Stream);
                },
                "and we count the number of lists": {
                    topic: function(stream, user) {
                        stream.count(this.callback);
                    },
                    "it works": function(err, count) {
                        assert.ifError(err);
                    },
                    "it is zero": function(err, count) {
                        assert.equal(count, 0);
                    }
                },
                "and we get the latest lists": {
                    topic: function(stream, user) {
                        stream.getIDs(0, 20, this.callback);
                    },
                    "it works": function(err, ids) {
                        assert.ifError(err);
                    },
                    "it is an array with zero items": function(err, ids) {
                        assert.isArray(ids);
                        assert.lengthOf(ids, 0);
                    }
                }
            }
        }
    }
});


suite["export"](module);
