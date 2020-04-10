// app-e2e-test.js
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

"use strict";

// TODO: this needs to be updated/expanded for Express 3.x

var assert = require("assert"),
    vows = require("vows"),
    fs = require("fs"),
    path = require("path"),
    proxyquire = require("proxyquire"),
    _ = require("lodash");

var ignore = function(err) {};

var suite = vows.describe("app module interface");

suite.addBatch({
    "When we get the app module": {
        topic: function() {
            // lib/app.js expects to be run in a cluster worker with cluster.worker.on, etc.
            return proxyquire("../lib/app", {
                cluster: {
                    worker: {
                        on: ignore,
                        // TODO test that the worker signals the master properly
                        send: ignore
                    }
                }
            });
        },
        "there is one": function(mod) {
            assert.isObject(mod);
        },
        "it has the makeApp() export": function(mod) {
            assert.isFunction(mod.makeApp);
        }
    }
});

var tc = _.clone(require("./config.json"));

suite.addBatch({
    "When we makeApp()": {
        topic: function() {
            var cb = this.callback;
            var config = {port: 4815,
                          hostname: "localhost",
                          driver: tc.driver,
                          params: tc.params,
                          secret: "real secret",
                          nologger: true,
                          sockjs: false
                         },
                makeApp = require("../lib/app").makeApp;

            process.env.NODE_ENV = "test";

            makeApp(config, function(err, app) {
              cb(err, app);
            });
            return undefined;
        },
        "it works": function(err, app) {
            assert.ifError(err);
            assert.isObject(app);
        },
        "app has the run() method": function(err, app) {
            assert.isFunction(app.run);
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
