// scrubber-object-api-test.js
//
// Test posting objects then trying to squidge in bad HTML with PUT
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
    Step = require("step"),
    _ = require("underscore"),
    querystring = require("querystring"),
    http = require("http"),
    OAuth = require("oauth-evanp").OAuth,
    Browser = require("zombie"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient,
    register = oauthutil.register;

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

var updateObject = function(orig, update) {
    var feed = "http://localhost:4815/api/user/dangermouse/feed";

    return {
        topic: function(cred) {
            var callback = this.callback;
            Step(
                function() {
                    var act = {
                        verb: "post",
                        object: orig
                    };
                    httputil.postJSON(feed, cred, act, this);
                },
                function(err, post) {
                    var url, copied;
                    if (err) throw err;
                    copied = _.extend(post.object, update);
                    url = post.object.links.self.href;
                    httputil.putJSON(url, cred, update, this); 
                },
                function(err, updated) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, updated);
                    }
                }
            );
        },
        "it works": function(err, result, response) {
            assert.ifError(err);
            assert.isObject(result);
        }
    };
};

var goodUpdate = function(orig, update, property) {
    var compare = deepProperty(update, property),
        context = updateObject(orig, update);
    context["it is unchanged"] = function(err, result, response) {
        assert.ifError(err);
        assert.isObject(result);
        assert.equal(deepProperty(result, property), compare);
    };

    return context;
};

var badUpdate = function(orig, update, property) {
    var compare = deepProperty(update, property),
        context = updateObject(orig, update);
    context["it is defanged"] = function(err, result, response) {
        assert.ifError(err);
        assert.isObject(result);
        assert.equal(deepProperty(result, property).indexOf("<script>"), -1);
    };

    return context;
};

var privateUpdate = function(orig, update, property) {
    var context = updateObject(orig, update);
    context["it is ignored"] = function(err, result, response) {
        assert.ifError(err);
        assert.isObject(result);
        assert.isFalse(_.has(result, "_uuid"));
    };

    return context;
};

var suite = vows.describe("Scrubber Object API test");

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
                oauthutil.newCredentials("dangermouse", "gad|gets", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "and we update an object with harmless content": 
            goodUpdate({objectType: "note",
                        content: "Hello, World!"},
                       {content: HARMLESS},
                       "content"),
            "and we update an object with dangerous content": 
            badUpdate({objectType: "note",
                        content: "Hello, World!"},
                       {content: DANGEROUS},
                       "content"),
            "and we update an object with harmless summary": 
            goodUpdate({objectType: "note",
                        summary: "Hello, World!"},
                       {summary: HARMLESS},
                       "summary"),
            "and we update an object with dangerous summary": 
            badUpdate({objectType: "note",
                       summary: "Hello, World!"},
                      {summary: DANGEROUS},
                      "summary"),
            "and we update an object with private member": 
            privateUpdate({objectType: "note",
                           summary: "Hello, World!"},
                          {_uuid: "0xDEADBEEF"},
                          "_uuid")
        }
    }
});

suite["export"](module);
