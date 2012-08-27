// .well-known/host-meta
//
// Copyright 2012 StatusNet Inc.
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
    setupApp = oauthutil.setupApp;

var suite = vows.describe("host meta test");

// A batch to test following/unfollowing users

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
        httputil.getfail("/api/lrdd?uri=", 400),
        "and we get the lrdd endpoint with an HTTP URI at some other domain":
        httputil.getfail("/api/lrdd?uri=http://photo.example/evan", 400),
        "and we get the lrdd endpoint with a Webfinger at some other domain":
        httputil.getfail("/api/lrdd?uri=evan@photo.example", 400),
        "and we get the lrdd endpoint with a Webfinger of a non-existent user":
        httputil.getfail("/api/lrdd.json?uri=evan@localhost", 400),
        "and we get the lrdd.json endpoint with no uri":
        httputil.getfail("/api/lrdd.json", 400),
        "and we get the lrdd.json endpoint with an empty uri":
        httputil.getfail("/api/lrdd.json?uri=", 400),
        "and we get the lrdd.json endpoint with an HTTP URI at some other domain":
        httputil.getfail("/api/lrdd.json?uri=http://photo.example/evan", 400),
        "and we get the lrdd.json endpoint with a Webfinger at some other domain":
        httputil.getfail("/api/lrdd.json?uri=evan@photo.example", 400),
        "and we get the lrdd.json endpoint with a Webfinger of a non-existent user":
        httputil.getfail("/api/lrdd.json?uri=evan@localhost", 400)
    }
});

suite["export"](module);
