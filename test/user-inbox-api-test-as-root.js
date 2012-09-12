// user-inbox-api-test-as-root.js
//
// Test posting to the user inbox
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
    http = require("http"),
    querystring = require("querystring"),
    _ = require("underscore"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    dialbackApp = require("./lib/dialback").dialbackApp,
    setupApp = oauthutil.setupApp;

var clientCred = function(cl) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret
    };
};

var suite = vows.describe("user inbox API");

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            var app, callback = this.callback;
            Step(
                function() {
                    setupApp(this);
                },
                function(err, result) {
                    if (err) throw err;
                    app = result;
                    dialbackApp(80, "social.localhost", this);
                },
                function(err, dbapp) {
                    if (err) {
                        callback(err, null, null);
                    } else {
                        callback(err, app, dbapp);
                    }
                }
            );
        },
        teardown: function(app, dbapp) {
            app.close();
            dbapp.close();
        },
        "and we register a new user": {
            topic: function() {
                newCredentials("louisck", "hilarious", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "and we check the inbox endpoint": 
            httputil.endpoint("/api/user/louisck/inbox", ["GET", "POST"]),
            "and we post to the inbox without credentials": {
                topic: function() {
                    var act = {
                        actor: {
                            id: "acct:user1@social.localhost",
                            objectType: "person"
                        },
                        verb: "post",
                        object: {
                            id: "http://social.localhost/note/1",
                            objectType: "note",
                            content: "Hello, world!"
                        }
                    },
                        requestBody = JSON.stringify(act),
                        reqOpts = {
                            host: "localhost",
                            port: 4815,
                            path: "/api/user/louisck/inbox",
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Content-Length": requestBody.length,
                                "User-Agent": "activitypump-test/0.1.0dev"
                            }
                        },
                        callback = this.callback;

                    var req = http.request(reqOpts, function(res) {
                        var body = "";
                        res.setEncoding("utf8");
                        res.on("data", function(chunk) {
                            body = body + chunk;
                        });
                        res.on("error", function(err) {
                            callback(err, null, null);
                        });
                        res.on("end", function() {
                            callback(null, res, body);
                        });
                    });

                    req.on("error", function(err) {
                        callback(err, null, null);
                    });

                    req.write(requestBody);

                    req.end();
                },
                "and it fails correctly": function(err, res, body) {
                    assert.ifError(err);
                    assert.greater(res.statusCode, 399);
                    assert.lesser(res.statusCode, 500);
                }
            },
            "and we post to the inbox with unattributed OAuth credentials": {
                topic: function() {
                    var callback = this.callback;

                    Step(
                        function() {
                            newClient(this);
                        },
                        function(err, cl) {

                            if (err) throw err;

                            var url = "http://localhost:4815/api/user/louisck/inbox",
                                act = {
                                    actor: {
                                        id: "acct:user1@social.localhost",
                                        objectType: "person"
                                    },
                                    verb: "post",
                                    object: {
                                        id: "http://social.localhost/note/2",
                                        objectType: "note",
                                        content: "Hello again, world!"
                                    }
                                },
                                cred = clientCred(cl);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, body, res) {
                            if (err && err.statusCode === 401) {
                                callback(null);
                            } else if (err) {
                                callback(err);
                            } else {
                                callback(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "and it fails correctly": function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite["export"](module);
