// web-test.js
//
// Test the web module
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

var suite = vows.describe("web module interface");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

suite.addBatch({
    "When we require the web module": {
        topic: function() {
            return require("../lib/web");
        },
        "it returns an object": function(web) {
            assert.isObject(web);
        },
        "and we check its methods": {
            topic: function(web) {
                return web;
            },
            "it has a mod method": function(web) {
                assert.isFunction(web.mod);
            },
            "it has an http method": function(web) {
                assert.isFunction(web.http);
            },
            "it has an https method": function(web) {
                assert.isFunction(web.https);
            },
            "and we set up an http server": {
                topic: function(web) {
                    var app = express.createServer(),
                        callback = this.callback;

                    app.get("/foo", function(req, res, next) {
                        res.send("Hello, world.");
                    });

                    app.on("error", function(err) {
                        callback(err, null);
                    });

                    app.listen(1623, "localhost", function() {
                        callback(null, app);
                    });
                },
                "it works": function(err, app) {
                    assert.ifError(err);
                    assert.isObject(app);
                },
                "teardown": function(app) {
                    if (app && app.close) {
                        app.close(function(err) {});
                    }
                },
                "and we make an http request": {
                    topic: function(app, web) {
                        var callback = this.callback,
                            options = {
                                host: "localhost",
                                port: 1623,
                                path: "/foo"
                            };

                        web.http(options, function(err, res) {
                            if (err) {
                                callback(err, null);
                            } else {
                                callback(null, res);
                            }
                        });
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                        assert.isObject(res);
                    },
                    "and we check the results": {
                        topic: function(res) {
                            return res;
                        },
                        "it has a statusCode": function(res) {
                            assert.isNumber(res.statusCode);
                            assert.equal(res.statusCode, 200);
                        },
                        "it has the right body": function(res) {
                            assert.isString(res.body);
                            assert.equal(res.body, "Hello, world.");
                        }
                    }
                }
            },
            "and we set up an https server": {
                topic: function(web) {
                    var key = path.join(__dirname, "data", "secure.localhost.key"),
                        cert = path.join(__dirname, "data", "secure.localhost.crt"),
                        app,
                        callback = this.callback;

                    app = express.createServer({key: fs.readFileSync(key),
                                                cert: fs.readFileSync(cert)});

                    app.get("/foo", function(req, res, next) {
                        res.send("Hello, world.");
                    });

                    app.on("error", function(err) {
                        callback(err, null);
                    });

                    app.listen(2315, "secure.localhost", function() {
                        callback(null, app);
                    });
                },
                "it works": function(err, app) {
                    assert.ifError(err);
                    assert.isObject(app);
                },
                "teardown": function(app) {
                    if (app && app.close) {
                        app.close(function(err) {});
                    }
                },
                "and we make an https request": {
                    topic: function(app, web) {
                        var callback = this.callback,
                            options = {
                                host: "secure.localhost",
                                port: 2315,
                                path: "/foo"
                            };

                        web.https(options, function(err, res) {
                            if (err) {
                                callback(err, null);
                            } else {
                                callback(null, res);
                            }
                        });
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                        assert.isObject(res);
                    },
                    "and we check the results": {
                        topic: function(res) {
                            return res;
                        },
                        "it has a statusCode": function(res) {
                            assert.isNumber(res.statusCode);
                            assert.equal(res.statusCode, 200);
                        },
                        "it has the right body": function(res) {
                            assert.isString(res.body);
                            assert.equal(res.body, "Hello, world.");
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
