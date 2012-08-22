// page-test.js
//
// Test the page module
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
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("page module interface");

var testSchema = {
    pkey: "id",
    fields: ["attachments",
             "author",
             "content",
             "displayName",
             "downstreamDuplicates",
             "id",
             "image",
             "objectType",
             "published",
             "summary",
             "updated",
             "upstreamDuplicates",
             "url",
             "uuid"
    ],
    indices: ["uuid"]
};

var testData = {
    "create": {
        displayName: "Evan Prodromou",
        url: "http://www.facebook.com/evan.prodromou",
        summary: "Founder and CTO of StatusNet Inc"
    },
    "update": {
        summary: "Founder and CEO of StatusNet Inc"
    }
};

suite.addBatch(modelBatch("page", "Page", testSchema, testData));

suite["export"](module);
