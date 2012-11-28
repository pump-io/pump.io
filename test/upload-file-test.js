// upload-file-test.js
//
// Test uploading a file to a server
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

var assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    os = require("os"),
    fs = require("fs"),
    path = require("path"),
    mkdirp = require("mkdirp"),
    rimraf = require("rimraf"),
    _ = require("underscore"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupAppConfig = oauthutil.setupAppConfig,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken;

var suite = vows.describe("upload file test");

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

suite.addBatch({
    "When we create a temporary upload dir": {
        topic: function() {
            var callback = this.callback,
                dirname = path.join(os.tmpDir(), "upload-file-test", Date.now());
            mkdirp(dirname, function (err) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, dirname);
                }
            });
        },
        "it works": function(err, dir) {
            assert.ifError(err);
            assert.isString(dir);
        },
        teardown: function(dir) {
            if (dir) {
                rimraf(dir, function(err) { });
            }
        },
        "and we set up the app": {
            topic: function(dir) {
                setupAppConfig({uploaddir: dir},
                               this.callback);
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "and we check the upload file endpoint":
            httputil.endpoint("/main/uploadfile", ["POST"]),
            "and we register a client": {
                topic: function() {
                    newClient(this.callback);
                },
                "it works": function(err, cl) {
                    assert.ifError(err);
                    assert.isObject(cl);
                },
                "and we create a new user": {
                    topic: function(cl) {
                        newPair(cl, "mike", "stormtroopers_hittin_the_ground", this.callback);
                    }
                }
            }
        }
    }
});

suite["export"](module);
