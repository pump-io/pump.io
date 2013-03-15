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
             href: "http://localhost:4815/api/client/register"
            },
            {rel: "http://apinamespace.org/oauth/request_token",
             href: "http://localhost:4815/oauth/request_token"
            },
            {rel: "http://apinamespace.org/oauth/authorize",
             href: "http://localhost:4815/oauth/authorize"
            },
            {rel: "http://apinamespace.org/oauth/access_token",
             href: "http://localhost:4815/oauth/access_token"
            },
            {rel: "dialback",
             href: "http://localhost:4815/api/dialback"},
            {rel: "http://apinamespace.org/activitypub/whoami",
             href: "http://localhost:4815/api/whoami"}
           ]
};

// A batch to test hostmeta functions

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
        "and we check the host-meta endpoint": 
        httputil.endpoint("/.well-known/host-meta", ["GET"]),
        "and we check the host-meta.json endpoint": 
        httputil.endpoint("/.well-known/host-meta.json", ["GET"]),
        "and we GET the host-meta file": 
        xrdutil.xrdContext("http://localhost:4815/.well-known/host-meta",
                   hostmeta),
        "and we GET the host-meta.json file":
        xrdutil.jrdContext("http://localhost:4815/.well-known/host-meta.json",
                   hostmeta),
        "and we GET the host-meta accepting JSON": {
            topic: function() {
                var callback = this.callback;
                var options = {
                    host: "localhost",
                    port: "4815",
                    path: "/.well-known/host-meta",
                    headers: {
                        accept: "application/json,*/*"
                    }
                };
                var req = http.request(options, function(res) {
                    var body = "";
                    if (res.statusCode !== 200) {
                        callback(new Error("Bad status code"), null, null);
                    } else {
                        res.setEncoding("utf8");
                        res.on("data", function(chunk) {
                            body = body + chunk;
                        });
                        res.on("error", function(err) {
                            callback(err, null, null);
                        });
                        res.on("end", function() {
                            var doc;
                            try {
                                doc = JSON.parse(body);
                                callback(null, doc, res);
                            } catch (err) {
                                callback(err, null, null);
                            }
                        });
                    }
                });
                req.end();
            },
            "it works": function(err, doc, res) {
                assert.ifError(err);
            },
            "it has a JSON content type": xrdutil.typeCheck("application/json; charset=utf-8"),
            "it has lrdd template links": xrdutil.jrdLinkCheck(hostmeta)
        }
    }
});

suite["export"](module);
