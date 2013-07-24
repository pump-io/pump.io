// task-test.js
//
// Test the task module
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
    version = require("../lib/version").version,
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("task module interface");

var testSchema = {
    pkey: "id",
    fields: ["_created",
             "_uuid",
             "actor",
             "attachments",
             "author",
             "by",
             "content",
             "displayName",
             "downstreamDuplicates",
             "id",
             "image",
             "inReplyTo",
             "likes",
             "links",
             "object",
             "objectType",
             "prerequisites",
             "published",
             "replies",
             "required",
             "shares",
             "summary",
             "supersedes",
             "updated",
             "upstreamDuplicates",
             "url",
             "verb"],
    indices: ["_uuid", "url"]
};

var testData = {
    "create": {
        actor: {
            id: "urn:uuid:746e6d2c-ec86-11e1-988e-0024beb67924",
            displayName: "Evan Prodromou",
            objectType: "person"
        },
        verb: "post",
        object: {
            id: "urn:uuid:ad06288c-ec86-11e1-bc32-0024beb67924",
            displayName: "pump.io-"+version,
            objectType: "application"
        }
    },
    "update": {
        required: true
    }
};

suite.addBatch(modelBatch("task", "Task", testSchema, testData));

suite["export"](module);
