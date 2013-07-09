// update-object-test.js
//
// Test that updated data is reflected in earlier activities
//
// Copyright 2013, E14N https://e14n.com/
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
    http = require("http"),
    version = require("../lib/version").version,
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    newCredentials = oauthutil.newCredentials;

var suite = vows.describe("Update object test");

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

// A batch for testing that updated information is updated

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
        "and we get more information about an object": {
            topic: function() {
                var callback = this.callback,
                    cl,
                    pair1,
                    pair2,
                    liked1,
                    liked2;

                Step(
                    function() {
                        newClient(this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        cl = results;
                        newPair(cl, "pault", "dont*get*drunk", this.parallel());
                        newPair(cl, "ebans", "jazzy*rascal", this.parallel());
                    },
                    function(err, results1, results2) {
                        var act;
                        if (err) throw err;
                        pair1 = results1;
                        pair2 = results2;
                        act = {
                            verb: "like",
                            object: {
                                id: "urn:uuid:484e5278-8675-11e2-bd8f-70f1a154e1aa",
                                links: {
                                    self: {
                                        href: "http://somewhereelse.example/note/1"
                                    }
                                },
                                objectType: "note"
                            }
                        };
                        httputil.postJSON("http://localhost:4815/api/user/pault/feed",
                                          makeCred(cl, pair1),
                                          act,
                                          this);
                    },
                    function(err, results1) {
                        var act;
                        if (err) throw err;
                        liked1 = results1;
                        act = {
                            verb: "like",
                            object: {
                                id: "urn:uuid:484e5278-8675-11e2-bd8f-70f1a154e1aa",
                                links: {
                                    self: {
                                        href: "http://somewhereelse.example/note/1"
                                    }
                                },
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        httputil.postJSON("http://localhost:4815/api/user/ebans/feed",
                                          makeCred(cl, pair2),
                                          act,
                                          this);
                    },
                    function(err, results2) {
                        if (err) throw err;
                        liked2 = results2;
                        httputil.getJSON(liked1.links.self.href,
                                         makeCred(cl, pair1),
                                         this);
                    },
                    function(err, results1, response) {
                        callback(err, results1);
                    }
                );
            },
            "it works": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
            },
            "object has been updated": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
                assert.isObject(act.object);
                assert.equal(act.object.content, "Hello, world!");
            }
        }
    }
});

suite["export"](module);
