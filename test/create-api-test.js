// create-api-test.js
//
// Test the 'create' verb
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
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient;

var ignore = function(err) {};

var suite = vows.describe("Create API test");

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

// A batch for testing the read access to the API

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
        "and we get a new client": {
            topic: function() {
                newClient(this.callback);
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and we create a new user": {
                topic: function(cl) {
                    newPair(cl, "philippe", "motor*cycle", this.callback);
                },
                "it works": function(err, pair) {
                    assert.ifError(err);
                    assert.isObject(pair);
                },
                "and the user creates a list": {
                    topic: function(pair, cl) {
                        var url = "http://localhost:4815/api/user/philippe/feed",
                            cred = makeCred(cl, pair),
                            callback = this.callback;
                        
                        Step(
                            function() {
                                var act = {
                                    verb: "create",
                                    object: {
                                        objectType: "collection",
                                        objectTypes: ["person"],
                                        displayName: "Jerks"
                                    }
                                };
                                httputil.postJSON(url, cred, act, this);
                            },
                            function(err, act, result) {
                                callback(err, act);
                            }
                        );
                    },
                    "it works": function(err, act) {
                        assert.ifError(err);
                        assert.isObject(act);
                    },
                    "object looks created": function(err, act) {
                        assert.ifError(err);
                        assert.isObject(act);
                        assert.include(act, "object");
                        assert.isObject(act.object);
                        assert.include(act.object, "id");
                        assert.isString(act.object.id);
                        assert.include(act.object, "url");
                        assert.isString(act.object.url);
                        assert.include(act.object, "links");
                        assert.isObject(act.object.links);
                        assert.include(act.object.links, "self");
                        assert.isObject(act.object.links.self);
                        assert.include(act.object.links.self, "href");
                        assert.isString(act.object.links.self.href);
                    },
                    "and we fetch the object": {
                        topic: function(act, pair, cl) {
                            var url = act.object.links.self.href,
                                cred = makeCred(cl, pair);

                            httputil.getJSON(url, cred, this.callback);
                        },
                        "it works": function(err, doc, response) {
                            assert.ifError(err);
                            assert.isObject(doc);
                        },
                        "it looks right": function(err, doc, response) {
                            assert.isObject(doc);
                            assert.include(doc, "id");
                            assert.isString(doc.id);
                            assert.include(doc, "url");
                            assert.isString(doc.url);
                            assert.include(doc, "links");
                            assert.isObject(doc.links);
                            assert.include(doc.links, "self");
                            assert.isObject(doc.links.self);
                            assert.include(doc.links.self, "href");
                            assert.isString(doc.links.self.href);
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
