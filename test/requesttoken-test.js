// requesttoken-test.js
//
// Test the requesttoken module
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

var suite = vows.describe("request token interface");

var testSchema = {
    pkey: "token",
    fields: ["consumer_key",
             "callback",
             "used",
             "token_secret",
             "verifier",
             "authenticated",
             "username",
             "access_token",
             "created",
             "updated"],
    indices: ["access_token"]
};

var testData = {
    "create": {
        consumer_key: "AAAAAAAAAAAAAAAAAAAAAA",
        callback: "http://example.com/callback"
    },
    "update": {
        access_token: "BBBBBBBBBBBBBBBBBBBB",
        used: true
    }
};

var mb = modelBatch("requesttoken", "RequestToken", testSchema, testData);

mb["When we require the requesttoken module"]
  ["and we get its RequestToken class export"]
  ["and we create a requesttoken instance"]
  ["auto-generated fields are there"] = function(err, created) {
      assert.isString(created.token);
      assert.isString(created.token_secret);
      assert.isString(created.verifier);
      assert.isString(created.created);
      assert.isString(created.updated);
};

suite.addBatch(mb);

suite["export"](module);
