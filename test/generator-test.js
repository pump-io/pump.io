// generator-test.js
//
// Test generator for various write activities
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
                "and we check the user's feed": {
                    topic: function(pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = "http://localhost:4815/api/user/george/feed";
                        
                        httputil.getJSON(url, cred, function(err, doc, resp) {
                            cb(err, doc);
                        });
                    },
                    "registration activity has our generator": function(err, doc) {
                        var reg;
                        assert.ifError(err);
                        assert.isObject(doc);
                        assert.isArray(doc.items);
                        reg = _.find(doc.items, function(activity) { return activity.verb == "join"; });
                        assert.ok(reg);
                        assert.isObject(reg.generator);
                        assert.equal(reg.generator.displayName, "Generator Test");
                    }
                },
                "and we post a note": {
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
                            };
                        
                        httputil.postJSON(url, cred, act, function(err, doc, resp) {
                            cb(err, doc);
                        });
                    },
                    "the resulting activity has a generator": function(err, act) {
                        assert.ifError(err);
                        assert.isObject(act);
                        assert.isObject(act.generator);
                        assert.equal(act.generator.displayName, "Generator Test");
                    }
                },
                "and we post an activity to the minor feed": {
                    topic: function(pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = "http://localhost:4815/api/user/george/feed/minor",
                            act = {
                                verb: "like",
                                object: {
                                    objectType: "note",
                                    id: "urn:uuid:995bb4c8-4870-11e2-b2db-2c8158efb9e9",
                                    content: "i love george"
                                }
                            };
                        
                        httputil.postJSON(url, cred, act, function(err, doc, resp) {
                            cb(err, doc);
                        });
                    },
                    "the resulting activity has a generator": function(err, act) {
                        assert.ifError(err);
                        assert.isObject(act);
                        assert.isObject(act.generator);
                        assert.equal(act.generator.displayName, "Generator Test");
                    }
                },
                "and we post an activity to the major feed": {
                    topic: function(pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = "http://localhost:4815/api/user/george/feed/major",
                            act = {
                                verb: "post",
                                object: {
                                    id: "urn:uuid:7045fd3c-4870-11e2-b038-2c8158efb9e9",
                                    objectType: "image",
                                    displayName: "rosy2.jpg"
                                }
                            };
                        
                        httputil.postJSON(url, cred, act, function(err, doc, resp) {
                            cb(err, doc);
                        });
                    },
                    "the resulting activity has a generator": function(err, act) {
                        assert.ifError(err);
                        assert.isObject(act);
                        assert.isObject(act.generator);
                        assert.equal(act.generator.displayName, "Generator Test");
                    }
                },
                "and we follow someone by posting to the following list": {
                    topic: function(pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = "http://localhost:4815/api/user/george/following",
                            person = {
                                objectType: "person",
                                id: "urn:uuid:b7144562-486f-11e2-b1c7-2c8158efb9e9",
                                displayName: "Cosmo G. Spacely"
                            };
                        
                        httputil.postJSON(url, cred, person, function(err, doc, resp) {
                            cb(err);
                        });
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we check the user's feed": {
                        topic: function(pair, cl) {
                            var cb = this.callback,
                                cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/george/feed";
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                cb(err, doc);
                            });
                        },
                        "follow activity has our generator": function(err, doc) {
                            var follow;
                            assert.ifError(err);
                            assert.isObject(doc);
                            assert.isArray(doc.items);
                            follow = _.find(doc.items, function(activity) {
                                return activity.verb == "follow" &&
                                    activity.object.id == "urn:uuid:b7144562-486f-11e2-b1c7-2c8158efb9e9";
                            });
                            assert.ok(follow);
                            assert.isObject(follow.generator);
                            assert.equal(follow.generator.displayName, "Generator Test");
                        }
                    }
                },
                "and we favorite something by posting to the favorites list": {
                    topic: function(pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = "http://localhost:4815/api/user/george/favorites",
                            image = {
                                objectType: "image",
                                id: "urn:uuid:298cd086-4871-11e2-adf2-2c8158efb9e9",
                                displayName: "IMG3143.JPEG"
                            };
                        
                        httputil.postJSON(url, cred, image, function(err, doc, resp) {
                            cb(err);
                        });
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we check the user's feed": {
                        topic: function(pair, cl) {
                            var cb = this.callback,
                                cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/george/feed";
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                cb(err, doc);
                            });
                        },
                        "favorite activity has our generator": function(err, doc) {
                            var favorite;
                            assert.ifError(err);
                            assert.isObject(doc);
                            assert.isArray(doc.items);
                            favorite = _.find(doc.items, function(activity) {
                                return activity.verb == "favorite" &&
                                    activity.object.id == "urn:uuid:298cd086-4871-11e2-adf2-2c8158efb9e9";
                            });
                            assert.ok(favorite);
                            assert.isObject(favorite.generator);
                            assert.equal(favorite.generator.displayName, "Generator Test");
                        }
                    }
                },
                "and we update a note by PUT": {
                    topic: function(pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = "http://localhost:4815/api/user/george/feed";

                        Step(
                            function() {
                                var act = {
                                    verb: "post",
                                    object: {
                                        objectType: "note",
                                        content: "Stop this crazy thing."
                                    }
                                };
                        
                                httputil.postJSON(url, cred, act, this);
                            },
                            function(err, doc, resp) {
                                var url, obj;
                                if (err) throw err;
                                obj = doc.object;
                                url = obj.links.self.href;
                                obj.content = "Stop this crazy thing!!!!!!!!!";
                                httputil.putJSON(url, cred, obj, this);
                            },
                            function(err, doc, resp) {
                                cb(err);
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we check the user's feed": {
                        topic: function(pair, cl) {
                            var cb = this.callback,
                                cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/george/feed";
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                cb(err, doc);
                            });
                        },
                        "update activity has our generator": function(err, doc) {
                            var update;
                            assert.ifError(err);
                            assert.isObject(doc);
                            assert.isArray(doc.items);
                            update = _.find(doc.items, function(activity) {
                                return activity.verb == "update" &&
                                    activity.object.content == "Stop this crazy thing!!!!!!!!!";
                            });
                            assert.ok(update);
                            assert.isObject(update.generator);
                            assert.equal(update.generator.displayName, "Generator Test");
                        }
                    }
                },
                "and we delete a note by DELETE": {
                    topic: function(pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = "http://localhost:4815/api/user/george/feed";

                        Step(
                            function() {
                                var act = {
                                    verb: "post",
                                    object: {
                                        objectType: "note",
                                        content: "I quit."
                                    }
                                };
                        
                                httputil.postJSON(url, cred, act, this);
                            },
                            function(err, doc, resp) {
                                var url, obj;
                                if (err) throw err;
                                obj = doc.object;
                                url = obj.links.self.href;
                                httputil.delJSON(url, cred, this);
                            },
                            function(err, doc, resp) {
                                cb(err);
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we check the user's feed": {
                        topic: function(pair, cl) {
                            var cb = this.callback,
                                cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/george/feed";
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                cb(err, doc);
                            });
                        },
                        "delete activity has our generator": function(err, doc) {
                            var del;
                            assert.ifError(err);
                            assert.isObject(doc);
                            assert.isArray(doc.items);
                            del = _.find(doc.items, function(activity) {
                                return activity.verb == "delete";
                            });
                            assert.ok(del);
                            assert.isObject(del.generator);
                            assert.equal(del.generator.displayName, "Generator Test");
                        }
                    }
                },
                "and we add a person to a list by posting to the members feed": {
                    topic: function(pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair);

                        Step(
                            function() {
                                var url = "http://localhost:4815/api/user/george/lists/person";
                                httputil.getJSON(url, cred, this);
                            },
                            function(err, doc, resp) {
                                var list, person;
                                if (err) throw err;
                                list = _.find(doc.items, function(item) {
                                    return item.displayName == "Family";
                                });
                                if (!list) {
                                    throw new Error("No 'Family' list found");
                                }
                                person = {
                                    objectType: "person",
                                    id: "urn:uuid:2dbe56f6-4877-11e2-a117-2c8158efb9e9",
                                    displayName: "Elroy Jetson"
                                };
                                httputil.postJSON(list.members.url, cred, person, this);
                            },
                            function(err, doc, resp) {
                                cb(err);
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we check the user's feed": {
                        topic: function(pair, cl) {
                            var cb = this.callback,
                                cred = makeCred(cl, pair),
                                url = "http://localhost:4815/api/user/george/feed";
                            
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                cb(err, doc);
                            });
                        },
                        "add activity has our generator": function(err, doc) {
                            var add;
                            assert.ifError(err);
                            assert.isObject(doc);
                            assert.isArray(doc.items);
                            add = _.find(doc.items, function(activity) {
                                return activity.verb == "add";
                            });
                            assert.ok(add);
                            assert.isObject(add.generator);
                            assert.equal(add.generator.displayName, "Generator Test");
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
