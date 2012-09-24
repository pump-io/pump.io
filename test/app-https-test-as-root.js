// app-https-test-as-root.js
//
// Test running the app over HTTPS
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
    fs = require("fs"),
    path = require("path"),
    databank = require("databank"),
    Step = require("step"),
    http = require("http"),
    https = require("https"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    xrdutil = require("./lib/xrd");

var suite = vows.describe("smoke test app interface over https");

var clientCred = function(cl) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret
    };
};

// hostmeta links

var hostmeta = {
    links: [{rel: "lrdd",
             type: "application/xrd+xml",
             template: /{uri}/},
            {rel: "lrdd",
             type: "application/json",
             template: /{uri}/},
            {rel: "registration_endpoint",
             href: "https://social.localhost/api/client/register"
            },
            {rel: "dialback",
             href: "https://social.localhost/api/dialback"}]
};

var webfinger = {
    links: [
        {
            rel: "http://webfinger.net/rel/profile-page",
            type: "text/html",
            href: "https://social.localhost/caterpillar"
        },
        {
            rel: "activity-inbox",
            href: "https://social.localhost/api/user/caterpillar/inbox"
        },
        {
            rel: "activity-outbox",
            href: "https://social.localhost/api/user/caterpillar/feed"
        },
        {
            rel: "dialback",
            href: "https://social.localhost/api/dialback"
        }
    ]
};

suite.addBatch({
    "When we makeApp()": {
        topic: function() {
            var config = {port: 443,
                          hostname: "social.localhost",
                          key: path.join(__dirname, "data", "social.localhost.key"),
                          cert: path.join(__dirname, "data", "social.localhost.crt"),
                          driver: "memory",
                          params: {},
                          nologger: true
                         },
                makeApp = require("../lib/app").makeApp;

            process.env.NODE_ENV = "test";

            makeApp(config, this.callback);
        },
        "it works": function(err, app) {
            assert.ifError(err);
            assert.isObject(app);
        },
        "and we app.run()": {
            topic: function(app) {
                var cb = this.callback;
                app.run(function(err) {
                    if (err) {
                        cb(err, null);
                    } else {
                        cb(null, app);
                    }
                });
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "app is listening on correct port": function(err, app) {
                var addr = app.address();
                assert.equal(addr.port, 443);
            },
            "and we GET the host-meta file": 
            xrdutil.xrdContext("https://social.localhost/.well-known/host-meta",
                               hostmeta),
            "and we GET the host-meta.json file":
            xrdutil.jrdContext("https://social.localhost/.well-known/host-meta.json",
                               hostmeta),
            "and we register a new client": {
                topic: function() {
                    oauthutil.newClient("social.localhost", 443, this.callback);
                },
                "it works": function(err, cred) {
                    assert.ifError(err);
                    assert.isObject(cred);
                    assert.include(cred, "client_id");
                    assert.include(cred, "client_secret");
                    assert.include(cred, "expires_at");
                },
                "and we register a new user": {
                    topic: function(cl) {
                        oauthutil.register(cl, "caterpillar", "mush+room", "social.localhost", 443, this.callback);
                    },
                    "it works": function(err, user) {
                        assert.ifError(err);
                        assert.isObject(user);
                    },
                    "and we test the lrdd endpoint":
                    xrdutil.xrdContext("https://social.localhost/api/lrdd?uri=caterpillar@social.localhost",
                                       webfinger),
                    "and we test the lrdd.json endpoint":
                    xrdutil.jrdContext("https://social.localhost/api/lrdd.json?uri=caterpillar@social.localhost",
                                       webfinger),
                    "and we get the user": {
                        topic: function(user, cl) {
                            var url = "https://social.localhost/api/user/caterpillar";
                            httputil.getJSON(url, clientCred(cl), this.callback);
                        },
                        "it works": function(err, body, resp) {
                            assert.ifError(err);
                            assert.isObject(body);
                        }
                    },
                    "and we get a new request token": {
                        topic: function(user, cl) {
                            oauthutil.requestToken(cl, "social.localhost", 443, this.callback);
                        },
                        "it works": function(err, rt) {
                            assert.ifError(err);
                            assert.isObject(rt);
                        },
                        "and we authorize the request token": {
                            topic: function(rt, user, cl) {
                                oauthutil.authorize(cl,
                                                    rt,
                                                    {nickname: "caterpillar", password: "mush+room"},
                                                    "social.localhost",
                                                    443,
                                                    this.callback); 
                            },
                            "it works": function(err, verifier) {
                                assert.ifError(err);
                                assert.isString(verifier);
                            },
                            "and we get an access token": {
                                topic: function(verifier, rt, user, cl) {
                                    oauthutil.redeemToken(cl,
                                                          rt,
                                                          verifier,
                                                          "social.localhost",
                                                          443,
                                                          this.callback);
                                },
                                "it works": function(err, pair) {
                                    assert.ifError(err);
                                    assert.isObject(pair);
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