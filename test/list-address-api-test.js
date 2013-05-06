// list-address-api-test.js
//
// Test addressing a list
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
    Queue = require("jankyqueue"),
    OAuth = require("oauth-evanp").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
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
                    
                    Step(
                        function() {
                            var group = this.group();
                            newPair(cl, "fry", "1-jan-2000", group());
                            newPair(cl, "leela", "6undergr0und", group());
                            newPair(cl, "bender", "shiny|metal", group());
                            newPair(cl, "amy", "k|k|wong", group());
                        },
                        callback
                    );
                },
                "it works": function(err, pairs) {
                    assert.ifError(err);
                    assert.isArray(pairs);
                },
                "and they create a list": {
                    topic: function(pairs, cl) {
                        var callback = this.callback,
                            cred = makeCred(cl, pairs[0]);

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
                        topic: function(list, pairs, cl) {
                            var callback = this.callback,
                                cred = makeCred(cl, pairs[0]);

                            Step(
                                function() {
                                    var group = this.group();
                                    _.each(_.pluck(pairs.slice(1), "user"), function(user) {
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
                            topic: function(list, pairs, cl) {
                                var callback = this.callback,
                                    cred = makeCred(cl, pairs[0]);
                                
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
                                                  function(err, body, resp) {
                                                      callback(err, body);
                                                  }
                                                 );
                            },
                            "it works": function(err, body) {
                                assert.ifError(err);
                                assert.isObject(body);
                            },
                            "and we check the inboxes of the other users": {
                                topic: function(act, list, pairs, cl) {
                                    var callback = this.callback;

                                    Step(
                                        function() {
                                            var group = this.group();
                                            _.each(pairs.slice(1), function(pair) {
                                                var user = pair.user,
                                                    cred = makeCred(cl, pair);
                                                
                                                httputil.getJSON("http://localhost:4815/api/user/"+user.nickname+"/inbox",
                                                                 cred,
                                                                 group());
                                            });
                                        },
                                        function(err, feeds) {
                                            callback(err, feeds, act);
                                        }
                                    );
                                },
                                "it works": function(err, feeds, act) {
                                    assert.ifError(err);
                                    assert.isArray(feeds);
                                    assert.isObject(act);
                                },
                                "the activity is in there": function(err, feeds, act) {
                                    _.each(feeds, function(feed) {
                                        assert.isObject(feed);
                                        assert.include(feed, "items");
                                        assert.isArray(feed.items);
                                        assert.greater(feed.items.length, 0);
                                        assert.isTrue(_.some(feed.items, function(item) {
                                            return (item.id == act.id);
                                        }));
                                    });
                                }
                            }
                        }
                    }
                }
            },
            "and a user posts to a very big list": {

                topic: function(cl) {
                    var callback = this.callback,
                        pairs,
                        list,
                        act,
                        q = new Queue(25);
                    
                    Step(
                        function() {
                            var i, group = this.group();
                            for (i = 0; i < 150; i++) {
                                q.enqueue(newPair, [cl, "robot"+i, "bad*password*"+i], group());
                            }
                        },
                        function(err, results) {
                            var cred;
                            if (err) throw err;
                            pairs = results;
                            cred = makeCred(cl, pairs[0]);
                            httputil.postJSON("http://localhost:4815/api/user/robot0/feed",
                                              cred,
                                              {
                                                  verb: "create",
                                                  object: {
                                                      objectType: "collection",
                                                      objectTypes: ["person"], // robots are people, too
                                                      displayName: "Robots"
                                                  }
                                              },
                                              this);
                        },
                        function(err, act) {
                            var group = this.group(),
                                cred;
                            if (err) throw err;
                            list = act.object;
                            cred = makeCred(cl, pairs[0]);
                            _.each(_.pluck(pairs.slice(1), "user"), function(user) {
                                q.enqueue(httputil.postJSON,
                                          ["http://localhost:4815/api/user/robot0/feed",
                                           cred,
                                           {
                                               verb: "add",
                                               object: user.profile,
                                               target: list
                                           }
                                          ],
                                          group());
                                
                            });
                        },
                        function(err, responses) {
                            var cred = makeCred(cl, pairs[0]);
                            if (err) throw err;
                            httputil.postJSON("http://localhost:4815/api/user/robot0/feed",
                                              cred,
                                              {
                                                  verb: "post",
                                                  to: [list],
                                                  object: {
                                                      objectType: "note",
                                                      content: "Cigars are evil; you won't miss 'em."
                                                  }
                                              },
                                              this
                                             );
                        },
                        function(err, body, resp) {
                            var cb = this;
                            if (err) throw err;
                            act = body;
                            setTimeout(function() { cb(null); }, 5000);
                        },
                        function(err) {
                            var group = this.group();
                            _.each(pairs.slice(1), function(pair) {
                                var user = pair.user,
                                    cred = makeCred(cl, pair);

                                q.enqueue(httputil.getJSON,
                                          ["http://localhost:4815/api/user/"+user.nickname+"/inbox",
                                           cred],
                                          group());
                            });
                        },
                        function(err, feeds) {
                            callback(err, feeds, act);
                        }
                    );
                },
                "it works": function(err, feeds, act) {
                    assert.ifError(err);
                    assert.isArray(feeds);
                    assert.isObject(act);
                },
                "the activity is in there": function(err, feeds, act) {
                    _.each(feeds, function(feed) {
                        assert.isObject(feed);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.greater(feed.items.length, 0);
                        assert.isTrue(_.some(feed.items, function(item) {
                            return (item.id == act.id);
                        }));
                    });
                }
            }
        }
    }
});

suite["export"](module);
