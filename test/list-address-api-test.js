// list-address-api-test.js
//
// Test addressing a list
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
    OAuth = require("oauth").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient;

var ignore = function(err) {};

var suite = vows.describe("List address API test");

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

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
        "and we register a client": {
            topic: function() {
                newClient(this.callback);
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and we create a new user": {
                topic: function(cl) {
                    var callback = this.callback;
                    
                    newPair(cl, "fry", "1-jan-2000", callback);
                },
                "it works": function(err, pair) {
                    assert.ifError(err);
                    assert.isObject(pair);
                },
                "and they create a list": {
                    topic: function(pair, cl) {
                        var callback = this.callback,
                            cred = makeCred(cl, pair);

                        Step(
                            function() {
                                httputil.postJSON("http://localhost:4815/api/user/fry/feed",
                                                  cred,
                                                  {
                                                      verb: "create",
                                                      object: {
                                                          objectType: "collection",
                                                          objectTypes: ["person"],
                                                          displayName: "Planet Express"
                                                      }
                                                  },
                                                  this);
                            },
                            function(err, body, resp) {
                                if (err) throw err;
                                this(null, body.object);
                            },
                            callback
                        );
                    },
                    "it works": function(err, list) {
                        assert.ifError(err);
                        assert.isObject(list);
                    },
                    "and they add some other users": {
                        topic: function(list, pair, cl) {
                            var callback = this.callback,
                                cred = makeCred(cl, pair);

                            Step(
                                function() {
                                    var group = this.group();
                                    register(cl, "leela", "6undergr0und", group());
                                    register(cl, "bender", "shiny|metal", group());
                                    register(cl, "amy", "k|k|wong", group());
                                },
                                function(err, users) {
                                    var group = this.group();
                                    if (err) throw err;
                                    _.each(users, function(user) {
                                        httputil.postJSON("http://localhost:4815/api/user/fry/feed",
                                                          cred,
                                                          {
                                                              verb: "add",
                                                              object: user.profile,
                                                              target: list
                                                          },
                                                          group());
                                        
                                    });
                                },
                                function(err, acts) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        callback(null);
                                    }
                                }
                            );
                        },
                        "it works": function(err) {
                            assert.ifError(err);
                        },
                        "and they post a note to the list": {
                            topic: function(list, pair, cl) {
                                var callback = this.callback,
                                    cred = makeCred(cl, pair);
                                
                                httputil.postJSON("http://localhost:4815/api/user/fry/feed",
                                                  cred,
                                                  {
                                                      verb: "post",
                                                      to: [list],
                                                      object: {
                                                          objectType: "note",
                                                          content: "Hi everybody."
                                                      }
                                                  },
                                                  callback);
                            },
                            "it works": function(err, body, resp) {
                                assert.ifError(err);
                                assert.isObject(body);
                            }
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
