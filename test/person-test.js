// person-test.js
//
// Test the person module
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
    fs = require("fs"),
    path = require("path"),
    Step = require("step"),
    _ = require("underscore"),
    schema = require("../lib/schema").schema,
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("person module interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var testSchema = {
    pkey: "id",
    fields: ["_created",
             "_uuid",
             "content",
             "displayName",
             "downstreamDuplicates",
             "favorites",
             "followers",
             "following",
             "id",
             "image",
             "likes",
             "links",
             "lists",
             "objectType",
             "published",
             "replies",
             "shares",
             "summary",
             "updated",
             "upstreamDuplicates",
             "url"],
    indices: ["_uuid", "url", "image.url"]
};

var testData = {
    "create": {
        displayName: "George Washington",
        image: {
            url: "http://www.georgewashington.si.edu/portrait/images/face.jpg",
            width: 83,
            height: 120
        }
    },
    "update": {
        displayName: "President George Washington"
    }
};

suite.addBatch(modelBatch("person", "Person", testSchema, testData));

suite.addBatch({
    "When we get the Person class": {
        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";
            URLMaker.port     = 4815;

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
                
                mod = require("../lib/model/person");

                if (!mod) {
                    cb(new Error("No module"), null);
                    return;
                }

                cb(null, mod.Person);
            });
        },
        "it works": function(err, Person) {
            assert.ifError(err);
            assert.isFunction(Person);
        },
        "and we instantiate a non-user Person": {
            topic: function(Person) {
                Person.create({displayName: "Gerald"}, this.callback);
            },
            "it works": function(err, person) {
                assert.ifError(err);
                assert.isObject(person);
                assert.instanceOf(person, require("../lib/model/person").Person);
            },
            "it has a followersURL() method": function(err, person) {
                assert.ifError(err);
                assert.isObject(person);
                assert.isFunction(person.followersURL);
            },
            "it has a getInbox() method": function(err, person) {
                assert.ifError(err);
                assert.isObject(person);
                assert.isFunction(person.getInbox);
            },
            "and we get its followersURL": {
                topic: function(person) {
                    person.followersURL(this.callback);
                },
                "it works": function(err, url) {
                    assert.ifError(err);
                },
                "it is null": function(err, url) {
                    assert.ifError(err);
                    assert.isNull(url);
                }
            }
        },
        "and we create a user": {
            topic: function(Person) {
                var User = require("../lib/model/user").User;

                User.create({nickname: "evan", password: "one23four56"},
                            this.callback);
            },
            "it works": function(err, user) {
                assert.ifError(err);
            },
            "and we get the followersURL of the profile": {
                topic: function(user) {
                    user.profile.followersURL(this.callback);
                },
                "it works": function(err, url) {
                    assert.ifError(err);
                    assert.isString(url);
                },
                "data is correct": function(err, url) {
                    assert.ifError(err);
                    assert.isString(url);
                    assert.equal(url, "http://example.net:4815/api/user/evan/followers");
                }
            },
            "and we get the inbox of the profile": {
                topic: function(user) {
                    user.profile.getInbox(this.callback);
                },
                "it works": function(err, url) {
                    assert.ifError(err);
                    assert.isString(url);
                },
                "data is correct": function(err, url) {
                    assert.ifError(err);
                    assert.isString(url);
                    assert.equal(url, "http://example.net:4815/api/user/evan/inbox");
                }
            }
        },
        "and we create a user and expand the profile": {
            topic: function(Person) {
                var User = require("../lib/model/user").User,
                    user,
                    callback = this.callback;

                Step(
                    function() {
                        User.create({nickname: "aldus", password: "one23four56"}, this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        user = result;
                        user.expand(this);
                    },
                    function(err) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, user);
                        }
                    }
                );
            },
            "it works": function(err, user) {
                assert.ifError(err);
            },
            "the profile has the right links": function(err, user) {
                assert.ifError(err);
                assert.isObject(user);
                assert.isObject(user.profile);
                assert.isObject(user.profile.links);
                assert.isObject(user.profile.links.self);
                assert.isObject(user.profile.links["activity-inbox"]);
                assert.isObject(user.profile.links["activity-outbox"]);
            },
            "and we expand the profile's feeds": {
                topic: function(user) {
                    var callback = this.callback;
                    user.profile.expandFeeds(function(err) {
                        callback(err, user);
                    });
                },
                "the profile has the right feeds": function(err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                    assert.isObject(user.profile);
                    assert.isFalse(_(user.profile).has("likes"));
                    assert.isFalse(_(user.profile).has("replies"));
                    assert.isObject(user.profile.followers);
                    assert.isString(user.profile.followers.url);
                    assert.isNumber(user.profile.followers.totalItems);
                    assert.isObject(user.profile.following);
                    assert.isString(user.profile.following.url);
                    assert.isNumber(user.profile.following.totalItems);
                    assert.isObject(user.profile.lists);
                    assert.isString(user.profile.lists.url);
                    assert.isNumber(user.profile.lists.totalItems);
                    assert.isObject(user.profile.favorites);
                    assert.isString(user.profile.favorites.url);
                    assert.isNumber(user.profile.lists.totalItems);
                }
            }
        }
    }
});

suite["export"](module);

