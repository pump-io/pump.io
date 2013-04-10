// scrubber-favorite-api-test.js
//
// Test posting filthy HTML to the favorites endpoint
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

var postFavorite = function(obj) {
    var url = "http://localhost:4815/api/user/shatner/favorites";

    return {
        topic: function(cred) {
            httputil.postJSON(url, cred, obj, this.callback);
        },
        "it works": function(err, result, response) {
            assert.ifError(err);
            assert.isObject(result);
        }
    };
};

var goodFavorite = function(obj, property) {
    var compare = deepProperty(obj, property),
        context = postFavorite(obj);

    context["it is unchanged"] = function(err, result, response) {
        assert.ifError(err);
        assert.isObject(result);
        assert.equal(deepProperty(result, property), compare);
    };

    return context;
};

var badFavorite = function(obj, property) {
    var context = postFavorite(obj);

    context["it is defanged"] = function(err, result, response) {
        assert.ifError(err);
        assert.isObject(result);
        assert.equal(deepProperty(result, property).indexOf("<script>"), -1);
    };

    return context;
};

var privateFavorite = function(obj, property) {

    var context = postFavorite(obj);

    context["private property is ignored"] = function(err, result, response) {
        assert.ifError(err);
        assert.isObject(result);
        assert.isFalse(_.has(result, property));
    };

    return context;
};

var suite = vows.describe("Scrubber favorite API test");

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
                oauthutil.newCredentials("shatner", "deep*fried*turkey", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "and we favorite an object with good content": 
            goodFavorite({objectType: "note",
                          id: "urn:uuid:9aa257b4-3291-11e2-a4d3-0024beb67924",
                          content: HARMLESS
                         },
                         "content"),
            "and we favorite an object with bad content": 
            badFavorite({objectType: "note",
                         id: "urn:uuid:9aa2f1b0-3291-11e2-b8c5-0024beb67924",
                          content: DANGEROUS
                         },
                         "content"),
            "and we favorite an object with good summary": 
            goodFavorite({objectType: "note",
                          id: "urn:uuid:9aa38bf2-3291-11e2-96dc-0024beb67924",
                          summary: HARMLESS
                         },
                         "summary"),
            "and we favorite an object with bad summary": 
            badFavorite({objectType: "note",
                         id: "urn:uuid:9aa42710-3291-11e2-b22d-0024beb67924",
                          summary: DANGEROUS
                         },
                         "summary"),
            "and we favorite an object with a private member": 
            privateFavorite({objectType: "person",
                             id: "urn:uuid:20605d22-36ae-11e2-9e3d-70f1a154e1aa",
                             _user: true,
                             summary: HARMLESS
                            },
                            "_user")
        }
    }
});

suite["export"](module);
