// lrdd.js
//
// Tests the LRDD XRD endpoint
// 
// Copyright 2012 E14N https://e14n.com/
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
    xml2js = require("xml2js"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("underscore"),
    querystring = require("querystring"),
    http = require("http"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    xrdutil = require("./lib/xrd"),
    actutil = require("./lib/activity"),
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    validActivity = actutil.validActivity,
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials;

var suite = vows.describe("LRDD test");

var webfinger = {
    links: [
        {
            rel: "http://webfinger.net/rel/profile-page",
            type: "text/html",
            href: "http://localhost:4815/alice"
        },
        {
            rel: "dialback",
            href: "http://localhost:4815/api/dialback"
        },
        {
            rel: "self",
            href: "http://localhost:4815/api/user/alice/profile"
        },
        {
            rel: "activity-inbox",
            href: "http://localhost:4815/api/user/alice/inbox"
        },
        {
            rel: "activity-outbox",
            href: "http://localhost:4815/api/user/alice/feed"
        },
        {
            rel: "followers",
            href: "http://localhost:4815/api/user/alice/followers"
        },
        {
            rel: "following",
            href: "http://localhost:4815/api/user/alice/following"
        },
        {
            rel: "favorites",
            href: "http://localhost:4815/api/user/alice/favorites"
        },
        {
            rel: "lists",
            href: "http://localhost:4815/api/user/alice/lists/person"
        }
    ]
};

// A batch to test endpoints

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
        "and we check the lrdd endpoint": 
        httputil.endpoint("/api/lrdd", ["GET"]),
        "and we get the lrdd endpoint with no uri":
        httputil.getfail("/api/lrdd", 400),
        "and we get the lrdd endpoint with an empty uri":
        httputil.getfail("/api/lrdd?resource=", 404),
        "and we get the lrdd endpoint with an HTTP URI at some other domain":
        httputil.getfail("/api/lrdd?resource=http://photo.example/evan", 404),
        "and we get the lrdd endpoint with a Webfinger at some other domain":
        httputil.getfail("/api/lrdd?resource=evan@photo.example", 404),
        "and we get the lrdd endpoint with a Webfinger of a non-existent user":
        httputil.getfail("/api/lrdd?resource=evan@localhost", 404)
    }
});

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
        "and we register a client and user": {
            topic: function() {
                newCredentials("alice", "test+pass", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
            },
            "and we test the lrdd endpoint":
            xrdutil.xrdContext("http://localhost:4815/api/lrdd?resource=alice@localhost",
                               webfinger),
            "and we test the lrdd endpoint with an acct: URI":
            xrdutil.xrdContext("http://localhost:4815/api/lrdd?resource=acct:alice@localhost",
                               webfinger),
            "and they create a group": {
                topic: function(cred) {
                    var url = "http://localhost:4815/api/user/alice/feed",
                        callback = this.callback,
                        act = {
                            verb: "create",
                            object: {
                                displayName: "Caterpillars",
                                objectType: "group"
                            }
                        };

                    pj(url, cred, act, function(err, body, resp) {
                        callback(err, body);
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                    validActivity(act);
                },
                "and we test the lrdd endpoint with the group ID": {
                    topic: function(act, cred) {
                        var url = "http://localhost:4815/api/lrdd?resource="+act.object.id,
                            callback = this.callback,
                            req;

                        req = http.request(url, function(res) {
                            var body = "";
                            res.setEncoding("utf8");
                            res.on("data", function(chunk) {
                                body = body + chunk;
                            });
                            res.on("error", function(err) {
                                callback(err, null);
                            });
                            res.on("end", function() {
                                var parser = new xml2js.Parser();
                                parser.parseString(body, function(err, doc) {
                                    if (err) {
                                        callback(err, null);
                                    } else {
                                        callback(null, doc);
                                    }
                                });
                            });
                        });

                        req.on("error", function(err) {
                            callback(err, null);
                        });

                        req.end();
                    },
                    "it works": function(err, obj) {
                        assert.ifError(err);
                        assert.isObject(obj);
                    }
                }
            }
        }
    }
});

suite["export"](module);
