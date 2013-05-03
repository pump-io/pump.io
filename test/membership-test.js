// membership-test.js
//
// Test the membership module
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
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("membership module interface");

var testSchema = {
    pkey: "id", 
    fields: ["member",
             "group",
             "published",
             "updated"],
    indices: ["member.id", "group.id"] };

var testData = {
    "create": {
        member: {
            id: "http://example.org/people/evan",
            displayName: "Evan Prodromou",
            objectType: "person"
        },
        group: {
            id: "urn:uuid:28fd8a40-adb4-11e2-9cbe-2c8158efb9e9",
            displayName: "pump.io hackers",
            objectType: "group"
        }
    },
    "update": {
        type: "early" // XXX: is there a real reason to update...?
    }
};

// XXX: hack hack hack
// modelBatch hard-codes ActivityObject-style

var mb = modelBatch("membership", "Membership", testSchema, testData);

mb["When we require the membership module"]
["and we get its Membership class export"]
["and we create a membership instance"]
["auto-generated fields are there"] = function(err, created) {
    assert.isString(created.id);
    assert.isString(created.published);
    assert.isString(created.updated);
};

suite.addBatch(mb);

suite.addBatch({
    "When we get the Membership class": {
        topic: function() {
            return require("../lib/model/membership").Membership;
        },
        "it exists": function(Membership) {
            assert.isFunction(Membership);
        },
        "it has an id() method": function(Membership) {
            assert.isFunction(Membership.id);
        },
        "and we get a new id": {
            topic: function(Membership) {
                var from = "http://example.com/user/1",
                    to = "http://example.net/group/35";
                return Membership.id(from, to);
            },
            "it is a string": function(id) {
                assert.isString(id);
            }
        }
    }
});

suite["export"](module);
