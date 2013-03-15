// edge-test.js
//
// Test the edge module
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

var suite = vows.describe("edge module interface");

var testSchema = {
    pkey: "id", 
    fields: ["from",
             "to",
             "published",
             "updated"],
    indices: ["from.id", "to.id"]
};

var testData = {
    "create": {
        from: {
            id: "http://example.org/people/evan",
            displayName: "Evan Prodromou",
            objectType: "person"
        },
        to: {
            id: "urn:uuid:8f64087d-fffc-4fe0-9848-c18ae611cafd",
            displayName: "Delbert Fnorgledap",
            objectType: "person"
        }
    },
    "update": {
        type: "friend" // XXX: is there a real reason to update...?
    }
};

// XXX: hack hack hack
// modelBatch hard-codes ActivityObject-style

var mb = modelBatch("edge", "Edge", testSchema, testData);

mb["When we require the edge module"]
["and we get its Edge class export"]
["and we create an edge instance"]
["auto-generated fields are there"] = function(err, created) {
    assert.isString(created.id);
    assert.isString(created.published);
    assert.isString(created.updated);
};

suite.addBatch(mb);

suite.addBatch({
    "When we get the Edge class": {
        topic: function() {
            return require("../lib/model/edge").Edge;
        },
        "it exists": function(Edge) {
            assert.isFunction(Edge);
        },
        "it has an id() method": function(Edge) {
            assert.isFunction(Edge.id);
        },
        "and we get a new id": {
            topic: function(Edge) {
                var from = "http://example.com/user/1",
                    to = "http://example.net/company/35";
                return Edge.id(from, to);
            },
            "it is a string": function(id) {
                assert.isString(id);
            }
        }
    }
});

suite["export"](module);
