// audio-test.js
//
// Test the audio module
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

var suite = vows.describe("audio module interface");

var testSchema = {
    pkey: "id",
    fields: ["_created",
             "_slug",
             "_uuid",
             "author",
             "content",
             "displayName",
             "downstreamDuplicates",
             "embedCode",
             "id",
             "image",
             "inReplyTo",
             "likes",
             "links",
             "objectType",
             "published",
             "replies",
             "shares",
             "stream",
             "summary",
             "updated",
             "upstreamDuplicates",
             "url"],
    indices: ["_uuid", "_slug", "url"]
};

var testData = {
    "create": {
        displayName: "Shake Your Rump",
        url: "http://example.com/beastie-boys/pauls-boutique/2",
        stream: {
            url: "http://example.com/beastie-boys/pauls-boutique/shake-your-rump.ogg",
            duration: 388
        }
    },
    "update": {
        displayName: "Shake Your Rump (Extended Mix)"
    }
};

suite.addBatch(modelBatch("audio", "Audio", testSchema, testData));

suite["export"](module);

