// upload-file-test.js
//
// Test uploading a file to a server
//
// Copyright 2012, StatusNet Inc.
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
    os = require("os"),
    fs = require("fs"),
    path = require("path"),
    mkdirp = require("mkdirp"),
    rimraf = require("rimraf"),
    _ = require("underscore"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupAppConfig = oauthutil.setupAppConfig,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken;

var suite = vows.describe("upload file test");

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var assertValidFeed = function(feed) {
    assert.include(feed, "totalItems");
    assert.isNumber(feed.totalItems);
    assert.include(feed, "url");
    assert.isString(feed.url);
    assert.include(feed, "items");
    assert.isArray(feed.items);
};

suite.addBatch({
    "When we create a temporary upload dir": {
        topic: function() {
            var callback = this.callback,
                dirname = path.join(os.tmpDir(),
                                    "upload-file-test",
                                    ""+Date.now());
            mkdirp(dirname, function (err) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, dirname);
                }
            });
        },
        "it works": function(err, dir) {
            assert.ifError(err);
            assert.isString(dir);
        },
        teardown: function(dir) {
            rimraf(dir, function(err) { 
                console.dir(err);
            });
        },
        "and we set up the app": {
            topic: function(dir) {
                setupAppConfig({uploaddir: dir},
                               this.callback);
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "and we register a client": {
                topic: function() {
                    newClient(this.callback);
                },
                "it works": function(err, cl) {
                    assert.ifError(err);
                    assert.isObject(cl);
                },
                "and we create a new user": {
                    topic: function(cl) {
                        newPair(cl, "mike", "stormtroopers_hittin_the_ground", this.callback);
                    },
                    "it works": function(err, pair) {
                        assert.ifError(err);
                        assert.isObject(pair);
                    },
                    "and we check the uploads endpoint":
                    httputil.endpoint("/api/user/mike/uploads", ["POST", "GET"]),
                    "and we get the uploads endpoint of a new user": {
                        topic: function(pair, cl) {
                            var cred = makeCred(cl, pair),
                                callback = this.callback,
                                url = "http://localhost:4815/api/user/mike/uploads";

                            Step(
                                function() {
                                    httputil.getJSON(url, cred, this);
                                },
                                function(err, feed, response) {
                                    return callback(err, feed);
                                }
                            );
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assert.isObject(feed);
                        },
                        "it is correct": function(err, feed) {
                            assert.ifError(err);
                            assert.isObject(feed);
                            assertValidFeed(feed);
                        },
                        "it is empty": function(err, feed) {
                            assert.ifError(err);
                            assert.isObject(feed);
                            assert.equal(feed.totalItems, 0);
                            assert.lengthOf(feed.items, 0);
                        },
                        "and we upload a file": {
                            topic: function(feed, pair, cl) {
                                var cred = makeCred(cl, pair),
                                    callback = this.callback,
                                    url = "http://localhost:4815/api/user/mike/uploads",
                                    fileName = path.join(__dirname, "data", "image1.jpg");

                                Step(
                                    function() {
                                        httputil.postFile(url, cred, fileName, "image/jpeg", this);
                                    },
                                    function(err, doc, response) {
                                        return callback(err, doc);
                                    }
                                );
                            },
                            "it works": function(err, doc) {
                                assert.ifError(err);
                                assert.isObject(doc);
                            },
                            "it looks right": function(err, doc) {
                                assert.ifError(err);
                                assert.isObject(doc);
                                assert.include(doc, "objectType");
                                assert.equal(doc.objectType, "image");
                                assert.include(doc, "fullImage");
                                assert.isObject(doc.fullImage);
                                assert.include(doc.fullImage, "url");
                                assert.isString(doc.fullImage.url);
                                assert.isFalse(_.has(doc, "_slug"));
                                assert.isFalse(_.has(doc, "_uuid"));
                            },
                            "and we get the uploads feed again": {
                                topic: function(doc, feed, pair, cl) {
                                    var cred = makeCred(cl, pair),
                                        callback = this.callback,
                                        url = "http://localhost:4815/api/user/mike/uploads";

                                    Step(
                                        function() {
                                            httputil.getJSON(url, cred, this);
                                        },
                                        function(err, feed, response) {
                                            return callback(err, feed, doc);
                                        }
                                    );
                                },
                                "it works": function(err, feed, doc) {
                                    assert.ifError(err);
                                    assert.isObject(feed);
                                },
                                "it is correct": function(err, feed, doc) {
                                    assert.ifError(err);
                                    assert.isObject(feed);
                                    assertValidFeed(feed);
                                },
                                "it has our upload": function(err, feed, doc) {
                                    assert.ifError(err);
                                    assert.isObject(feed);
                                    assert.equal(feed.totalItems, 1);
                                    assert.lengthOf(feed.items, 1);
                                    assert.equal(feed.items[0].id, doc.id);
                                }
                            },
                            "and we post an activity with the upload as the object": {
                                topic: function(upl, feed, pair, cl) {
                                    var cred = makeCred(cl, pair),
                                        callback = this.callback,
                                        url = "http://localhost:4815/api/user/mike/feed",
                                        act = {
                                            verb: "post",
                                            object: upl
                                        };

                                    Step(
                                        function() {
                                            httputil.postJSON(url, cred, act, this);
                                        },
                                        function(err, doc, response) {
                                            return callback(err, doc);
                                        }
                                    );
                                },
                                "it works": function(err, act) {
                                    assert.ifError(err);
                                    assert.isObject(act);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
