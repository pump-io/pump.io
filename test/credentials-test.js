// credentials-test.js
//
// Test the credentials module
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
    Step = require("step"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("credentials module interface");

var testSchema = {
    pkey: "host_and_id",
    fields: ["host",
             "id",
             "client_id",
             "client_secret",
             "expires_at",
             "created",
             "updated"],
    indices: ["host", "id", "client_id"]
};

var testData = {
    "create": {
        host: "social.example",
        id: "acct:user@comment.example",
        client_id: "AAAAAA",
        client_secret: "123456",
        expires_at: 0
    },
    "update": {
        expires_at: 1
    }
};

var mb = modelBatch("credentials", "Credentials", testSchema, testData);

mb["When we require the credentials module"]
  ["and we get its Credentials class export"]
  ["and we create a credentials instance"]
  ["auto-generated fields are there"] = function(err, created) {
      assert.isString(created.host_and_id);
      assert.isString(created.created);
      assert.isString(created.updated);
};

suite.addBatch(mb);

suite["export"](module);
