// spamicity-test.js
//
// Test the spamicity settings
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

var fs = require("fs"),
    path = require("path"),
    assert = require("assert"),
    express = require("express"),
    vows = require("vows"),
    Step = require("step"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    newClient = oauthutil.newClient,
    newCredentials = oauthutil.newCredentials,
    setupAppConfig = oauthutil.setupAppConfig;

var suite = vows.describe("spamicity module interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch({
    "When we set up an activity spam dummy server": {
        topic: function() {
            var app = express.createServer(express.bodyParser()),
                callback = this.callback;
            app.post("/is-this-spam", function(req, res, next) {
                if (app.callback) {
                    app.callback(null, req.body);
                }
                if (app.isSpam) {
                    res.json({
                        probability: 0.999,
                        isSpam: true,
                        bestKeys: [["a", 0.999],
                                   ["b", 0.999],
                                   ["c", 0.999],
                                   ["d", 0.999],
                                   ["e", 0.999],
                                   ["f", 0.999],
                                   ["g", 0.999],
                                   ["h", 0.999],
                                   ["i", 0.999],
                                   ["j", 0.999],
                                   ["k", 0.999],
                                   ["l", 0.999],
                                   ["m", 0.999],
                                   ["n", 0.999],
                                   ["o", 0.999]]
                    });
                } else {
                    res.json({
                        probability: 0.001,
                        isSpam: false,
                        bestKeys: [["a", 0.001],
                                   ["b", 0.001],
                                   ["c", 0.001],
                                   ["d", 0.001],
                                   ["e", 0.001],
                                   ["f", 0.001],
                                   ["g", 0.001],
                                   ["h", 0.001],
                                   ["i", 0.001],
                                   ["j", 0.001],
                                   ["k", 0.001],
                                   ["l", 0.001],
                                   ["m", 0.001],
                                   ["n", 0.001],
                                   ["o", 0.001]]
                    });
                }
            });
            app.post("/this-is-spam", function(req, res, next) {
                if (app.callback) {
                    app.callback(null, req.body);
                }
                res.json({
                    cat: "spam",
                    object: {},
                    date: Date.now(),
                    elapsed: 100,
                    hash: "1234567890123456789012"
                });
            });
            app.post("/this-is-ham", function(req, res, next) {
                if (app.callback) {
                    app.callback(null, req.body);
                }
                res.json({
                    cat: "ham",
                    object: {},
                    date: Date.now(),
                    elapsed: 100,
                    hash: "1234567890123456789012"
                });
            });
            app.listen(80, "activityspam.localhost", function() {
                callback(null, app);
            });
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "and we start a pump app with the spam server configured": {
            topic: function(spam) {
                setupAppConfig({port: 80, 
                                hostname: "social.localhost", 
                                driver: tc.driver,
                                spamhost: "http://activityspam.localhost",
                                spamclientid: "AAAAAAAAA",
                                spamclientsecret: "BBBBBBBB",
                                params: tc.params},
                               this.callback);
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "and we get new credentials": {
                topic: function(social, spam) {
                    newCredentials("ann", "1day@atime", "social.localhost", 80, this.callback);
                },
                "it works": function(err, cred) {
                    assert.ifError(err);
                    assert.isObject(cred);
                },
                "and we post a non-spam activity from a local user": {
                    topic: function(cred, social, spam) {
                        var callback = this.callback;

                        Step(
                            function() {
                                spam.isSpam   = false;
                                spam.callback = this.parallel();
                                httputil.postJSON("http://social.localhost/api/user/ann/feed",
                                                  cred,
                                                  {
                                                      verb: "post",
                                                      object: {
                                                          objectType: "note",
                                                          content: "This is it."
                                                      }
                                                  },
                                                  this.parallel());
                            },
                            callback
                        );
                    },
                    "it works": function(err, tested, result) {
                        assert.ifError(err);
                        assert.isObject(tested);
                        assert.isObject(result);
                    },
                    "and we post a spam activity from a local user": {
                        topic: function(tested, result, cred, social, spam) {
                            var callback = this.callback;

                            Step(
                                function() {
                                    spam.isSpam   = true;
                                    spam.callback = this.parallel();
                                    httputil.postJSON("http://social.localhost/api/user/ann/feed",
                                                      cred,
                                                      {
                                                          verb: "post",
                                                          object: {
                                                              objectType: "note",
                                                              content: "Just keep doing what you do."
                                                          }
                                                      },
                                                      this.parallel());
                                },
                                function(err, body, resp) {
                                    if (err && err.statusCode == 400) {
                                        callback(null);
                                    } else if (err) {
                                        callback(err);
                                    } else {
                                        callback(new Error("Unexpected success"));
                                    }
                                }
                            );
                        },
                        "it fails correctly": function(err) {
                            assert.ifError(err);
                        }
                    }
                }
            }
        },
        "and we start a pump app with no spam server configured": {
            topic: function(spam) {
                setupAppConfig({port: 80, 
                                hostname: "photo.localhost", 
                                driver: tc.driver,
                                params: tc.params},
                               this.callback);
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "and we get new credentials": {
                topic: function(photo, spam) {
                    newCredentials("julie", "1day@atime", "photo.localhost", 80, this.callback);
                },
                "it works": function(err, cred) {
                    assert.ifError(err);
                    assert.isObject(cred);
                },
                "and we post a non-spam activity from a local user": {
                    topic: function(cred, photo, spam) {
                        var callback = this.callback;

                        httputil.postJSON("http://photo.localhost/api/user/julie/feed",
                                          cred,
                                          {
                                              verb: "post",
                                              object: {
                                                  objectType: "note",
                                                  content: "This is it."
                                              }
                                          },
                                          callback);
                    },
                    "it works": function(err, body, result) {
                        assert.ifError(err);
                        assert.isObject(body);
                        assert.isObject(result);
                    }
                }
            }
        }
    }
});

suite["export"](module);
