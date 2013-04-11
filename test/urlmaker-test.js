// urlmaker-test.js
//
// Test the urlmaker module
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

var assert = require("assert"),
    vows = require("vows"),
    parseURL = require("url").parse;

vows.describe("urlmaker module interface").addBatch({
    "When we require the urlmaker module": {
        topic: function() { 
            return require("../lib/urlmaker");
        },
        "it exists": function(urlmaker) {
            assert.isObject(urlmaker);
        },
        "and we get the URLMaker singleton": {
            topic: function(urlmaker) {
                return urlmaker.URLMaker;
            },
            "it exists": function(URLMaker) {
                assert.isObject(URLMaker);
            },
            "it has a hostname property": function(URLMaker) {
                assert.include(URLMaker, "hostname");
            },
            "it has a port property": function(URLMaker) {
                assert.include(URLMaker, "port");
            },
            "it has a makeURL method": function(URLMaker) {
                assert.include(URLMaker, "makeURL");
                assert.isFunction(URLMaker.makeURL);
            },
            "and we make an URL": {
                topic: function(URLMaker) {
                    URLMaker.hostname = "example.com";
                    URLMaker.port     = 3001;
                    return URLMaker.makeURL("login");
                },
                "it exists": function(url) {
                    assert.isString(url);
                },
                "its parts are correct": function(url) {
                    var parts = parseURL(url);
                    assert.equal(parts.hostname, "example.com");
                    assert.equal(parts.port, 3001);
                    assert.equal(parts.host, "example.com:3001");
                    assert.equal(parts.path, "/login");
                }
            },
            "and we set its properties to default port": {
                topic: function(URLMaker) {
                    URLMaker.hostname = "example.com";
                    URLMaker.port     = 80;
                    return URLMaker.makeURL("login");
                },
                "it exists": function(url) {
                    assert.isString(url);
                },
                "its parts are correct": function(url) {
                    var parts = parseURL(url);
                    assert.equal(parts.hostname, "example.com");
                    assert.isNull(parts.port);
                    assert.equal(parts.host, "example.com"); // NOT example.com:80
                    assert.equal(parts.path, "/login");
                }
            },
            "and we include parameters": {
                topic: function(URLMaker) {
                    URLMaker.hostname = "example.com";
                    URLMaker.port     = 2342;
                    return URLMaker.makeURL("/users", {offset: 10, count: 30});
                },
                "it exists": function(url) {
                    assert.isString(url);
                },
                "its parts are correct": function(url) {
                    // parse query params too
                    var parts = parseURL(url, true);
                    assert.equal(parts.hostname, "example.com");
                    assert.equal(parts.port, 2342);
                    assert.equal(parts.host, "example.com:2342");
                    assert.equal(parts.pathname, "/users");
                    assert.isObject(parts.query);
                    assert.include(parts.query, "offset");
                    assert.equal(parts.query.offset, 10);
                    assert.include(parts.query, "count");
                    assert.equal(parts.query.count, 30);
                }
            }
        }
    }
})["export"](module);

