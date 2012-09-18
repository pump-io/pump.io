# product-test.js
#
# Test the product module
#
# Copyright 2012, StatusNet Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
assert = require("assert")
vows = require("vows")
databank = require("databank")
URLMaker = require("../lib/urlmaker").URLMaker
modelBatch = require("./lib/model").modelBatch
Databank = databank.Databank
DatabankObject = databank.DatabankObject
suite = vows.describe("product module interface")
testSchema =
  pkey: "id"
  fields: ["author", "displayName", "fullImage", "image", "published", "summary", "updated", "url"]

testData =
  create:
    displayName: "ActivityPump"
    summary: "DUH what it sounds like LOL"
    url: "http://activitypump.org/"

  update:
    summary: "Network infrastructure for social tools."

suite.addBatch modelBatch("product", "Product", testSchema, testData)
suite["export"] module
