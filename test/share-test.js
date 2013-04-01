// share-test.js
//
// Test the share module
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

var suite = vows.describe("share module interface");

var testSchema = {
    pkey: "id", 
    fields: ["sharer",
             "shared",
             "published",
             "updated"],
    indices: ["sharer.id", "shared.id"]
};

var testData = {
    "create": {
        sharer: {
            id: "http://example.org/people/evan",
            displayName: "Evan Prodromou",
            objectType: "person"
        },
        shared: {
            id: "http://musicbrainz.org/release/fa20fff8-98c0-41a0-a60f-9c7cbafeb876",
            displayName: "Afterhours - The Velvet Underground",
            objectType: "audio"
        }
    },
    "update": {
        type: "hefty" // XXX: is there a real reason to update...?
    }
};

// XXX: hack hack hack
// modelBatch hard-codes ActivityObject-style

var mb = modelBatch("share", "Share", testSchema, testData);

mb["When we require the share module"]
["and we get its Share class export"]
["and we create a share instance"]
["auto-generated fields are there"] = function(err, created) {
    assert.isString(created.id);
    assert.isString(created.published);
    assert.isString(created.updated);
};

suite.addBatch(mb);

suite.addBatch({
    "When we get the Share class": {
        topic: function() {
            return require("../lib/model/share").Share;
        },
        "it exists": function(Share) {
            assert.isFunction(Share);
        },
        "it has an id() method": function(Share) {
            assert.isFunction(Share.id);
        },
        "and we get a new id": {
            topic: function(Share) {
                var from = "http://example.com/user/1",
                    to = "http://example.net/image/35";
                return Share.id(from, to);
            },
            "it is a string": function(id) {
                assert.isString(id);
            }
        }
    }
});

suite["export"](module);
