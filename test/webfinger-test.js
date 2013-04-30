// webfinger.js
//
// Tests the Webfinger XRD and JRD endpoints
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
    setupApp = oauthutil.setupApp;

var suite = vows.describe("webfinger/LRDD test");

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
        "and we check the webfinger endpoint": 
        httputil.endpoint("/.well-known/webfinger", ["GET"]),
        "and we get the lrdd endpoint with no uri":
        httputil.getfail("/api/lrdd", 400),
        "and we get the lrdd endpoint with an empty uri":
        httputil.getfail("/api/lrdd?resource=", 404),
        "and we get the lrdd endpoint with an HTTP URI at some other domain":
        httputil.getfail("/api/lrdd?resource=http://photo.example/evan", 404),
        "and we get the lrdd endpoint with a Webfinger at some other domain":
        httputil.getfail("/api/lrdd?resource=evan@photo.example", 404),
        "and we get the lrdd endpoint with a Webfinger of a non-existent user":
        httputil.getfail("/.well-known/webfinger?resource=evan@localhost", 404),
        "and we get the webfinger endpoint with no uri":
        httputil.getfail("/.well-known/webfinger", 400),
        "and we get the webfinger endpoint with an empty uri":
        httputil.getfail("/.well-known/webfinger?resource=", 404),
        "and we get the webfinger endpoint with an HTTP URI at some other domain":
        httputil.getfail("/.well-known/webfinger?resource=http://photo.example/evan", 404),
        "and we get the webfinger endpoint with a Webfinger at some other domain":
        httputil.getfail("/.well-known/webfinger?resource=evan@photo.example", 404),
        "and we get the webfinger endpoint with a Webfinger of a non-existent user":
        httputil.getfail("/.well-known/webfinger?resource=evan@localhost", 404),
        "and we register a client and user": {
            topic: function() {
                oauthutil.newCredentials("alice", "test+pass", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
            },
            "and we test the lrdd endpoint":
            xrdutil.xrdContext("http://localhost:4815/api/lrdd?resource=alice@localhost",
                               webfinger),
            "and we test the webfinger endpoint":
            xrdutil.jrdContext("http://localhost:4815/.well-known/webfinger?resource=alice@localhost",
                               webfinger)
        }
    }
});

suite["export"](module);
