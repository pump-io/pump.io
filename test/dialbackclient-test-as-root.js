// Dialback client test
//
// Copyright 2012 StatusNet Inc.
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

var vows = require("vows"),
    assert = require("assert"),
    express = require("express"),
    querystring = require("querystring");

var suite = vows.describe("DialbackClient post interface");

suite.addBatch({
    "When we set up a dummy echo app": {
        topic: function() {
            var callback = this.callback,
                app = express.createServer(),
                connected = false;

            app.post("/echo", function(req, res, next) {
                var parseFields = function(str) {
                    var fstr = str.substr(9); // everything after "Dialback "
                    var pairs = fstr.split(/,\s+/); // XXX: won't handle blanks inside values well
                    var fields = {};
                    pairs.forEach(function(pair) {
                        var kv = pair.split("="),
                            key = kv[0],
                            value = kv[1].replace(/^"|"$/g, "");
                        fields[key] = value;
                    });
                    return fields;
                };
                var auth = req.headers.authorization;
                var fields = parseFields(auth);
                res.json(fields);
            });

            app.on("error", function(err) {
                if (!connected) {
                    callback(err, null);
                }
            });

            app.listen(80, "social.localhost", function() {
                connected = true;
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
        },
        "And we require the DialbackClient module": {
            topic: function() {
                return require("../lib/dialbackclient");
            },
            "it works": function(DialbackClient) {
                assert.isObject(DialbackClient);
            },
            "and we post to the echo endpoint": {
                topic: function(DialbackClient) {
                    var body = querystring.stringify({type: "client_associate"}),
                        type = "application/x-www-form-urlencoded",
                        url = "http://social.localhost/echo",
                        id = "acct:user@photo.example",
                        callback = this.callback;

                    DialbackClient.post(url, id, body, type, callback);
                },
                "it works": function(err, res, body) {
                    assert.ifError(err);
                },
                "echo data includes token and id": function(err, res, body) {
                    var parts;
                    assert.ifError(err);
                    assert.isTrue(res.headers["content-type"].substr(0, "application/json".length) == "application/json");
                    try {
                        parts = JSON.parse(body);
                    } catch (err) {
                        assert.ifError(err);
                    }
                    assert.isObject(parts);
                    assert.include(parts, "webfinger");
                    assert.equal(parts.webfinger, "acct:user@photo.example");
                    assert.include(parts, "token");
                    assert.isString(parts.token);
                }
            }
        }
    }
});

suite["export"](module);
