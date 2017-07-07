// user-following-api-search-test.js
//
// Test searching the following endpoint
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
    querystring = require("querystring"),
    http = require("http"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    actutil = require("./lib/activity"),
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    withAppSetup = apputil.withAppSetup,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    register = oauthutil.register,
    validFeed = actutil.validFeed,
    validActivityObject = actutil.validActivityObject;

var ignore = function(err) {};

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var suite = vows.describe("User stream search test");

// A batch for testing the read access to the API

suite.addBatch(
    withAppSetup({
        "and we make a new client": {
            topic: function() {
                newClient(this.callback);
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and we register a new user": {
                topic: function(cl) {
                    newPair(cl, "staggerlee", "wrong'emboyo", this.callback);
                },
                "it works": function(err, pair) {
                    assert.ifError(err);
                    assert.isObject(pair);
                },
                "and they follow a lot of people": {
                    topic: function(pair, cl) {

                        var callback = this.callback,
                            cred = makeCred(cl, pair),
                            registerAndFollow = function(nickname, password, callback) {
                                Step(
                                    function() {
                                        register(cl, nickname, password, this);
                                    },
                                    function(err, user) {
                                        var act,
                                            url = "http://localhost:4815/api/user/staggerlee/feed";
                                        if (err) throw err;
                                        act = {
                                            verb: "follow",
                                            object: user.profile
                                        };
                                        pj(url, cred, act, this);
                                    },
                                    function(err, result) {
                                        callback(err);
                                    }
                                );
                            };

                        Step(
                            function() {
                                var group = this.group(), i;
                                for (i = 0; i < 100; i++) {
                                    registerAndFollow((i % 10 === 0) ? ("billy"+i) : ("trying"+i), "i_rolled_8", group());
                                }
                            },
                            function(err) {
                                callback(err);
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we request the following stream with a search parameter": {
                        topic: function(pair, cl) {
                            var callback = this.callback,
                                cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/staggerlee/following?q=billy";

                            gj(url, cred, function(err, body, resp) {
                                callback(err, body);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                        },
                        "it includes only the matching objects": function(err, feed) {
                            var i;
                            assert.ifError(err);
                            validFeed(feed);
                            assert.equal(feed.items.length, 10);
                            for (i = 0; i < 100; i += 10) {
                                /* jshint loopfunc: true */
                                assert.ok(_.some(feed.items, function(item) { return item.preferredUsername === ("billy"+i); }));
                            }
                        }
                    },
                    "and we request the following stream with a non-matching search parameter": {
                        topic: function(pair, cl) {
                            var callback = this.callback,
                                cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/staggerlee/following?q=thereisnomatchforthis";

                            gj(url, cred, function(err, body, resp) {
                                callback(err, body);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                        },
                        "it is empty": function(err, feed) {
                            var i;
                            assert.ifError(err);
                            validFeed(feed);
                            assert.equal(feed.items.length, 0);
                        }
                    }
                }
            },
            "and we register a different user": {
                topic: function(cl) {
                    newPair(cl, "rudie", "chicken-skin-suit", this.callback);
                },
                "it works": function(err, pair) {
                    assert.ifError(err);
                    assert.isObject(pair);
                },
                "and they follow a person": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            cred = makeCred(cl, pair),
                            user;

                        Step(
                            function() {
                                register(cl, "thedoctor", "for*a*purpose", this);
                            },
                            function(err, results) {
                                var ucred, url, act;
                                if (err) throw err;
                                user = results;
                                ucred = makeCred(cl, {token: user.token, token_secret: user.secret});
                                url = "http://localhost:4815/api/user/thedoctor/feed";
                                act = {
                                    verb: "update",
                                    object: {
                                        id: user.profile.id,
                                        objectType: "person",
                                        displayName: "Alimantado"
                                    }
                                };
                                pj(url, ucred, act, this);
                            },
                            function(err) {
                                if (err) throw err;
                                var act,
                                    url = "http://localhost:4815/api/user/rudie/feed";
                                if (err) throw err;
                                act = {
                                    verb: "follow",
                                    object: user.profile
                                };
                                pj(url, cred, act, this);
                            },
                            function(err) {
                                callback(err);
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we request the following stream with a search parameter": {
                        topic: function(pair, cl) {
                            var callback = this.callback,
                                cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/rudie/following?q=alim";

                            gj(url, cred, function(err, body, resp) {
                                callback(err, body);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                        },
                        "it includes only the matching objects": function(err, feed) {
                            var i;
                            assert.ifError(err);
                            validFeed(feed);
                            assert.equal(feed.items.length, 1);
                            assert.equal(feed.items[0].displayName, "Alimantado");
                        }
                    }
                }
            }
        }
    })
);

suite["export"](module);
