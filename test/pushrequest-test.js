// pushrequest-test.js
//
// Test the pushrequest module
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
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("pushrequest module interface");

var testSchema = {
    pkey: "topic_mode",
    fields: ["mode",
             "topic",
             "verify_token",
             "status",
             "lease_seconds",
             "created",
             "modified"],
    indices: ["topic", "verify_token"]
};

var testData = {
    "create": {
        mode: "subscribe",
        topic: "http://photo.example/alice/feed.json"
    },
    "update": {
        status: "verified",
        lease_seconds: 86400
    }
};

var mb = modelBatch("pushrequest", "PushRequest", testSchema, testData);

mb["When we require the pushrequest module"]
  ["and we get its PushRequest class export"]
  ["and we create a pushrequest instance"]
  ["auto-generated fields are there"] = function(err, created) {
      assert.isString(created.verify_token);
      assert.isString(created.topic_mode);
      assert.isNumber(created.created);
};

mb["When we require the pushrequest module"]
["and we get its PushRequest class export"]
["and we create a pushrequest instance"]
["and we modify it"]
["it is modified"] = function(err, updated) {
    assert.isNumber(updated.modified);
    assert.ifError(err);
};

suite.addBatch(mb);

suite["export"](module);
