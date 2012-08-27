// .well-known/host-meta
//
// Copyright 2012 StatusNet Inc.
//
// "I never met a host I didn't like"
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
    xml2js = require("xml2js"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("underscore"),
    querystring = require("querystring"),
    http = require("http"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp;

var suite = vows.describe("host meta test");

// A batch to test following/unfollowing users

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we check the host-meta endpoint": 
        httputil.endpoint("/.well-known/host-meta", ["GET"]),
        "and we check the host-meta.json endpoint": 
        httputil.endpoint("/.well-known/host-meta.json", ["GET"]),
        "and we GET the host-meta file": {
            topic: function() {
                var callback = this.callback;
                http.get("http://localhost:4815/.well-known/host-meta", function(res) {
                    var body = "";
                    if (res.statusCode !== 200) {
                        callback(new Error("Bad status code"), null, null);
                    } else {
                        res.setEncoding("utf8");
                        res.on("data", function(chunk) {
                            body = body + chunk;
                        });
                        res.on("error", function(err) {
                            callback(err, null, null);
                        });
                        res.on("end", function() {
                            var parser = new xml2js.Parser();
                            parser.parseString(body, function(err, doc) {
                                if (err) {
                                    callback(err, null, null);
                                } else {
                                    callback(null, doc, res);
                                }
                            });
                        });
                    }
                });
            },
            "it works": function(err, doc, res) {
                assert.ifError(err);
            },
            "it has an XRD content type": function(err, doc, res) {
                assert.ifError(err);
                assert.include(res, "headers");
                assert.include(res.headers, "content-type");
                assert.equal(res.headers["content-type"], "application/xrd+xml");
            },
            "it has lrdd template links": function(err, doc, res) {
                assert.ifError(err);
                assert.isObject(doc);
                assert.include(doc, "Link");
                assert.isArray(doc.Link);
                assert.lengthOf(doc.Link, 2);
                assert.isObject(doc.Link[0]);
                assert.include(doc.Link[0], "@");
                assert.isObject(doc.Link[0]["@"]);
                assert.include(doc.Link[0]["@"], "rel");
                assert.include(doc.Link[0]["@"], "type");
                assert.include(doc.Link[0]["@"], "template");
                assert.equal(doc.Link[0]["@"].rel, "lrdd");
                assert.equal(doc.Link[0]["@"].type, "application/xrd+xml");
                assert.isString(doc.Link[0]["@"].template);
                assert.match(doc.Link[0]["@"].template, /{uri}/);

                assert.isObject(doc.Link[1]);
                assert.include(doc.Link[1], "@");
                assert.isObject(doc.Link[1]["@"]);
                assert.include(doc.Link[1]["@"], "rel");
                assert.include(doc.Link[1]["@"], "type");
                assert.include(doc.Link[1]["@"], "template");
                assert.equal(doc.Link[1]["@"].rel, "lrdd");
                assert.equal(doc.Link[1]["@"].type, "application/json");
                assert.isString(doc.Link[1]["@"].template);
                assert.match(doc.Link[1]["@"].template, /{uri}/);
            }
        },
        "and we GET the host-meta.json file": {
            topic: function() {
                var callback = this.callback;
                http.get("http://localhost:4815/.well-known/host-meta.json", function(res) {
                    var body = "";
                    if (res.statusCode !== 200) {
                        callback(new Error("Bad status code"), null, null);
                    } else {
                        res.setEncoding("utf8");
                        res.on("data", function(chunk) {
                            body = body + chunk;
                        });
                        res.on("error", function(err) {
                            callback(err, null, null);
                        });
                        res.on("end", function() {
                            var doc;
                            try {
                                doc = JSON.parse(body);
                                callback(null, doc, res);
                            } catch (err) {
                                callback(err, null, null);
                            }
                        });
                    }
                });
            },
            "it works": function(err, doc, res) {
                assert.ifError(err);
            },
            "it has a JSON content type": function(err, doc, res) {
                assert.ifError(err);
                assert.include(res, "headers");
                assert.include(res.headers, "content-type");
                assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
            },
            "it has lrdd template links": function(err, doc, res) {

                assert.ifError(err);

                assert.include(doc, "links");
                assert.isArray(doc.links);
                assert.lengthOf(doc.links, 2);

                assert.isObject(doc.links[0]);
                assert.include(doc.links[0], "rel");
                assert.equal(doc.links[0].rel, "lrdd");
                assert.include(doc.links[0], "type");
                assert.equal(doc.links[0].type, "application/xrd+xml");
                assert.include(doc.links[0], "template");
                assert.isString(doc.links[0].template);
                assert.match(doc.links[0].template, /{uri}/);

                assert.include(doc.links[1], "rel");
                assert.equal(doc.links[1].rel, "lrdd");
                assert.include(doc.links[1], "type");
                assert.equal(doc.links[1].type, "application/json");
                assert.include(doc.links[1], "template");
                assert.isString(doc.links[1].template);
                assert.match(doc.links[1].template, /{uri}/);
            }
        },
        "and we GET the host-meta accepting JSON": {
            topic: function() {
                var callback = this.callback;
                var options = {
                    host: "localhost",
                    port: "4815",
                    path: "/.well-known/host-meta",
                    headers: {
                        accept: "application/json,*/*"
                    }
                };
                var req = http.request(options, function(res) {
                    var body = "";
                    if (res.statusCode !== 200) {
                        callback(new Error("Bad status code"), null, null);
                    } else {
                        res.setEncoding("utf8");
                        res.on("data", function(chunk) {
                            body = body + chunk;
                        });
                        res.on("error", function(err) {
                            callback(err, null, null);
                        });
                        res.on("end", function() {
                            var doc;
                            try {
                                doc = JSON.parse(body);
                                callback(null, doc, res);
                            } catch (err) {
                                callback(err, null, null);
                            }
                        });
                    }
                });
                req.end();
            },
            "it works": function(err, doc, res) {
                assert.ifError(err);
            },
            "it has a JSON content type": function(err, doc, res) {
                assert.ifError(err);
                assert.include(res, "headers");
                assert.include(res.headers, "content-type");
                assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
            },
            "it has lrdd template links": function(err, doc, res) {

                assert.ifError(err);

                assert.include(doc, "links");
                assert.isArray(doc.links);
                assert.lengthOf(doc.links, 2);

                assert.isObject(doc.links[0]);
                assert.include(doc.links[0], "rel");
                assert.equal(doc.links[0].rel, "lrdd");
                assert.include(doc.links[0], "type");
                assert.equal(doc.links[0].type, "application/xrd+xml");
                assert.include(doc.links[0], "template");
                assert.isString(doc.links[0].template);
                assert.match(doc.links[0].template, /{uri}/);

                assert.include(doc.links[1], "rel");
                assert.equal(doc.links[1].rel, "lrdd");
                assert.include(doc.links[1], "type");
                assert.equal(doc.links[1].type, "application/json");
                assert.include(doc.links[1], "template");
                assert.isString(doc.links[1].template);
                assert.match(doc.links[1].template, /{uri}/);
            }
        }
    }
});

suite["export"](module);
