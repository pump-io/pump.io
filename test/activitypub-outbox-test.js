// activity-test.js
//
// Test the AS2 conversion module
//
// Copyright 2017 AJ Jordan <alex@strugee.net>
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

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    uuid = require("uuid");

var suite = vows.describe("ActivityPub actor");

suite.addBatch({
  "When we request an identity URL for ActivityPub": {
    topic() {
      // launch server
      // HTTP request of http://nameofhost/identity using AP content type
    },
    "it works": function(err, res, body) {
      // no error
    },
    "it has an outbox link": function(err, res, body) {
      // body includes outbox
      // outbox looks like the right outbox
    },
    "and we request the outbox": {
      topic: function(res, body) {
        // http request body.outbox
      },
      "it works": function(err, res, body) {
        // no error
      },
      "it has the right content-type": function(err, res, body) {
        // content-type = ap content type
      },
      "it looks like good AS2": function(err, res, body) {
        // context looks right
        // type is OrderedCollection
        // first property is an object
        // first property has type OrderedCollectionPage
        // first property has items
      }
    }
  }
}).export(module)
