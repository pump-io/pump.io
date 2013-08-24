// favicon-test.js
//
// Test that a favicon is provided
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

var assert = require("assert"),
    vows = require("vows"),
    oauthutil = require("./lib/oauth"),
    Browser = require("zombie"),
    Step = require("step"),
    http = require("http"),
    setupApp = oauthutil.setupApp,
    setupAppConfig = oauthutil.setupAppConfig,
    newCredentials = oauthutil.newCredentials;

var suite = vows.describe("favicon.ico test");

var httpGet = function(url, callback) {
    http.get(url, function(res) {
        var data = new Buffer( 0 );
        res.on('data', function(chunk) {
            data = Buffer.concat([data, chunk]);
        });
        res.on('error', function(err) {
            callback(err, null, null);
        });
        res.on('end', function() {
            callback(null, data, res);
        });
    }).on('error', function(err) {
        callback(err, null, null);
    });
};

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupAppConfig({site: "Test"}, this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we retrieve the favicon": {
            topic: function() {
                httpGet("http://localhost:4815/favicon.ico", this.callback);
            },
            "it works": function(err, body, resp) {
                assert.ifError(err);
                assert.isObject(body);
                assert.instanceOf(body, Buffer);
                assert.isObject(resp);
                assert.instanceOf(resp, http.IncomingMessage);
                assert.equal(resp.statusCode, 200);
            },
            "buffer is not empty": function(err, body, resp) {
                assert.ifError(err);
                assert.isObject(body);
                assert.instanceOf(body, Buffer);
                assert.greater(body.length, 0);
            }
        }
    }
});

suite["export"](module);
