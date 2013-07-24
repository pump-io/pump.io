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
    wf = require("webfinger"),
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
            href: "http://social.localhost/whiterabbit"
        },
        {
            rel: "dialback",
            href: "http://social.localhost/api/dialback"
        },
        {
            rel: "self",
            href: "http://social.localhost/api/user/whiterabbit/profile"
        },
        {
            rel: "activity-inbox",
            href: "http://social.localhost/api/user/whiterabbit/inbox"
        },
        {
            rel: "activity-outbox",
            href: "http://social.localhost/api/user/whiterabbit/feed"
        },
        {
            rel: "followers",
            href: "http://social.localhost/api/user/whiterabbit/followers"
        },
        {
            rel: "following",
            href: "http://social.localhost/api/user/whiterabbit/following"
        },
        {
            rel: "favorites",
            href: "http://social.localhost/api/user/whiterabbit/favorites"
        },
        {
            rel: "lists",
            href: "http://social.localhost/api/user/whiterabbit/lists/person"
        }
    ]
};

// A batch to test endpoints

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupApp(80, "social.localhost", this.callback);
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
                oauthutil.newCredentials("whiterabbit", "late!late!late!", "social.localhost", 80, this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
            },
            "and we use the webfinger library": {
                topic: function() {
                    wf.webfinger("whiterabbit@social.localhost", this.callback);
                },
                "it works": function(err, jrd) {
                    assert.ifError(err);
                },
                "it has the right links": xrdutil.jrdLinkCheck(webfinger)
            }
        }
    }
});

suite["export"](module);
