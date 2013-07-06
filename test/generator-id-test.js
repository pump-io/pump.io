// generator-test.js
//
// Test that generator has the same ID twice
//
// Copyright 2012,2013, E14N https://e14n.com/
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
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient;

var ignore = function(err) {};

var suite = vows.describe("Activity generator attribute");

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var clientCred = function(cl) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret
    };
};

// A batch for testing the read access to the API

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
        "and we register a new client": {
            topic: function() {
                var cb = this.callback,
                    params = {
                        application_name: "Generator Test",
                        type: "client_associate",
                        application_type: "native"
                    };

                Step(
                    function() {
                        httputil.post("localhost",
                                      4815,
                                      "/api/client/register",
                                      params,
                                      this);
                    },
                    function(err, res, body) {
                        var cl;
                        if (err) throw err;
                        cl = JSON.parse(body);
                        this(null, cl);
                    },
                    cb
                );
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
                assert.include(cl, "client_id");
                assert.include(cl, "client_secret");
            },
            "and we register a user": {
                topic: function(cl) {
                    newPair(cl, "george", "sleeping1", this.callback);
                },
                "it works": function(err, pair) {
                    assert.ifError(err);
                    assert.isObject(pair);
                },
                "and we post two notes with the same credentials": {
                    topic: function(pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = "http://localhost:4815/api/user/george/feed",
                            act = {
                                verb: "post",
                                object: {
                                    objectType: "note",
                                    content: "Hello, world!"
                                }
                            },
			    first, second;

			Step(
			    function() {
				httputil.postJSON(url, cred, act, this);
			    },
			    function(err, doc, resp) {
				if (err) throw err;
				first = doc;
				httputil.postJSON(url, cred, act, this);
			    },
			    function(err, doc, resp) {
				if (err) {
				    cb(err, null, null);
				} else {
				    second = doc;
				    cb(null, first, second);
				}
			    }
			);
                    },
                    "the generator IDs are the same": function(err, first, second) {
                        assert.ifError(err);
                        assert.isObject(first);
                        assert.isObject(first.generator);
                        assert.isObject(second);
                        assert.isObject(second.generator);
			assert.equal(first.generator.id, second.generator.id);
                    }
                }
	    }
        }
    }
});

suite["export"](module);
