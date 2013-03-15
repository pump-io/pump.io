// credentials-test-as-root.js
//
// Online test of the Credentials module
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
    DialbackClient = require("dialback-client"),
    databank = require("databank"),
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    Credentials = require("../lib/model/credentials").Credentials,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupAppConfig = oauthutil.setupAppConfig;

var suite = vows.describe("credentials module interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var tinyApp = function(port, hostname, callback) {

    var app = express.createServer();

    app.configure(function(){
        app.set("port", port);
        app.use(express.bodyParser());
        app.use(app.router);
    });

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
        "and we try to get credentials for an invalid user": {
            topic: function() {
                var callback = this.callback;

                Credentials.getFor("acct:user8@something.invalid",
                                   "http://social.localhost/api/user/frank/inbox",
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
        "and we try to get host credentials for a valid user": {
            topic: function() {
                var callback = this.callback;

                Credentials.getForHostname("acct:user2@dialback.localhost",
                                           "social.localhost",
                                           callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "results include client_id and client_secret": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.include(cred, "client_id");
                assert.include(cred, "client_secret");
            }
        },
        "and we try to get host credentials for a valid host": {
            topic: function() {
                var callback = this.callback;

                Credentials.getForHostname("dialback.localhost",
                                           "social.localhost",
                                           callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "results include client_id and client_secret": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.include(cred, "client_id");
                assert.include(cred, "client_secret");
            }
        },
        "and we try to get host credentials for a valid Host object": {
            topic: function() {
                var callback = this.callback,
                    Host = require("../lib/model/host").Host;

                Step(
                    function() {
                        Host.ensureHost("social.localhost", this);
                    },
                    function(err, host) {
                        if (err) throw err;
                        Credentials.getForHost("acct:user3@dialback.localhost",
                                               host,
                                               this);
                    },
                    callback
                );
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "results include client_id and client_secret": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.include(cred, "client_id");
                assert.include(cred, "client_secret");
            }
        },
        "and we try to get credentials for a valid user": {
            topic: function() {
                var callback = this.callback;

                Credentials.getFor("acct:user1@dialback.localhost",
                                   "http://social.localhost/api/user/frank/inbox",
                                   callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "results include client_id and client_secret": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.include(cred, "client_id");
                assert.include(cred, "client_secret");
            },
            "and we try to get credentials for the same user again": {
                topic: function(cred1) {
                    var callback = this.callback;

                    Credentials.getFor("acct:user1@dialback.localhost",
                                       "http://social.localhost/api/user/frank/inbox",
                                       function(err, cred2) {
                                           callback(err, cred1, cred2);
                                       });
                },
                "it works": function(err, cred1, cred2) {
                    assert.ifError(err);
                    assert.isObject(cred2);
                },
                "results include client_id and client_secret": function(err, cred1, cred2) {
                    assert.ifError(err);
                    assert.isObject(cred2);
                    assert.include(cred2, "client_id");
                    assert.include(cred2, "client_secret");
                },
                "results include same client_id and client_secret": function(err, cred1, cred2) {
                    assert.ifError(err);
                    assert.isObject(cred2);
                    assert.equal(cred2.client_id, cred1.client_id);
                    assert.equal(cred2.client_secret, cred1.client_secret);
                }
            }
        }
    }
});

suite["export"](module);
