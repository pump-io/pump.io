// pushsubscription-test.js
//
// Test the pushsubscription module
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

var suite = vows.describe("pushsubscription module interface");

var testSchema = {
    pkey: "topic",
    fields: ["uuid",
             "state",
             "verify_token",
             "secret",
             "lease_seconds",
             "created",
             "modified"],
    indices: ["uuid"]
};

var testData = {
    "create": {
        status: "subscribing-initial",
        topic: "http://photo.example/alice/feed.json"
    },
    "update": {
        status: "subscribing-verified",
        lease_seconds: 86400
    }
};

var mb = modelBatch("pushsubscription", "PushSubscription", testSchema, testData);

mb["When we require the pushsubscription module"]
["and we get its PushSubscription class export"]
["and we create a pushsubscription instance"]
["auto-generated fields are there"] = function(err, created) {
    assert.ifError(err);
    assert.isString(created.verify_token);
    assert.isString(created.secret);
    assert.isString(created.uuid);
    assert.isNumber(created.created);
    assert.isNumber(created.modified);
};

mb["When we require the pushsubscription module"]
["and we get its PushSubscription class export"]
["and we create a pushsubscription instance"]
["and we modify it"]
["it is modified"] = function(err, updated) {
    assert.ifError(err);
    assert.isNumber(updated.modified);
};

suite.addBatch(mb);

suite["export"](module);
