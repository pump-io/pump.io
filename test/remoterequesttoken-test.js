// remoterequesttoken-test.js
//
// Test the remoterequesttoken module
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

var suite = vows.describe("remoterequesttoken module interface");

var testSchema = {
    pkey: "hostname_token",
    fields: ["hostname",
             "token",
             "secret"]
};

var testData = {
    "create": {
        hostname: "social.localhost",
        token: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        secret: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
    },
    "update": {
        secret: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
    }
};

var mb = modelBatch("remoterequesttoken", "RemoteRequestToken", testSchema, testData);

mb["When we require the remoterequesttoken module"]
["and we get its RemoteRequestToken class export"]
["and we create a remoterequesttoken instance"]
["auto-generated fields are there"] = function(err, created) {
    assert.ifError(err);
};

mb["When we require the remoterequesttoken module"]
["and we get its RemoteRequestToken class export"]
["and we create a remoterequesttoken instance"]
["and we modify it"]
["it is modified"] = function(err, updated) {
    assert.ifError(err);
};

suite.addBatch(mb);

suite["export"](module);
