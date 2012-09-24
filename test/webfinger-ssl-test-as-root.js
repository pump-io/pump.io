// webfinger.js
//
// Tests the Webfinger XRD and JRD endpoints
// 
// Copyright 2012 StatusNet Inc.
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
    path = require("path"),
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
    setupApp = oauthutil.setupApp;

var suite = vows.describe("host meta test");

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

// A batch to test endpoints

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
            "and we GET the host-meta file": 
            xrdutil.xrdContext("https://social.localhost/.well-known/host-meta",
                               hostmeta),
            "and we GET the host-meta.json file":
            xrdutil.jrdContext("https://social.localhost/.well-known/host-meta.json",
                               hostmeta),
            "and we register a new user": {
                topic: function() {
                    oauthutil.newCredentials("caterpillar", "mush+room", "social.localhost", 443, this.callback);
                },
                "it works": function(err, cred) {
                    assert.ifError(err);
                },
                "and we test the lrdd endpoint":
                xrdutil.xrdContext("https://social.localhost/api/lrdd?uri=caterpillar@social.localhost",
                                   webfinger),
                "and we test the lrdd.json endpoint":
                xrdutil.jrdContext("https://social.localhost/api/lrdd.json?uri=caterpillar@social.localhost",
                                   webfinger)
            }
        }
    }
});

suite["export"](module);
