// other-test.js
//
// Test the other module
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

var suite = vows.describe("other module interface");

var testSchema = {
    pkey: "id",
    fields: ["attachments",
             "author",
             "content",
             "displayName",
             "downstreamDuplicates",
             "fullImage",
             "image",
             "objectType",
             "published",
             "summary",
             "updated",
             "upstreamDuplicates",
             "url",
             "_uuid"],
    indices: ["_uuid"]
};

var testData = {
    "create": {
        objectType: "http://schema.example/type/island/inhabitant",
        displayName: "Ricardo",
        url: "http://island.example/others/richardus"
    },
    "update": {
        displayName: "Richard Alpert"
    }
};

var mb = modelBatch("other", "Other", testSchema, testData);

mb["When we require the other module"]
  ["and we get its Other class export"]
  ["and we create an other instance"]
  ["auto-generated fields are there"] = function(err, created) {
      assert.isString(created.id);
      assert.isString(created.published);
      assert.isString(created.updated);
};

suite.addBatch(mb);

suite["export"](module);
