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

var getXRD = function(url) {
    return function() {
        var callback = this.callback;
        http.get(url, function(res) {
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
    };
};

var typeCheck = function(type) {
    return function(err, doc, res) {
        assert.ifError(err);
        assert.include(res, "headers");
        assert.include(res.headers, "content-type");
        assert.equal(res.headers["content-type"], type);
    };
};

var xrdLinkCheck = function(def) {
    return function(err, doc, res) {
        var i, prop, link;
        assert.ifError(err);
        assert.isObject(doc);
        assert.include(doc, "Link");
        assert.isArray(doc.Link);
        assert.lengthOf(doc.Link, def.links.length);

        for (i = 0; i < def.links.length; i++) {
            assert.isObject(doc.Link[i]);
            assert.include(doc.Link[i], "@");
            assert.isObject(doc.Link[i]["@"]);
            for (prop in def.links[i]) {
                if (def.links[i].hasOwnProperty(prop)) {
                    assert.include(doc.Link[i]["@"], prop);
                    if (_.isRegExp(def.links[i][prop])) {
                        assert.match(doc.Link[i]["@"][prop], def.links[i][prop]);
                    } else {
                        assert.equal(doc.Link[i]["@"][prop], def.links[i][prop]);
                    }
                }
            }
        }
    };
};

var xrdContext = function(url, def) {

    var ctx = {
        topic: getXRD(url),
        "it works": function(err, doc, res) {
            assert.ifError(err);
        },
        "it has an XRD content type": typeCheck("application/xrd+xml")
    };

    if (_(def).has("links")) {
        ctx["it has the correct links"] = xrdLinkCheck(def);
    }

    return ctx;
};

var getJRD = function(url) {
    return function() {
        var callback = this.callback;
        http.get(url, function(res) {
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
    };
};

var jrdLinkCheck = function(def) {
    return function(err, doc, res) {
        var i, prop, link;
        assert.ifError(err);
        assert.isObject(doc);
        assert.include(doc, "links");
        assert.isArray(doc.links);
        assert.lengthOf(doc.links, def.links.length);

        for (i = 0; i < def.links.length; i++) {
            assert.isObject(doc.links[i]);
            for (prop in def.links[i]) {
                if (def.links[i].hasOwnProperty(prop)) {
                    assert.include(doc.links[i], prop);
                    if (_.isRegExp(def.links[i][prop])) {
                        assert.match(doc.links[i][prop], def.links[i][prop]);
                    } else {
                        assert.equal(doc.links[i][prop], def.links[i][prop]);
                    }
                }
            }
        }
    };
};

var jrdContext = function(url, def) {
    var ctx = {
        topic: getJRD(url),
        "it works": function(err, doc, res) {
            assert.ifError(err);
        },
        "it has an JRD content type": typeCheck("application/json; charset=utf-8")
    };
    if (_(def).has("links")) {
        ctx["it has the correct links"] = jrdLinkCheck(def);
    }
    return ctx;
};

// hostmeta links

var hostmeta = {
    links: [{rel: "lrdd",
             type: "application/xrd+xml",
             template: /{uri}/},
            {rel: "lrdd",
             type: "application/json",
             template: /{uri}/}]
};

// A batch to test hostmeta functions

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
        "and we GET the host-meta file": 
        xrdContext("http://localhost:4815/.well-known/host-meta",
                   hostmeta),
        "and we GET the host-meta.json file":
        jrdContext("http://localhost:4815/.well-known/host-meta.json",
                   hostmeta),
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
            "it has a JSON content type": typeCheck("application/json; charset=utf-8"),
            "it has lrdd template links": jrdLinkCheck(hostmeta)
        }
    }
});

suite["export"](module);
