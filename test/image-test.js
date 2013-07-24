// image-test.js
//
// Test the image module
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

var suite = vows.describe("image module interface");

var testSchema = {
    pkey: "id",
    fields: ["_created",
             "_fslug",
             "_slug",
             "_uuid",
             "author",
             "content",
             "displayName",
             "downstreamDuplicates",
             "fullImage",
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
    indices: ["_uuid", "_slug", "_fslug", "image.url", "fullImage.url", "url"]
};

var testData = {
    "create": {
        displayName: "At the Beach",
        summary: "Us at the beach last year.",
        image: {
            url: "http://example.com/images/thumbnails/at-the-beach.png",
            height: 150,
            width: 150
        },
        fullImage: {
            url: "http://example.com/images/at-the-beach.jpeg",
            height: 1500,
            width: 1500
        }
    },
    "update": {
        displayName: "Us at the Beach"
    }
};

suite.addBatch(modelBatch("image", "Image", testSchema, testData));

suite["export"](module);
