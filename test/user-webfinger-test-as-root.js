// user-webfinger-test-as-root.js
//
// Test the API for the global list of registered users
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
    OAuth = require("oauth-evanp").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth");

var suite = vows.describe("Test Webfinger for user profile IDs");

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            oauthutil.setupApp(80, "social.localhost", this.callback);
        },
        teardown: function(app) {
            app.close();
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we get new OAuth credentials": {
            topic: function() {
                oauthutil.newClient("social.localhost", 80, this.callback);
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and we register a new user": {
                topic: function(cl) {
                    oauthutil.register(cl, "carlcraig", "d3tr01t!", "social.localhost", 80, this.callback);
                },
                "it works": function(err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                },
                "its profile has a Webfinger object ID": function(err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                    assert.include(user, "profile");
                    assert.isObject(user.profile);
                    assert.include(user.profile, "id");
                    assert.equal(user.profile.id, "acct:carlcraig@social.localhost");
                }
            }
        }
    }
});

suite["export"](module);