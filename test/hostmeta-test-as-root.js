// .well-known/host-meta
//
// Copyright 2012 E14N https://e14n.com/
//
// "I never met a host I didn't like"
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
    actutil = require("./lib/activity"),
    xrdutil = require("./lib/xrd"),
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
             href: "http://social.localhost/api/client/register"
            },
            {rel: "http://apinamespace.org/oauth/request_token",
             href: "http://social.localhost/oauth/request_token"
            },
            {rel: "http://apinamespace.org/oauth/authorize",
             href: "http://social.localhost/oauth/authorize"
            },
            {rel: "http://apinamespace.org/oauth/access_token",
             href: "http://social.localhost/oauth/access_token"
            },
            {rel: "dialback",
             href: "http://social.localhost/api/dialback"},
            {rel: "http://apinamespace.org/activitypub/whoami",
             href: "http://social.localhost/api/whoami"}
           ]
};

// A batch to test hostmeta functions

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
        "and we use the webfinger library": {
            topic: function() {
                wf.hostmeta("social.localhost", this.callback);
            },
            "it works": function(err, jrd) {
                assert.ifError(err);
            },
            "it has the right links": xrdutil.jrdLinkCheck(hostmeta)
        }
    }
});

suite["export"](module);
