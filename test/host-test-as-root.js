// host-test-as-root.js
//
// Online test of the Host module
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
    querystring = require("querystring"),
    _ = require("underscore"),
    fs = require("fs"),
    path = require("path"),
    express = require("express"),
    Browser = require("zombie"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    DialbackClient = require("dialback-client"),
    databank = require("databank"),
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    Host = require("../lib/model/host").Host,
    Credentials = require("../lib/model/credentials").Credentials,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupAppConfig = oauthutil.setupAppConfig,
    register = oauthutil.register,
    authorize = oauthutil.authorize;

var suite = vows.describe("host module interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var tinyApp = function(port, hostname, callback) {

    var app = express.createServer(),
        authcb = null;

    app.configure(function(){
        app.set("port", port);
        app.use(express.bodyParser());
        app.use(express.query());
        app.use(app.router);
    });

    app.setAuthCB = function(cb) {
        authcb = cb;
    };

    app.get("/.well-known/host-meta.json", function(req, res) {
        res.json({
            links: [
                {
                    rel: "lrdd",
                    type: "application/json",
                    template: "http://"+hostname+"/lrdd.json?uri={uri}"
                },
                {
                    rel: "dialback",
                    href: "http://"+hostname+"/api/dialback"
                }
            ]
        });
    });

    app.get("/lrdd.json", function(req, res) {
        var uri = req.query.uri,
            parts = uri.split("@"),
            username = parts[0],
            hostname = parts[1];

        res.json({
            links: [
                {
                    rel: "dialback",
                    href: "http://"+hostname+"/api/dialback"
                }
            ]
        });
    });

    app.get("/lrdd.json", function(req, res) {
        var uri = req.query.uri,
            parts = uri.split("@"),
            username = parts[0],
            hostname = parts[1];

        res.json({
            links: [
                {
                    rel: "dialback",
                    href: "http://"+hostname+"/api/dialback"
                }
            ]
        });
    });

    app.get("/main/authorized/:hostname", function(req, res) {
        if (authcb) {
            authcb(null, req.query.oauth_verifier);
            authcb = null;
        }
        res.send("OK");
    });

    app.on("error", function(err) {
        callback(err, null);
    });

    app.listen(port, hostname, function() {
        callback(null, app);
    });
};

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            var app,
                callback = this.callback,
                db = Databank.get(tc.driver, tc.params);

            Step(
                function() {
                    db.connect({}, this);
                },
                function(err) {
                    if (err) throw err;
                    DatabankObject.bank = db;
                    setupAppConfig({port: 80, hostname: "social.localhost", driver: "memory", params: {}}, this);
                },
                function(err, result) {
                    if (err) throw err;
                    app = result;
                    tinyApp(80, "dialback.localhost", this);
                },
                function(err, dbapp) {
                    var dialbackClient;
                    if (err) {
                        callback(err, null, null);
                    } else {
                        URLMaker.hostname = "dialback.localhost";
                        Credentials.dialbackClient = new DialbackClient({
                            hostname: "dialback.localhost",
                            bank: db,
                            app: dbapp,
                            url: "/api/dialback"
                        });
                        callback(err, app, dbapp);
                    }
                }
            );
        },
        teardown: function(app, dbapp) {
            app.close();
            dbapp.close();
        },
        "it works": function(err, app, dbapp) {
            assert.ifError(err);
        },
        "and we ensure an invalid host": {
            topic: function() {
                var callback = this.callback;

                Host.ensureHost("other.invalid",
                                function(err, cred) {
                                    if (err) {
                                        callback(null);
                                    } else {
                                        callback(new Error("Unexpected success"));
                                    }
                                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we ensure a valid host": {
            topic: function() {
                var callback = this.callback;

                Host.ensureHost("social.localhost", callback);
            },
            "it works": function(err, host) {
                assert.ifError(err);
                assert.isObject(host);
            },
            "and we check its properties": function(err, host) {
                assert.ifError(err);
                assert.isObject(host);
                assert.isString(host.hostname);
                assert.isString(host.registration_endpoint);
                assert.isString(host.request_token_endpoint);
                assert.isString(host.access_token_endpoint);
                assert.isString(host.authorization_endpoint);
                assert.isString(host.whoami_endpoint);
                assert.isNumber(host.created);
                assert.isNumber(host.modified);
            },
            "and we ensure the same host again": {
                topic: function(host) {
                    var callback = this.callback;

                    Host.ensureHost(host.hostname, function(err, dupe) {
                        callback(err, dupe, host);
                    });
                },
                "it works": function(err, dupe, host) {
                    assert.ifError(err);
                    assert.isObject(dupe);
                    assert.isObject(host);
                },
                "and we check its properties": function(err, dupe, host) {
                    assert.ifError(err);
                    assert.isObject(host);
                    assert.isObject(dupe);
                    assert.deepEqual(dupe, host);
                }
            },
            "and we get a request token": {
                topic: function(host) {
                    host.getRequestToken(this.callback);
                },
                "it works": function(err, rt) {
                    assert.ifError(err);
                    assert.isObject(rt);
                },
                "and we get the authorization url": {
                    topic: function(rt, host) {
                        return host.authorizeURL(rt);
                    },
                    "it works": function(url) {
                        assert.isString(url);
                    }
                },
                "and we authorize the request token": {
                    topic: function(rt, host, app, dbapp) {
                        var callback = this.callback,
                            browser = new Browser({runScripts: false, waitFor: 60000}),
                            cl;

                        Step(
                            function() {
                                Credentials.getForHost("social.localhost", host, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                cl = results;
                                register(cl, "seth", "Aegh0eex", "social.localhost", 80, this);
                            },
                            function(err, user) {
                                if (err) throw err;
                                browser.visit(host.authorizeURL(rt), this);
                            },
                            function(err) {
                                if (err) throw err;
                                if (!browser.success) throw new Error("Browser fail");
                                browser.fill("username", "seth", this);
                            },
                            function(err) {
                                if (err) throw err;
                                if (!browser.success) throw new Error("Browser fail");
                                browser.fill("password", "Aegh0eex", this);
                            },
                            function(err) {
                                if (err) throw err;
                                if (!browser.success) throw new Error("Browser fail");
                                browser.pressButton("#authenticate", this);
                            },
                            function(err) {
                                if (err) throw err;
                                if (!browser.success) throw new Error("Browser fail");
                                dbapp.setAuthCB(this.parallel());
                                browser.pressButton("Authorize", this.parallel());
                            },
                            function(err, verifier, br) {
                                callback(err, verifier);
                            }
                        );
                    },
                    "it works": function(err, verifier) {
                        assert.ifError(err);
                        assert.isString(verifier);
                    },
                    "and we get the access token": {
                        topic: function(verifier, rt, host) {
                            host.getAccessToken(rt, verifier, this.callback);
                        },
                        "it works": function(err, pair) {
                            assert.ifError(err);
                            assert.isObject(pair);
                            assert.isString(pair.token);
                            assert.isString(pair.secret);
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
