// template-test.js
//
// Test the template module
//
// Copyright 2011-2017, E14N https://e14n.com/ and contributors
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

"use strict";

var fs = require("fs"),
    path = require("path"),
    _ = require("lodash"),
    Step = require("step"),
    vows = require("vows"),
    assert = require("assert"),
    Browser = require("zombie"),
    methodContext = require("./lib/methods").methodContext,
    apputil = require("./lib/app"),
    httputil = require("./lib/http"),
    setupAppConfig = apputil.setupAppConfig;

var viewsPath = path.resolve(__dirname, "../public/template"),
    suite = vows.describe("template module interface");

suite.addBatch({

    "When we require the template module": {
        topic: function() {
            return require("../lib/template");
        },
        "it returns an object": function(err, template) {
            assert.ifError(err);
            assert.isObject(template);
        },
        "and we check its methods": methodContext(["reqTemplate"]),
        "and we return middleware function in debug": {
            topic: function(template) {
                var cb = this.callback,
                    mwTemplate;

                try {
                    mwTemplate = template.reqTemplate(viewsPath, {
                        debug: false
                    });
                    cb(null, mwTemplate);
                } catch (err) {
                    cb(err);
                }
            },
            "it returns an middleware": function(err, reqTemplate) {
                assert.ifError(err);
                assert.isFunction(reqTemplate);
            }
        },
        "When we set up the app with debugClient true": {
            topic: function() {
                setupAppConfig({
                    debugClient: true
                }, this.callback);
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "and we get available templates": {
                topic: function() {
                    httputil.head("http://localhost:4815/template/templates.js", this.callback);
                },
                "it works": function(err, res) {
                    assert.ifError(err);
                },
                "it has a status code of 200": function(err, res) {
                    assert.isNumber(res.statusCode);
                    assert.equal(res.statusCode, 200);
                }
            },
            "and we has global property": {
                topic: function(br) {
                    var cb = this.callback,
                        browser = new Browser();

                    browser.visit("http://localhost:4815/", function() {
                        cb(!browser.success, browser, browser.window.Pump._templates);
                    });
                },
                teardown: function(br) {
                    if (br && br.window.close) {
                        br.window.close();
                    }
                },
                "it works": function(err, br, templates) {
                    assert.ifError(err);
                    br.assert.success();
                    assert.isObject(templates);
                },
                "returns template with hash": {
                    topic: function(br, templates) {
                        var tpls = _.toPairs(templates),
                            first = _.first(tpls),
                            urlTpl = "http://localhost:4815/template/" +
                            first[0] + "." + first[1] + ".jade.js";

                        httputil.head(urlTpl, this.callback);
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has a status code of 200": function(err, res) {
                        assert.isNumber(res.statusCode);
                        assert.equal(res.statusCode, 200);
                    }
                },
                "returns template without hash": {
                    topic: function(br, templates) {
                        var cb = this.callback,
                            tpls = _.toPairs(templates),
                            first = _.first(tpls),
                            urlTpl = "http://localhost:4815/template/" +
                            first[0] + ".jade.js";

                        httputil.head(urlTpl, this.callback);
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has a status code of 200": function(err, res) {
                        assert.isNumber(res.statusCode);
                        assert.equal(res.statusCode, 200);
                    }
                }
            }
        },
        "When we set up the app with debugClient false": {
            topic: function() {
                setupAppConfig({
                    debugClient: false,
                    port: 4816
                }, this.callback);
            },
            teardown: function(app) {
                if (app && app.close) {
                    app.close();
                }
            },
            "it works": function(err, app) {
                assert.ifError(err);
            },
            "and we get available templates": {
                topic: function() {
                    httputil.head("http://localhost:4816/template/templates.min.js", this.callback);
                },
                "it works": function(err, res) {
                    assert.ifError(err);
                },
                "it has a status code of 200": function(err, res) {
                    assert.isNumber(res.statusCode);
                    assert.equal(res.statusCode, 200);
                }
            },
            "and we has global property": {
                topic: function() {
                    var cb = this.callback,
                        browser = new Browser();

                    browser.visit("http://localhost:4816/", function() {
                        cb(!browser.success, browser, browser.window.Pump._templates);
                    });
                },
                teardown: function(br) {
                    if (br && br.window.close) {
                        br.window.close();
                    }
                },
                "it works": function(err, br, templates) {
                    assert.ifError(err);
                    br.assert.success();
                    assert.isObject(templates);
                },
                "returns template with hash": {
                    topic: function(br, templates) {
                        var tpls = _.toPairs(templates),
                            first = _.first(tpls),
                            urlTpl = "http://localhost:4816/template/" +
                            first[0] + "." + first[1] + ".jade.js";

                        httputil.head(urlTpl, this.callback);
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has a status code of 200": function(err, res) {
                        assert.isNumber(res.statusCode);
                        assert.equal(res.statusCode, 200);
                    }
                },
                "returns a template without hash": {
                    topic: function(br, templates) {
                        var tpls = _.toPairs(templates),
                            first = _.first(tpls),
                            urlTpl = "http://localhost:4816/template/" +
                            first[0] + ".jade.js";

                        httputil.head(urlTpl, this.callback);
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has a status code of 200": function(err, res) {
                        assert.isNumber(res.statusCode);
                        assert.equal(res.statusCode, 200);
                    }
                },
                "should not be returns a blacklist template": {
                    topic: function() {
                        httputil.head("http://localhost:4816/template/javascript-disabled.jade.js", this.callback);
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has a status code of 404": function(err, res) {
                        assert.isNumber(res.statusCode);
                        assert.equal(res.statusCode, 404);
                    }
                },
                "should not be returns invalid template": {
                    topic: function(br, templates) {
                        var tpls = _.toPairs(templates),
                            first = _.first(tpls),
                            urlTpl = "http://localhost:4816/template/" +
                            first[0] + ".js.jade";

                        httputil.head(urlTpl, this.callback);
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has a status code of 404": function(err, res) {
                        assert.isNumber(res.statusCode);
                        assert.equal(res.statusCode, 404);
                    }
                },
                "should not be returns a non-existent template": {
                    topic: function() {
                        httputil.head("http://localhost:4816/template/javascript-client.jade.js", this.callback);
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has a status code of 404": function(err, res) {
                        assert.isNumber(res.statusCode);
                        assert.equal(res.statusCode, 404);
                    }
                }
            }
        }
    }
})["export"](module);
