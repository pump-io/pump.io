// proxy-url-test-as-root.js
//
// Test that remote objects get pump_io.proxyURL properties
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

var util = require("util"),
    assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    http = require("http"),
    mkdirp = require("mkdirp"),
    rimraf = require("rimraf"),
    os = require("os"),
    fs = require("fs"),
    path = require("path"),
    querystring = require("querystring"),
    _ = require("underscore"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    dialbackApp = require("./lib/dialback").dialbackApp,
    setupAppConfig = oauthutil.setupAppConfig,
    setupApp = oauthutil.setupApp;

var suite = vows.describe("proxy url test");

var serverOf = function(url) {
    var parts = urlparse(url);
    return parts.hostname;
};

var assertProxyURL = function(obj, prop) {
    assert.isObject(obj[prop], "Property '"+prop+"' is not an object");
    assert.isObject(obj[prop].pump_io, "Property '"+prop+"' has no pump_io object property");
    assert.isString(obj[prop].pump_io.proxyURL, "Property '"+prop+"' has no proxyURL in its pump_io section");
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
            });
        },
        "And we set up two apps": {
            topic: function(dir) {
                var social, photo, callback = this.callback;
                Step(
                    function() {
                        setupAppConfig({port: 80, hostname: "social.localhost"},
                                       this.parallel());
                        setupAppConfig({port: 80, hostname: "photo.localhost", uploaddir: dir},
                                       this.parallel());
                    },
                    function(err, social, photo) {
                        if (err) {
                            callback(err, null, null);
                        } else {
                            callback(null, social, photo);
                        }
                    }
                );
            },
            "it works": function(err, social, photo) {
                assert.ifError(err);
            },
            teardown: function(social, photo) {
                if (social && social.close) {
                    social.close();
                }
                if (photo && photo.close) {
                    photo.close();
                }
            },
            "and we register one user on each": {
                topic: function() {
                    var callback = this.callback;
                    Step(
                        function() {
                            newCredentials("colin", "t4steful", "social.localhost", 80, this.parallel());
                            newCredentials("jane", "gritty*1", "photo.localhost", 80, this.parallel());
                        },
                        callback
                    );
                },
                "it works": function(err, cred1, cred2) {
                    assert.ifError(err);
                    assert.isObject(cred1);
                    assert.isObject(cred2);
                },
                "and one user follows the other": {
                    topic: function(cred1, cred2) {
                        var url = "http://social.localhost/api/user/colin/feed",
                            act = {
                                verb: "follow",
                                object: cred2.user.profile
                            },
                            callback = this.callback;
                        
                        pj(url, cred1, act, function(err, body, resp) {
                            if (err) {
                                callback(err, null);
                            } else {
                                callback(null, body);
                            }
                        });
                    },
                    "it works": function(err, body) {
                        assert.ifError(err);
                        assert.isObject(body);
                    },
                    "and we wait a few seconds for delivery": {
                        topic: function() {
                            var callback = this.callback;
                            setTimeout(function() { callback(null); }, 2000);
                        },
                        "it works": function(err) {
                            assert.ifError(err);
                        },
                        "and the second user posts an image": {
                            topic: function(act, cred1, cred2) {
                                var up = "http://photo.localhost/api/user/jane/uploads",
                                    feed = "http://photo.localhost/api/user/jane/feed",
                                    fileName = path.join(__dirname, "data", "image1.jpg"),
                                    callback = this.callback;

                                Step(
                                    function() {
                                        httputil.postFile(up, cred2, fileName, "image/jpeg", this);
                                    },
                                    function(err, doc, response) {
                                        var post;
                                        if (err) throw err;
                                        post = {
                                            verb: "post",
                                            object: doc
                                        };
                                        pj(feed, cred2, post, this);
                                    },
                                    function(err, act, resp) {
                                        if (err) {
                                            callback(err, null);
                                        } else {
                                            callback(null, act);
                                        }
                                    }
                                );
                            },
                            "it works": function(err, act) {
                                assert.ifError(err);
                                assert.isObject(act);
                            },
                            "and we wait a few seconds for delivery": {
                                topic: function() {
                                    var callback = this.callback;
                                    setTimeout(function() { callback(null); }, 2000);
                                },
                                "it works": function(err) {
                                    assert.ifError(err);
                                },
                                "and we check the first user's inbox": {
                                    topic: function(posted, followed, cred1, cred2) {
                                        var callback = this.callback,
                                            url = "http://social.localhost/api/user/colin/inbox";

                                        gj(url, cred1, function(err, feed, resp) {
                                            if (err) {
                                                callback(err, null, null);
                                            } else {
                                                callback(null, feed, posted);
                                            }
                                        });
                                    },
                                    "it works": function(err, feed, act) {
                                        assert.ifError(err);
                                        assert.isObject(feed);
                                        assert.isObject(act);
                                    },
                                    "the activity includes proxy URLs": function(err, feed, act) {

                                        var fi0;

                                        assert.ifError(err);
                                        assert.isObject(feed);
                                        assert.isObject(act);
                                        assert.include(feed, "items");
                                        assert.isArray(feed.items);
                                        assert.greater(feed.items.length, 0);

                                        fi0 = _.find(feed.items, function(item) { return item.id == act.id; });

                                        assert.isObject(fi0);

                                        assertProxyURL(fi0, "object");
                                        assertProxyURL(fi0.object, "likes");
                                        assertProxyURL(fi0.object, "replies");
                                        assertProxyURL(fi0.object, "shares");
                                        assertProxyURL(fi0.object, "image");
                                        assertProxyURL(fi0.object, "fullImage");
                                    },
                                    "and we get the image proxyURL": {
                                        topic: function(feed, posted, postedBefore, followed, cred1, cred2) {
                                            var callback = this.callback,
                                                fi0 = _.find(feed.items, function(item) { return item.id == posted.id; }),
                                                url = fi0.object.image.pump_io.proxyURL,
                                                oa;

                                            oa = httputil.newOAuth(url, cred1);

                                            oa.get(url, cred1.token, cred1.token_secret, function(err, data, response) {
                                                callback(err, data);
                                            });
                                        },
                                        "it works": function(err, data) {
                                            assert.ifError(err);
                                            assert.isString(data);
                                        }
                                    },
                                    "and we get the replies proxyURL": {
                                        topic: function(feed, posted, postedBefore, followed, cred1, cred2) {
                                            var callback = this.callback,
                                                fi0 = _.find(feed.items, function(item) { return item.id == posted.id; }),
                                                url = fi0.object.replies.pump_io.proxyURL,
                                                oa;

                                            gj(url, cred1, function(err, replies, resp) {
                                                callback(err, replies);
                                            });
                                        },
                                        "it works": function(err, data) {
                                            assert.ifError(err);
                                            assert.isObject(data);
                                        }
                                    }
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
