// update-object-e2e-test.js
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

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("lodash"),
    http = require("http"),
    version = require("../dist/lib/version").version,
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    actutil = require("./lib/activity"),
    withAppSetup = apputil.withAppSetup,
    register = oauthutil.register,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    newCredentials = oauthutil.newCredentials,
    validActivityObject = actutil.validActivityObject;

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

suite.addBatch(
    withAppSetup({
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
        },
        "and we get more information about a locally-created object": {
            topic: function() {
                var callback = this.callback,
                    cl,
                    pair1,
                    pair2,
                    posted,
                    liked;

                Step(
                    function() {
                        newClient(this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        cl = results;
                        newPair(cl, "johnc", "i-heart-dragets", this.parallel());
                        newPair(cl, "johnl", "jwbooth4life", this.parallel());
                    },
                    function(err, results1, results2) {
                        var act;
                        if (err) throw err;
                        pair1 = results1;
                        pair2 = results2;
                        act = {
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "Hello, world."
                            }
                        };
                        httputil.postJSON("http://localhost:4815/api/user/johnc/feed",
                                          makeCred(cl, pair1),
                                          act,
                                          this);
                    },
                    function(err, results1) {
                        var act;
                        if (err) throw err;
                        posted = results1;
                        act = {
                            verb: "like",
                            object: {
                                id: posted.object.id,
                                objectType: posted.object.objectType,
                                content: "Hello, buttheads."
                            }
                        };
                        httputil.postJSON("http://localhost:4815/api/user/johnl/feed",
                                          makeCred(cl, pair2),
                                          act,
                                          this);
                    },
                    function(err, results2) {
                        if (err) throw err;
                        liked = results2;
                        httputil.getJSON(posted.object.links.self.href,
                                         makeCred(cl, pair1),
                                         this);
                    },
                    function(err, results1, response) {
                        callback(err, results1);
                    }
                );
            },
            "it works": function(err, note) {
                assert.ifError(err);
                assert.isObject(note);
            },
            "object has not been updated": function(err, note) {
                assert.ifError(err);
                validActivityObject(note);
                assert.equal(note.content, "Hello, world.");
            }
        }
    })
);

suite["export"](module);
