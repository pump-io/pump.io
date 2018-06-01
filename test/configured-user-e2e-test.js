// configured-user-e2e-test.js
//
// Test the config.users array
//
// Copyright 2018, E14N https://e14n.com/
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

var fs = require("fs"),
    path = require("path"),
    assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("lodash"),
    httputil = require("./lib/http"),
    gj = httputil.getJSON,
    pj = httputil.postJSON,
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    actutil = require("./lib/activity"),
    validActivity = actutil.validActivity,
    setupApp = apputil.setupApp,
    newPair = oauthutil.newPair;

var tc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "config.json")));

var suite = vows.describe("configured user and tokens");

suite.addBatch({
    "When we set up the app with configured users": {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            app.close();
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we request the user profile with the configured credentials": {
            topic: function() {
                var callback = this.callback;
                var client = tc.clients[0];
                var user = tc.users[0];
                var token = user.tokens[0];
                var nickname = user.nickname;
                var cred = {
                    consumer_key: client.client_id,
                    consumer_secret: client.client_secret,
                    token: token.token,
                    token_secret: token.token_secret
                };
                gj("http://localhost:4815/api/user/" + nickname, cred, callback);
            },
            "it works": function(err, body, resp) {
                assert.ifError(err);
                assert.isObject(body);
            }
        },
        "and we post a new activity with the configured credentials": {
            topic: function() {
                var callback = this.callback;
                var client = tc.clients[0];
                var user = tc.users[0];
                var token = user.tokens[0];
                var nickname = user.nickname;
                var cred = {
                    consumer_key: client.client_id,
                    consumer_secret: client.client_secret,
                    token: token.token,
                    token_secret: token.token_secret
                };
                var url = "http://localhost:4815/api/user/"+nickname+"/feed";
                var act = {
                        verb: "post",
                        object: {
                            objectType: "note",
                            content: "Hello, world."
                        }
                    };

                pj(url, cred, act, callback);
            },
            "it works": function(err, body) {
                assert.ifError(err);
                validActivity(body);
            }
        }
    }
});

suite["export"](module);
