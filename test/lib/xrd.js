// test utilities for XRD and JRD
//
// Copyright 2012 E14N https://e14n.com/
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
    urlparse = require("url").parse,
    xml2js = require("xml2js"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("underscore"),
    http = require("http"),
    https = require("https");

var getXRD = function(url) {
    var parts = urlparse(url),
        mod = (parts.protocol == "https:") ? https : http;            

    return function() {
        var callback = this.callback,
            req;

        req = mod.get(parts, function(res) {
            var body = "";
            if (res.statusCode !== 200) {
                callback(new Error("Bad status code ("+res.statusCode+")"), null, null);
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

        req.on("error", function(err) { callback(err, null, null); });
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
        var i, prop, link,
            testLink = function(obj) {
                assert.isObject(obj);
                assert.include(obj, "@");
                assert.isObject(obj["@"]);
                for (prop in def.links[i]) {
                    if (def.links[i].hasOwnProperty(prop)) {
                        assert.include(obj["@"], prop);
                        if (_.isRegExp(def.links[i][prop])) {
                            assert.match(obj["@"][prop], def.links[i][prop]);
                        } else {
                            assert.equal(obj["@"][prop], def.links[i][prop]);
                        }
                    }
                }
            };
        assert.ifError(err);
        assert.isObject(doc);
        assert.include(doc, "Link");
        if (def.links.length === 1) {
            testLink(doc.Link);
        } else {
            assert.isArray(doc.Link);
            assert.lengthOf(doc.Link, def.links.length);
            for (i = 0; i < def.links.length; i++) {
                testLink(doc.Link[i]);
            }
        }
    };
};

var xrdContext = function(url, def) {

    var ctx = {
        topic: getXRD(url),
        "it works": function(err, doc, res) {
            assert.ifError(err);
            assert.isObject(doc);
            assert.isObject(res);
        },
        "it has an XRD content type": typeCheck("application/xrd+xml")
    };

    if (_(def).has("links")) {
        ctx["it has the correct links"] = xrdLinkCheck(def);
    }

    return ctx;
};

var getJRD = function(url) {
    var parts = urlparse(url),
        mod = (parts.protocol == "https:") ? https : http;            
    return function() {
        var callback = this.callback,
            req;

        req = mod.get(parts, function(res) {
            var body = "";
            if (res.statusCode !== 200) {
                callback(new Error("Bad status code ("+res.statusCode+")"), null, null);
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

        req.on("error", function(err) { callback(err, null, null); });
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
            assert.isObject(doc);
            assert.isObject(res);
        },
        "it has an JRD content type": typeCheck("application/json; charset=utf-8")
    };
    if (_(def).has("links")) {
        ctx["it has the correct links"] = jrdLinkCheck(def);
    }
    return ctx;
};

module.exports = {
    getXRD: getXRD,
    getJRD: getJRD,
    xrdContext: xrdContext,
    jrdContext: jrdContext,
    typeCheck: typeCheck,
    xrdLinkCheck: xrdLinkCheck,
    jrdLinkCheck: jrdLinkCheck
};