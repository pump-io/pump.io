// oauth-test.js
//
// Test the client registration API
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
    Step = require("step"),
    _ = require("underscore"),
    querystring = require("querystring"),
    http = require("http"),
    OAuth = require("oauth-evanp").OAuth,
    Browser = require("zombie"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    requestToken = oauthutil.requestToken,
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken;

var ignore = function(err) {};

var suite = vows.describe("OAuth parallel access tokens");

// A batch to test lots of parallel access token requests

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we get a lot of access tokens in parallel for a single client": {
            topic: function() {
                var cb = this.callback,
                    cl;
                Step(
                    function() {
                        newClient(this);
                    },
                    function(err, res) {
                        var i, group = this.group();
                        if (err) throw err;
                        cl = res;
                        for (i = 0; i < 25; i++) {
                            register(cl, "testuser"+i, "Aigae0aL"+i, group());
                        }
                    },
                    function(err, users) {
                        var i, group = this.group();
                        if (err) throw err;
                        for (i = 0; i < 25; i++) {
                            accessToken(cl, {nickname: "testuser"+i, password: "Aigae0aL"+i}, group());
                        }
                    },
                    function(err, pairs) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, pairs);
                        }
                    }
                );
            },
            "it works": function(err, pairs) {
                var i;
                assert.ifError(err);
                assert.isArray(pairs);
                assert.lengthOf(pairs, 25);
                for (i = 0; i < pairs.length; i++) {
                    assert.include(pairs[i], "token");
                    assert.isString(pairs[i].token);
                    assert.include(pairs[i], "token_secret");
                    assert.isString(pairs[i].token_secret);
                }
            }
        }
    }
});

suite["export"](module);