// file-test.js
//
// Test the file module
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

var suite = vows.describe("file module interface");

var testSchema = {
    pkey: "id",
    fields: ["_created",
             "_slug",
             "_uuid",
             "attachments",
             "author",
             "content",
             "displayName",
             "downstreamDuplicates",
             "fileUrl",
             "id",
             "image",
             "inReplyTo",
             "likes",
             "links",
             "mimeType",
             "objectType",
             "published",
             "replies",
             "shares",
             "summary",
             "updated",
             "upstreamDuplicates",
             "url"],
    indices: ["_slug", "_uuid", "url"]
};

var testData = {
    "create": {
        displayName: "2012 Q1 Sales",
        fileUrl: "http://example.com/files/2012-q1-sales.xls",
        mimeType: "application/vnd.ms-excel",
        url: "http://example.com/pages/2012-q1-sales"
    },
    "update": {
        displayName: "2012 Q1 Sales (Revised)"
    }
};

suite.addBatch(modelBatch("file", "File", testSchema, testData));

suite["export"](module);
