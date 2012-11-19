// scrubber-api-test.js
//
// Test posting various bits of filthy HTML in hopes they can ruin someone's life
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

var assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    _ = require("underscore"),
    querystring = require("querystring"),
    http = require("http"),
    OAuth = require("oauth").OAuth,
    Browser = require("zombie"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken;

var DANGEROUS = "This is a <script>alert('Boo!')</script> dangerous string.";
var HARMLESS = "This is a harmless string.";

var deepProperty = function(object, property) {
    var i = property.indexOf('.');
    if (!object) {
        return null;
    } else if (i == -1) { // no dots
        return object[property];
    } else {
        return deepProperty(object[property.substr(0, i)], property.substr(i + 1));
    }
};

var goodActivity = function(act, property) {
    var url = "http://localhost:4815/api/user/mickey/feed",
        compare = deepProperty(act, property);

    return {
        topic: function(cred) {
            httputil.postJSON(url, cred, act, this.callback);
        },
        "it works": function(err, result, response) {
            assert.ifError(err);
            assert.isObject(result);
        },
        "it is unchanged": function(err, result, response) {
            assert.ifError(err);
            assert.isObject(result);
            assert.equal(deepProperty(result, property), compare);
        }
    };
};

var badActivity = function(act, property) {
    var url = "http://localhost:4815/api/user/mickey/feed";
    return {
        topic: function(cred) {
            httputil.postJSON(url, cred, act, this.callback);
        },
        "it works": function(err, result, response) {
            assert.ifError(err);
            assert.isObject(result);
        },
        "it is defanged": function(err, result, response) {
            assert.ifError(err);
            assert.isObject(result);
            assert.equal(deepProperty(result, property).indexOf("<script>"), -1);
        }
    };
};

var suite = vows.describe("Scrubber API test");

// A batch to test posting to the regular feed endpoint

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
        "and we get a new set of credentials": {
            topic: function() {
                oauthutil.newCredentials("mickey", "pluto111", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "and we post an activity with good content": 
            goodActivity({verb: "post",
                          content: HARMLESS,
                          object: {
                              objectType: "note",
                              content: "Hello, world"
                          }
                         },
                         "content"),
            "and we post an activity with bad content": 
            badActivity({verb: "post",
                         content: DANGEROUS,
                         object: {
                             objectType: "note",
                             content: "Hello, world"
                         }
                        },
                        "content"),
            "and we post an activity with good object content": 
            goodActivity({verb: "post",
                          object: {
                              objectType: "note",
                              content: HARMLESS
                          }
                         },
                         "object.content"),
            "and we post an activity with bad object content": 
            badActivity({verb: "post",
                         object: {
                             objectType: "note",
                             content: DANGEROUS
                         }
                        },
                        "object.content"),
            "and we post an activity with good target summary": 
            goodActivity({verb: "post",
                          object: {
                              objectType: "note",
                              content: "Hello, world."
                          },
                          target: {
                              objectType: "collection",
                              summary: HARMLESS
                          }
                         },
                         "target.summary"),
            "and we post an activity with bad target summary": 
            badActivity({verb: "post",
                          object: {
                              objectType: "note",
                              content: "Hello, world."
                          },
                          target: {
                              objectType: "collection",
                              summary: DANGEROUS
                          }
                         },
                         "target.summary"),
            "and we post an activity with good generator summary": 
            goodActivity({verb: "post",
                          object: {
                              objectType: "note",
                              content: "Hello, world."
                          },
                          generator: {
                              objectType: "application",
                              summary: HARMLESS
                          }
                         },
                         "generator.summary"),
            "and we post an activity with bad generator summary": 
            badActivity({verb: "post",
                          object: {
                              objectType: "note",
                              content: "Hello, world."
                          },
                          generator: {
                              objectType: "application",
                              summary: DANGEROUS
                          }
                         },
                         "generator.summary"),
            "and we post an activity with good provider summary": 
            goodActivity({verb: "post",
                          object: {
                              objectType: "note",
                              content: "Hello, world."
                          },
                          provider: {
                              objectType: "service",
                              summary: HARMLESS
                          }
                         },
                         "provider.summary"),
            "and we post an activity with bad provider summary": 
            badActivity({verb: "post",
                          object: {
                              objectType: "note",
                              content: "Hello, world."
                          },
                          provider: {
                              objectType: "service",
                              summary: DANGEROUS
                          }
                         },
                         "provider.summary"),
            "and we post an activity with good context summary": 
            goodActivity({verb: "post",
                          object: {
                              objectType: "note",
                              content: "Hello, world."
                          },
                          context: {
                              objectType: "event",
                              summary: HARMLESS
                          }
                         },
                         "context.summary"),
            "and we post an activity with bad context summary": 
            badActivity({verb: "post",
                          object: {
                              objectType: "note",
                              content: "Hello, world."
                          },
                          context: {
                              objectType: "event",
                              summary: DANGEROUS
                          }
                         },
                         "context.summary"),
            "and we post an activity with good source summary": 
            goodActivity({verb: "post",
                          object: {
                              objectType: "note",
                              content: "Hello, world."
                          },
                          source: {
                              objectType: "collection",
                              summary: HARMLESS
                          }
                         },
                         "source.summary"),
            "and we post an activity with bad source summary": 
            badActivity({verb: "post",
                         object: {
                             objectType: "note",
                             content: "Hello, world."
                         },
                         source: {
                             objectType: "collection",
                             summary: DANGEROUS
                         }
                        },
                        "source.summary")
        }
    }
});

suite["export"](module);