// app-test.js
//
// Test that plugin endpoints are called
//
// Copyright 2013, E14N https://e14n.com/
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

var Step = require("step"),
    _ = require("underscore"),
    assert = require("assert"),
    vows = require("vows"),
    fs = require("fs"),
    path = require("path"),
    oauthutil = require("./lib/oauth"),
    httputil = require("./lib/http");

var ignore = function(err) {};

var suite = vows.describe("app module interface");

suite.addBatch({
    "When we get the app module": {
        topic: function() {
            return require("../lib/app");
        },
        "there is one": function(mod) {
            assert.isObject(mod);
        },
        "it has the makeApp() export": function(mod) {
            assert.isFunction(mod.makeApp);
        }
    }
});

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch({
    "When we makeApp() with a named plugin": {
        topic: function() {
            var config = {port: 4815,
                          hostname: "localhost",
                          driver: tc.driver,
                          params: tc.params,
                          nologger: true,
                          sockjs: false,
                          plugins: ["../test/lib/plugin"]
                         },
                makeApp = require("../lib/app").makeApp;

            process.env.NODE_ENV = "test";

            makeApp(config, this.callback);
        },
        "it works": function(err, app) {
            assert.ifError(err);
            assert.isObject(app);
        },
        "the plugin log endpoint was called": function(err, app) {
            var plugin = require("./lib/plugin");
            assert.ifError(err);
            assert.isTrue(plugin.called.log);
        },
        "the plugin schema endpoint was called": function(err, app) {
            var plugin = require("./lib/plugin");
            assert.ifError(err);
            assert.isTrue(plugin.called.schema);
        },
        "the plugin app endpoint was called": function(err, app) {
            var plugin = require("./lib/plugin");
            assert.ifError(err);
            assert.isTrue(plugin.called.app);
        },
        "and we run the app": {
            topic: function(app) {
                app.run(this.callback);
            },
            "it works": function(err) {
                assert.ifError(err);
            },
            "teardown": function(app) {
                if (app && app.close) {
                    app.close(function(err) {});
                }
            },
            "and we create an activity": {
                topic: function() {
                    var callback = this.callback;
                    Step(
                        function() {
                            oauthutil.newCredentials("aang", "air*bender", this.parallel());
                            oauthutil.newCredentials("katara", "water*bender", this.parallel());
                        },
                        function(err, cred, cred2) {
                            var url,
                                activity;
                            if (err) throw err;
                            url = "http://localhost:4815/api/user/aang/feed";
                            activity = {
                                verb: "post",
				to: [
				    cred2.user.profile
				],
				cc: [{
				    objectType: "collection",
				    id: cred.user.profile.followers.url
				}],
                                object: {
                                    objectType: "note",
                                    content: "Hello, world."
                                }
                            };

                            httputil.postJSON(url, cred, activity, this);
                        },
                        function(err) {
                            callback(err);
                        }
                    );
                },
                "the plugin distributor endpoint was called": function(err, app) {
                    var plugin = require("./lib/plugin");
                    assert.ifError(err);
                    assert.isTrue(plugin.called.distribute);
                },
                "the plugin distributeActivityToUser endpoint was called": function(err, app) {
                    var plugin = require("./lib/plugin");
                    assert.ifError(err);
                    assert.isTrue(plugin.called.touser);
                }
            }
        }
    }
});

suite["export"](module);
