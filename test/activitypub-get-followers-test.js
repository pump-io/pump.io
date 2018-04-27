// activitypub-followers-test.js
//
// Test the ActivityPub followers endpoint
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

var tc = require("./config.json");

var AS2_MIME_TYPE = "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"";
var AS2_CONTEXT = "https://www.w3.org/ns/activitystreams";

var user = tc.users[3];
var client = tc.clients[0];

process.on("uncaughtException", function(err) {
    console.error(err);
    process.exit(-1);
});

var suite = vows.describe("ActivityPub followers");

suite.addBatch(apputil.withAppSetup({
    "and we request an identity URL for ActivityPub": {
        topic() {
            var cb = this.callback;
            var headers = {
                Accept: AS2_MIME_TYPE,
                Authorization: "Bearer " + user.tokens[0].token
            };
            var url = "http://localhost:4815/" + user.nickname;
            httputil.get(url, headers, function(err, response, body) {
                if (err) {
                    cb(err);
                } else if (response.statusCode !== 200) {
                    cb(new Error("Unexpected status code: " + response.statusCode));
                } else {
                    var data = null;
                    try {
                        data = JSON.parse(body);
                    } catch (e) {
                        return cb(e);
                    }
                    return cb(null, response, data);
                }
            });
        },
        "it works": function(err, res, body) {
            assert.ifError(err);
            assert.isObject(res);
            assert.isObject(body);
            assert.isString(body.followers);
        },
        "and we request the followers link": {
          topic: function(ignore, actor) {
            var cb = this.callback;
            var headers = {
              Accept: AS2_MIME_TYPE,
              Authorization: "Bearer " + user.tokens[0].token
            };
            httputil.get(actor.followers, headers, function(err, response, body) {
                if (err) {
                    cb(err);
                } else if (response.statusCode !== 200) {
                    cb(new Error("Unexpected status code: " + response.statusCode));
                } else {
                    var data = null;
                    try {
                        data = JSON.parse(body);
                    } catch (e) {
                        return cb(e);
                    }
                    return cb(null, response, data);
                }
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
  })).export(module);
