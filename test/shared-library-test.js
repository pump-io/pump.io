// shared-library-test.js
//
// Test that files used server- and client-side shared correctly
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
    http = require("http"),
    oauthutil = require("./lib/oauth"),
    httputil = require("./lib/http"),
    setupApp = oauthutil.setupApp;

var suite = vows.describe("shared library test");

var testGet = function(rel) {
    return {
        topic: function() {
            var callback = this.callback;
            http.get("http://localhost:4815" + rel, function(res) {
                if (res.statusCode !== 200) {
                    callback(new Error("Bad status code: " + res.statusCode), null);
                } else {
                    callback(null, res);
                }
            });
        },
        "it returns the correct error code": function(err, res) {
            assert.ifError(err);
        }
    };
};

// A batch to test that the API docs are served at root

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
        "and we check the showdown endpoint URL": httputil.endpoint("/shared/showdown.js", ["GET"]),
        "and we check the underscore endpoint URL": httputil.endpoint("/shared/underscore.js", ["GET"]),
        "and we check the underscore-min endpoint URL": httputil.endpoint("/shared/underscore-min.js", ["GET"]),
        "and we get the showdown file": testGet("/shared/showdown.js"),
        "and we get the underscore file": testGet("/shared/underscore.js"),
        "and we get the underscore-min file": testGet("/shared/underscore-min.js")
    }
});

suite["export"](module);
