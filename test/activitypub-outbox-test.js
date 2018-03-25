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
    uuid = require("uuid"),
    apputil = require("./lib/app"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    newCredentials = oauthutil.newCredentials;

var suite = vows.describe("ActivityPub actor");

var AS2_MIME_TYPE = "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"";
var AS2_CONTEXT = "https://www.w3.org/ns/activitystreams";

suite.addBatch(apputil.withAppSetup({
  "and we get new credentials": {
      topic: function() {
          newCredentials("macdonald", "the|old|flag", this.callback);
      },
      "it works": function(err, cred) {
          assert.ifError(err);
      },
      "and we request an identity URL for ActivityPub": {
        topic(cred) {
          var cb = this.callback;
          var headers = {
            Accept: AS2_MIME_TYPE
          };
          httputil.getJSON("http://localhost:4815/macdonald", cred, headers, function(err, body, response) {
              cb(err, response, body);
          });
        },
        "it works": function(err, res, body) {
          assert.ifError(err);
        },
        "it has an outbox link": function(err, res, body) {
          assert.isObject(body);
          assert.isString(body.outbox);
        },
        "and we request the outbox": {
          topic: function(res, body, cred) {
            var cb = this.callback;
            var headers = {
              Accept: AS2_MIME_TYPE
            };
            httputil.getJSON(body.outbox, cred, headers, function(err, body, response) {
                cb(err, response, body);
            });
          },
          "it works": function(err, res, body) {
            assert.ifError(err);
          },
          "it has the right content-type": function(err, res, body) {
            assert.isObject(res);
            assert.equal(res.headers["content-type"], AS2_MIME_TYPE);
          },
          "it looks like good AS2": function(err, res, body) {
            assert.isObject(body);
            assert.isString(body.type);
            assert.equal(body.type, "OrderedCollection");
            assert.isObject(body.first);
            assert.isString(body.first.type);
            assert.equal(body.first.type, "OrderedCollectionPage");
            assert.isArray(body.first.orderedItems);
            // XXX: check that there is an object in items
            // XXX: check that that object is an activity
          }
        }
      }
    }
  })).export(module);
