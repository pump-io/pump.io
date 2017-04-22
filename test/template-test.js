// middleware-test.js
//
// Test the template module
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

"use strict";

var fs = require("fs"),
    path = require("path"),
    _ = require("underscore"),
    Step = require("step"),
    vows = require("vows"),
    assert = require("assert"),
    Browser = require("zombie"),
    methodContext = require("./lib/methods").methodContext,
    oauthutil = require("./lib/oauth"),
    setupAppConfig = oauthutil.setupAppConfig;

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
                    var cb = this.callback,
                        browser = new Browser();

                    browser.visit("http://localhost:4815/template/templates.js", function(err) {
                        cb(err, browser);
                    });
                },
                teardown: function(br) {
                    if (br && br.window.close) {
                        br.window.close();
                    }
                },
                "it works": function(err, br) {
                    assert.ifError(err);
                    br.assert.success();
                }
            },
            "and we has global property": {
                topic: function() {
                    var cb = this.callback,
                        browser = new Browser();

                    browser.visit("http://localhost:4815/", function(err) {
                        cb(err, browser);
                    });
                },
                teardown: function(br) {
                    if (br && br.window.close) {
                        br.window.close();
                    }
                },
                "it works": function(err, br, res) {
                    assert.ifError(err);
                    br.assert.success();
                    assert.isObject(br.window.Pump._templates);
                },
                "return template without hash": {
                    topic: function(br) {
                        var cb = this.callback,
                            browser = new Browser(),
                            tpls = _.pairs(br.window.Pump._templates),
                            first = _.first(tpls),
                            urlTpl = "http://localhost:4815/template/" +
                            first[0] + ".jade.js";

                        browser.visit(urlTpl, function(err) {
                            cb(err, browser);
                        });
                    },
                    teardown: function(br) {
                        if (br && br.window.close) {
                            br.window.close();
                        }
                    },
                    "it works": function(err, br) {
                        assert.ifError(err);
                        br.assert.success();
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
                    var cb = this.callback,
                        browser;

                    browser = new Browser();

                    browser.visit("http://localhost:4816/template/templates.min.js", function(err) {
                        cb(err, browser);
                    });
                },
                teardown: function(br) {
                    if (br && br.window.close) {
                        br.window.close();
                    }
                },
                "it works": function(err, br) {
                    assert.ifError(err);
                    br.assert.success();
                }
            },
            "and we has global property": {
                topic: function() {
                    var cb = this.callback,
                        browser = new Browser();

                    browser.visit("http://localhost:4816/", function(err) {
                        cb(err, browser);
                    });
                },
                teardown: function(br) {
                    if (br && br.window.close) {
                        br.window.close();
                    }
                },
                "it works": function(err, br) {
                    assert.ifError(err);
                    br.assert.success();
                    assert.isObject(br.window.Pump._templates);
                },
                "return template with hash": {
                    topic: function(br) {
                        var cb = this.callback,
                            browser = new Browser(),
                            tpls = _.pairs(br.window.Pump._templates),
                            first = _.first(tpls),
                            urlTpl = "http://localhost:4816/template/" +
                            first[0] + "." + first[1] + ".jade.js";

                        browser.visit(urlTpl, function(err) {
                            cb(err, browser);
                        });
                    },
                    teardown: function(br) {
                        if (br && br.window.close) {
                            br.window.close();
                        }
                    },
                    "it works": function(err, br) {
                        assert.ifError(err);
                        br.assert.success();
                    }
                },
                "should not be return a template": {
                    topic: function(br) {
                        var cb = this.callback,
                            browser = new Browser(),
                            tpls = _.pairs(br.window.Pump._templates),
                            first = _.first(tpls),
                            urlTpl = "http://localhost:4816/template/" +
                            first[0] + ".jade.js";

                        browser.visit(urlTpl, function() {
                            cb(null, browser);
                        });
                    },
                    teardown: function(br) {
                        if (br && br.window.close) {
                            br.window.close();
                        }
                    },
                    "it fails correctly": function(err, br) {
                        assert.ifError(err);
                        br.assert.status(404);
                    }
                }
            }
        }
    }
})["export"](module);
