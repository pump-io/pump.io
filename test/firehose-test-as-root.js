// firehose-test.js
//
// Test the firehose module
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

var fs = require("fs"),
    path = require("path"),
    assert = require("assert"),
    express = require("express"),
    vows = require("vows"),
    Step = require("step");

var suite = vows.describe("firehose module interface");

suite.addBatch({
    "When we require the firehose module": {
        topic: function() {
            return require("../lib/firehose");
        },
        "it returns an object": function(Firehose) {
            assert.isObject(Firehose);
        },
        "and we check its methods": {
            topic: function(Firehose) {
                return Firehose;
            },
            "it has a setup method": function(Firehose) {
                assert.isFunction(Firehose.setup);
            },
            "it has a ping method": function(Firehose) {
                assert.isFunction(Firehose.ping);
            },
            "and we set up a firehose dummy server": {
                topic: function(Firehose) {
                    var app = express.createServer(express.bodyParser()),
                        callback = this.callback;
                    app.post("/ping", function(req, res, next) {
                        if (app.callback) {
                            app.callback(null, req.body);
                        }
                        res.writeHead(201);
                        res.end();
                    });
                    app.on("error", function(err) {
                        callback(err, null);
                    });
                    app.listen(80, "firehose.localhost", function() {
                        callback(null, app);
                    });
                },
                "it works": function(err, app) {
                    assert.ifError(err);
                    assert.isObject(app);
                },
                teardown: function(app) {
                    if (app && app.close) {
                        app.close();
                    }
                },
                "and we call Firehose.setup()": {
                    topic: function(app, Firehose) {
                        var cb = this.callback;
                        try {
                            Firehose.setup("firehose.localhost");
                            cb(null);
                        } catch (err) {
                            cb(err);
                        }
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we call Firehose.ping()": {
                        topic: function(app, Firehose) {
                            var callback = this.callback,
                                act = {
                                    actor: {
                                        id: "user1@fake.example",
                                        objectType: "person"
                                    },
                                    verb: "post",
                                    object: {
                                        id: "urn:uuid:efbb2462-538c-11e2-9053-5cff35050cf2",
                                        objectType: "note",
                                        content: "Hello, world!"
                                    }
                                };
                            
                            Step(
                                function() {
                                    app.callback = this.parallel();
                                    Firehose.ping(act, this.parallel());
                                },
                                callback
                            );
                        },
                        "it works": function(err, body) {
                            assert.ifError(err);
                            assert.isObject(body);
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
