// bookmark-test.js
//
// Test the bookmark module
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

var suite = vows.describe("bookmark module interface");

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
             "targetUrl",
             "updated",
             "upstreamDuplicates",
             "url"],
    indices: ["_uuid", "url"]
};

var testData = {
    "create": {
        displayName: "Google Home Page",
        url: "http://example.com/bookmark/google-home-page",
        content: "Main search page for Google",
        image: {
            url: "http://example.com/images/bookmarks/google-home-page",
            height: 140,
            width: 140
        },
        targetUrl: "http://www.google.com/"
    },
    "update": {
        content: "Main search page for Google in the US"
    }
};

suite.addBatch(modelBatch("bookmark", "Bookmark", testSchema, testData));

suite["export"](module);
