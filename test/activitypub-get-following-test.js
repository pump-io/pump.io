// activitypub-following-test.js
//
// Test the ActivityPub following endpoint
//
// Copyright 2017 AJ Jordan <alex@strugee.net>
// Copyright 2018 E14N <evan@e14n.com>
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

var _ = require("lodash"),
    assert = require("assert"),
    vows = require("vows"),
    uuid = require("uuid"),
    apputil = require("./lib/app"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    newCredentials = oauthutil.newCredentials;

var suite = vows.describe("ActivityPub following");

var AS2_MIME_TYPE = "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"";
var AS2_CONTEXT = "https://www.w3.org/ns/activitystreams";

var assertValidAS2Activity = function(object) {
    assert.isObject(object);
    assert.isString(object.id);
    assert.isString(object.name || object.summary);
    assert.isString(object.type);
    assert.isString(published);
};

process.on('uncaughtException', function(err) {
    console.error(err);
    process.exit(-1);
});

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
        "it has a following link": function(err, res, body) {
          assert.isObject(body);
          assert.isString(body.following);
        },
        "and we request the following link": {
          topic: function(res, body, cred) {
            var cb = this.callback;
            var headers = {
              Accept: AS2_MIME_TYPE
            };
            httputil.getJSON(body.following, cred, headers, function(err, body, response) {
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
            assert.isNumber(body.totalItems);
            assert.equal(body.totalItems, 0);
            assert.notIncludes(body, "first");
            assert.notIncludes(body, "items");
            assert.notIncludes(body, "orderedItems");
          }
        }
      }
    }
  })).export(module);
