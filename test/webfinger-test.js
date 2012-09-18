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

var webfinger = {
    links: [
        {
            rel: "http://webfinger.net/rel/profile-page",
            type: "text/html",
            href: "http://localhost:4815/alice"
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
            rel: "dialback",
            href: "http://localhost:4815/api/dialback"
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
        "and we check the lrdd.json endpoint": 
        httputil.endpoint("/api/lrdd.json", ["GET"]),
        "and we get the lrdd endpoint with no uri":
        httputil.getfail("/api/lrdd", 400),
        "and we get the lrdd endpoint with an empty uri":
        httputil.getfail("/api/lrdd?uri=", 404),
        "and we get the lrdd endpoint with an HTTP URI at some other domain":
        httputil.getfail("/api/lrdd?uri=http://photo.example/evan", 404),
        "and we get the lrdd endpoint with a Webfinger at some other domain":
        httputil.getfail("/api/lrdd?uri=evan@photo.example", 404),
        "and we get the lrdd endpoint with a Webfinger of a non-existent user":
        httputil.getfail("/api/lrdd.json?uri=evan@localhost", 404),
        "and we get the lrdd.json endpoint with no uri":
        httputil.getfail("/api/lrdd.json", 400),
        "and we get the lrdd.json endpoint with an empty uri":
        httputil.getfail("/api/lrdd.json?uri=", 404),
        "and we get the lrdd.json endpoint with an HTTP URI at some other domain":
        httputil.getfail("/api/lrdd.json?uri=http://photo.example/evan", 404),
        "and we get the lrdd.json endpoint with a Webfinger at some other domain":
        httputil.getfail("/api/lrdd.json?uri=evan@photo.example", 404),
        "and we get the lrdd.json endpoint with a Webfinger of a non-existent user":
        httputil.getfail("/api/lrdd.json?uri=evan@localhost", 404),
        "and we register a client and user": {
            topic: function() {
                oauthutil.newCredentials("alice", "testpass", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
            },
            "and we test the lrdd endpoint":
            xrdutil.xrdContext("http://localhost:4815/api/lrdd?uri=alice@localhost",
                               webfinger),
            "and we test the lrdd.json endpoint":
            xrdutil.jrdContext("http://localhost:4815/api/lrdd.json?uri=alice@localhost",
                               webfinger)
        }
    }
});

suite["export"](module);
