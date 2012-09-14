// person-test.js
//
// Test the person module
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
    schema = require("../lib/schema").schema,
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("person module interface");

var testSchema = {
    pkey: "id",
    fields: ["displayName",
             "image",
             "published",
             "updated",
             "url",
             "uuid"],
    indices: ["uuid"]
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

            var params = {schema: schema};

            var db = Databank.get("memory", params);

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

                User.create({nickname: "evan", password: "123456"},
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
        }
    }
});

suite["export"](module);

