// web-test.js
//
// Test the web module
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

var suite = vows.describe("web module interface");

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
            "and we make an http request": {
                topic: function(web) {
                    var callback = this.callback,
                        app,
                        res;

                    Step(
                        function() {
                            app = express.createServer();
                            app.get("/foo", function(req, res, next) {
                                res.send("Hello, world.");
                            });
                            app.listen(4815, "localhost", this);
                        },
                        function() {
                            var options = {
                                host: "localhost",
                                port: 4815,
                                path: "/foo"
                            };
                            web.http(options, this);
                        },
                        function(err, result) {
                            if (err) throw err;
                            res = result;
                            app.close(this);
                        },
                        function(err) {
                            if (err) {
                                callback(err, null);
                            } else {
                                callback(null, res);
                            }
                        }
                    );
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
            },
            "and we make an https request": {
                topic: function(web) {
                    var callback = this.callback,
                        app,
                        res;

                    Step(
                        function() {
                            var key = path.join(__dirname, "data", "secure.localhost.key"),
                                cert = path.join(__dirname, "data", "secure.localhost.crt");

                            app = express.createServer({key: fs.readFileSync(key),
                                                        cert: fs.readFileSync(cert)});

                            app.get("/foo", function(req, res, next) {
                                res.send("Hello, world.");
                            });
                            app.listen(4816, "secure.localhost", this);
                        },
                        function() {
                            var options = {
                                host: "secure.localhost",
                                port: 4816,
                                path: "/foo"
                            };
                            web.https(options, this);
                        },
                        function(err, result) {
                            if (err) throw err;
                            res = result;
                            app.close(this);
                        },
                        function(err) {
                            if (err) {
                                callback(err, null);
                            } else {
                                callback(null, res);
                            }
                        }
                    );
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
});

suite["export"](module);
