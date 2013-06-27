// place-test.js
//
// Test the place module
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
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("place module interface");

var testSchema = {
    pkey: "id",
    fields: ["_created",
             "_uuid",
             "address",
             "author",
             "content",
             "displayName",
             "downstreamDuplicates",
             "id",
             "image",
             "inReplyTo",
             "likes",
             "links",
             "objectType",
             "position",
             "published",
             "replies",
             "shares",
             "summary",
             "updated",
             "upstreamDuplicates",
             "url"],
    indices: ["_uuid", "url"]
};

var testData = {
    "create": {
        displayName: "Torchy's Tacos",
        position: "+30.2516492-97.7540501/",
        address: {
            streetAddress: "South 1st Street",
            locality: "Austin",
            region: "Texas",
            postalCode: "78704",
            country: "USA"
        },
        url: "http://nominatim.openstreetmap.org/details.php?place_id=9576945"
    },
    "update": {
        displayName: "Torchy's Tacos on South 1st"
    }
};

suite.addBatch(modelBatch("place", "Place", testSchema, testData));

suite["export"](module);
