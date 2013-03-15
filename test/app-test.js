// app-test.js
//
// Test the app module
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
    fs = require("fs"),
    path = require("path");

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
    "When we makeApp()": {
        topic: function() {
            var config = {port: 4815,
                          hostname: "localhost",
                          driver: tc.driver,
                          params: tc.params,
                          nologger: true,
                          sockjs: false
                         },
                makeApp = require("../lib/app").makeApp;

            process.env.NODE_ENV = "test";

            makeApp(config, this.callback);
        },
        "it works": function(err, app) {
            assert.ifError(err);
            assert.isObject(app);
        },
        "app has the run() method": function(err, app) {
            assert.isFunction(app.run);
        },
        "app has the config property": function(err, app) {
            assert.isObject(app.config);
            assert.include(app.config, "hostname");
            assert.equal(app.config.hostname, "localhost");
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
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "app is listening on correct port": function(err, app) {
                var addr = app.address();
                assert.equal(addr.port, 4815);
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            }
        }
    }
});

suite["export"](module);