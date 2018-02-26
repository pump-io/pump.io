// upload-file-test.js
//
// Test uploading a file to a server
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

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    os = require("os"),
    fs = require("fs"),
    path = require("path"),
    mkdirp = require("mkdirp"),
    rimraf = require("rimraf"),
    Browser = require("zombie"),
    _ = require("lodash"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    actutil = require("./lib/activity"),
    validFeed = actutil.validFeed,
    setupAppConfig = apputil.setupAppConfig,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient,
    register = oauthutil.register;

var suite = vows.describe("upload file test");

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

suite.addBatch({
    "When we create a temporary upload dir": {
        topic: function() {
            var callback = this.callback,
                dirname = path.join(os.tmpDir(),
                                    "upload-file-test",
                                    ""+Date.now());
            mkdirp(path.join(dirname, "uploads"), function(err) {
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
            });
        },
        "and we set up the app": {
            topic: function(dir) {
                setupAppConfig({
                    datadir: dir,
                    enableUploads: true
                }, this.callback);
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
                            validFeed(feed);
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
                            "and we get the file": {
                                topic: function(doc, feed, pair, cl) {
                                    var cred = makeCred(cl, pair),
                                        callback = this.callback,
                                        url = doc.fullImage.url,
                                        oa;

                                    oa = httputil.newOAuth(url, cred);

                                    Step(
                                        function() {
                                            oa.get(url, cred.token, cred.token_secret, this);
                                        },
                                        function(err, data, response) {
                                            callback(err, data);
                                        }
                                    );
                                },
                                "it works": function(err, data) {
                                    assert.ifError(err);
                                }
                            },
                            "and we visit the uploads path from the web interface": {
                                topic: function(doc) {
                                    var callback = this.callback;

                                    httputil.head("http://localhost:4815/uploads/", callback);
                                },
                                "it works": function(err, res) {
                                    assert.ifError(err);
                                },
                                "it has a status code of 403": function(err, res) {
                                    assert.isNumber(res.statusCode);
                                    assert.equal(res.statusCode, 403);
                                }
                            },
                            "and we try to get a private file with no extension from the web interface": {
                                topic: function(doc) {
                                    var callback = this.callback,
                                        url = doc.fullImage.url.split(".")[0];

                                    httputil.head(url, callback);
                                },
                                "it works": function(err, res) {
                                    assert.ifError(err);
                                },
                                "it has a status code of 403": function(err, res) {
                                    assert.isNumber(res.statusCode);
                                    assert.equal(res.statusCode, 403);
                                }
                            },
                            "and we get a private file from the web interface without logging in": {
                                topic: function(doc) {
                                    var browser = new Browser(),
                                        callback = this.callback,
                                        url = doc.fullImage.url;

                                    httputil.head(url, callback);
                                },
                                "it works": function(err, res) {
                                    assert.ifError(err);
                                },
                                "it has a status code of 403": function(err, res) {
                                    assert.isNumber(res.statusCode);
                                    assert.equal(res.statusCode, 403);
                                }
                            },
                            "and we login and try to get a private file": {
                                topic: function(doc, feed, pair, cl) {
                                    var browser = new Browser(),
                                        callback = this.callback,
                                        user = pair.user;

                                    Step(
                                        function() {
                                            browser.visit("http://localhost:4815/main/login", this);
                                        },
                                        function(err) {
                                            if (err) throw err;

                                            browser.fill("#nickname", user.nickname)
                                                .fill("#password", "stormtroopers_hittin_the_ground")
                                                .pressButton("div#loginpage form button[type=\"submit\"]", this);
                                        },
                                        function(err) {
                                            callback(err, browser);
                                        }
                                    );
                                },
                                "it works": function(err, br) {
                                    assert.ifError(err);
                                    br.assert.success();
                                },
                                "and we get the file from the web interface while logged in": {
                                    topic: function(br, doc) {
                                        var browser = br,
                                            callback = this.callback,
                                            url = doc.fullImage.url;

                                        browser.visit(url, function(err) {
                                            // when is false sends a new param for next test
                                            // and don't use br.assert because send a browser
                                            // as the new parameter for next test and
                                            // and we'll a duplicate browser instance
                                            callback(err || browser.status !== 200 || null);
                                        });
                                    },
                                    "it works": function(err) {
                                        assert.ifError(err);
                                    },
                                    "and we try to get the file with the wrong extension from the web interface": {
                                        topic: function(br, doc) {
                                            var browser = br,
                                                callback = this.callback,
                                                url = doc.fullImage.url.split(".")[0] + ".exe";

                                            browser.visit(url, function() {
                                                callback(null, browser);
                                            });
                                        },
                                        "it has a status code of 403": function(err, br) {
                                            br.assert.status(403);
                                        }
                                    }
                                }
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
                                    validFeed(feed);
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
                },
                "and we register another user": {
                    topic: function(cl) {
                        newPair(cl, "tom", "pick*eat*rate", this.callback);
                    },
                    "it works": function(err, pair) {
                        assert.ifError(err);
                        assert.isObject(pair);
                        assert.equal(_.get(pair, "user.nickname"), "tom");
                    },
                    "and we upload a file as a Binary object": {
                        topic: function(pair, cl) {
                            var cred = makeCred(cl, pair),
                                callback = this.callback,
                                url = "http://localhost:4815/api/user/tom/uploads",
                                fileName = path.join(__dirname, "data", "image2.jpg");

                            Step(
                                function() {
                                    fs.readFile(fileName, this);
                                },
                                function(err, data) {
                                    var bin;
                                    if (err) throw err;
                                    bin = {length: data.length,
                                           mimeType: "image/jpeg"
                                          };
                                    bin.data = data.toString("base64")
                                        .replace(/\+/g, "-")
                                        .replace(/\//g, "_")
                                        .replace(/=/g, "");

                                    httputil.postJSON(url, cred, bin, this);
                                },
                                function(err, doc, result) {
                                    if (err) {
                                        callback(err, null);
                                    } else {
                                        callback(null, doc);
                                    }
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
                        }
                    }
                }
            }
        },
        "and we set up the app with noweb": {
            topic: function(dir) {
                setupAppConfig({
                    datadir: dir,
                    enableUploads: true,
                    noweb: true,
                    port: 4816
                }, this.callback);
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "and we visit the uploads path from the web interface": {
                topic: function(doc) {
                    var callback = this.callback;

                    httputil.head("http://localhost:4816/uploads/", callback);
                },
                "it works": function(err, res) {
                    assert.ifError(err);
                },
                "it has a status code of 403": function(err, res) {
                    assert.isNumber(res.statusCode);
                    assert.equal(res.statusCode, 403);
                }
            }
        }
    }
});

suite["export"](module);
