// badge-test.js
//
// Test the badge module
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

var suite = vows.describe("badge module interface");

var testSchema = {
    pkey: "id",
    fields: ["_created",
             "_uuid",
             "attachments",
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
        displayName: "Unit TestX0r",
        url: "http://example.com/badge/unit-testx0r",
        summary: "Ran 3 or more unit tests, automatically!",
        image: {
            url: "http://example.com/images/badges/unit-testx0r",
            height: 350,
            width: 350
        }
    },
    "update": {
        summary: "Ran 5 or more unit tests, automatically!"
    }
};

suite.addBatch(modelBatch("badge", "Badge", testSchema, testData));

suite["export"](module);
