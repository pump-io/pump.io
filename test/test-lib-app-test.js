// test-lib-app-test.js
//
// Test the app test libraries
//
// Copyright 2012, E14N https://e14n.com/
// Copyright 2017, AJ Jordan <alex@strugee.net>
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

var assert = require("assert"),
    http = require("http"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("lodash");

var suite = vows.describe("app setup test library");

suite.addBatch({
    "When we load the module": {
        topic: function() {
            return require("./lib/app");
        },
        "it works": function(apputil) {
            assert.isObject(apputil);
        },
        "it has a setupApp() export": function(apputil) {
            assert.isTrue(_(apputil).has("setupApp"));
            assert.isFunction(apputil.setupApp);
        },
        "it has a proxyquiredMakeApp export": function(apputil) {
            assert.isTrue(_(apputil).has("proxyquiredMakeApp"));
            assert.isFunction(apputil.proxyquiredMakeApp);
        },
        "and we setup the app": {
            topic: function(apputil) {
                apputil.setupApp(this.callback);
            },
            "it works": function(err, app) {
                assert.ifError(err);
                assert.isObject(app);
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
