// test-lib-oauth-test.js
//
// Test the test libraries
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
    http = require("http"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("underscore");

var suite = vows.describe("user REST API");

suite.addBatch({
    "When we load the module": {
        topic: function() {
            return require("./lib/oauth");
        },
        "it works": function(oauth) {
            assert.isObject(oauth);
        },
        "it has a setupApp() export": function(oauth) {
            assert.isTrue(_(oauth).has("setupApp"));
            assert.isFunction(oauth.setupApp);
        },
        "it has a newClient() export": function(oauth) {
            assert.isTrue(_(oauth).has("newClient"));
            assert.isFunction(oauth.newClient);
        },
        "it has a register() export": function(oauth) {
            assert.isTrue(_(oauth).has("register"));
            assert.isFunction(oauth.register);
        },
        "it has a requestToken() export": function(oauth) {
            assert.isTrue(_(oauth).has("requestToken"));
            assert.isFunction(oauth.requestToken);
        },
        "it has a newCredentials() export": function(oauth) {
            assert.isTrue(_(oauth).has("newCredentials"));
            assert.isFunction(oauth.newCredentials);
        },
        "it has a accessToken() export": function(oauth) {
            assert.isTrue(_(oauth).has("accessToken"));
            assert.isFunction(oauth.accessToken);
        },
        "and we setup the app": {
            topic: function(oauth) {
                oauth.setupApp(this.callback);
            },
            "it works": function(err, app) {
                assert.ifError(err);
                assert.isObject(app);
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "and we create a new client": {
                topic: function(app, oauth) {
                    oauth.newClient(this.callback);
                },
                "it works": function(err, client) {
                    assert.ifError(err);
                    assert.isObject(client);
                    assert.include(client, "client_id");
                    assert.isString(client.client_id);
                    assert.include(client, "client_secret");
                    assert.isString(client.client_secret);
                },
                "and we register a new user": {
                    topic: function(client, app, oauth) {
                        oauth.register(client, "alice", "ch3z|p4niSSe", this.callback);
                    },
                    "it works": function(err, user) {
                        assert.ifError(err);
                        assert.isObject(user);
                    },
                    "and we get a new access token": {
                        topic: function(user, client, app, oauth) {
                            oauth.accessToken(client, {nickname: "alice", password: "ch3z|p4niSSe"}, this.callback);
                        },
                        "it works": function(err, pair) {
                            assert.ifError(err);
                            assert.isObject(pair);
                            assert.include(pair, "token");
                            assert.isString(pair.token);
                            assert.include(pair, "token_secret");
                            assert.isString(pair.token_secret);
                        }
                    }
                }
            },
            "and we get new credentials": {
                topic: function(app, oauth) {
                    oauth.newCredentials("jasper", "johns,artist", this.callback);
                },
                "it works": function(err, cred) {
                    assert.ifError(err);
                    assert.isObject(cred);
                    assert.include(cred, "consumer_key");
                    assert.isString(cred.consumer_key);
                    assert.include(cred, "consumer_secret");
                    assert.isString(cred.consumer_secret);
                    assert.include(cred, "token");
                    assert.isString(cred.token);
                    assert.include(cred, "token_secret");
                    assert.isString(cred.token_secret);
                }
            }
        }
    }
});

suite["export"](module);
