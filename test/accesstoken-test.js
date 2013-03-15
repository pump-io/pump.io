// accesstoken-test.js
//
// Test the accesstoken module
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
    AccessToken = require("../lib/model/accesstoken").AccessToken,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("access token interface");

var testSchema = {
    pkey: "access_token",
    fields: ["token_secret",
             "consumer_key",
             "request_token",
             "username",
             "created",
             "updated"],
    indices: ["username", "consumer_key", "request_token"]
};

var testData = {
    "create": {
        consumer_key: "AAAAAAAAAAAAAAAAAAAAAA",
        request_token: "BBBBBBBBBBBBBBBBBBBBBB",
        username: "jordan",
        callback: "http://example.com/callback"
    },
    "update": {
        username: "evan"
    }
};

// XXX: hack hack hack
// modelBatch hard-codes ActivityObject-style

var mb = modelBatch("accesstoken", "AccessToken", testSchema, testData);

mb["When we require the accesstoken module"]
  ["and we get its AccessToken class export"]
  ["and we create an accesstoken instance"]
  ["auto-generated fields are there"] = function(err, created) {
      assert.isString(created.access_token);
      assert.isString(created.token_secret);
      assert.isString(created.created);
      assert.isString(created.updated);
};

suite.addBatch(mb);

suite["export"](module);
