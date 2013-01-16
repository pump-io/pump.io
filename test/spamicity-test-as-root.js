// spamicity-test.js
//
// Test the spamicity settings
//
// Copyright 2012, StatusNet Inc.
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

var fs = require("fs"),
    path = require("path"),
    assert = require("assert"),
    express = require("express"),
    vows = require("vows"),
    Step = require("step");

var suite = vows.describe("spamicity module interface");

suite.addBatch({
    "When we set up an activity spam dummy server": {
        topic: function() {
            var app = express.createServer(express.bodyParser()),
                callback = this.callback;
            app.post("/is-this-spam", function(req, res, next) {
                if (app.callback) {
                    app.callback(null, req.body);
                }
                res.json({
                    probability: 0.001,
                    isSpam: false,
                    bestKeys: [["a", "0.001"],
                               ["b", "0.001"],
                               ["c", "0.001"],
                               ["d", "0.001"],
                               ["e", "0.001"],
                               ["f", "0.001"],
                               ["g", "0.001"],
                               ["h", "0.001"],
                               ["i", "0.001"],
                               ["j", "0.001"],
                               ["k", "0.001"],
                               ["l", "0.001"],
                               ["m", "0.001"],
                               ["n", "0.001"],
                               ["o", "0.001"]]
                });
            });
            app.post("/this-is-spam", function(req, res, next) {
                if (app.callback) {
                    app.callback(null, req.body);
                }
                res.json({
                    cat: "spam",
                    object: {},
                    date: Date.now(),
                    elapsed: 100,
                    hash: "1234567890123456789012"
                });
            });
            app.post("/this-is-ham", function(req, res, next) {
                if (app.callback) {
                    app.callback(null, req.body);
                }
                res.json({
                    cat: "ham",
                    object: {},
                    date: Date.now(),
                    elapsed: 100,
                    hash: "1234567890123456789012"
                });
            });
            app.listen(80, "activityspam.localhost", function() {
                callback(null, app);
            });
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        }
    }
});

suite["export"](module);
