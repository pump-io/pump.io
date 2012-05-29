// user-rest-test.js
//
// Test the client registration API
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

var assert = require('assert'),
    http = require('http'),
    vows = require('vows'),
    Step = require('step'),
    _ = require('underscore'),
    OAuth = require('oauth').OAuth,
    httputil = require('./lib/http'),
    oauthutil = require('./lib/oauth'),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken;

var suite = vows.describe('user REST API');

var invert = function(callback) {
    return function(err) {
        if (err) {
            callback(null);
        } else {
            callback(new Error("Unexpected success"));
        }
    };
};

suite.addBatch({

    'When we set up the app': {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        'it works': function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },

        'and we try to get a non-existent user': {

            topic: function(cl) {
                httputil.getJSON('http://localhost:4815/api/user/nonexistent',
                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                 invert(this.callback));
            },

            'it fails correctly': function(err) {
                assert.ifError(err);
            }
        },

        'and we register a user': {

            topic: function(cl) {
                register(cl, "zardoz", "m3rl1n", this.callback);
            },

            'it works': function(err, user) {
                assert.ifError(err);
            },

            'and we get the options on the user api endpoint': 
            httputil.endpoint('/api/user/zardoz', ['GET', 'PUT', 'DELETE']),

            'and we GET the user data without OAuth credentials': {
                topic: function() {
                    var cb = this.callback,
                        options = {
                            host: 'localhost',
                            port: 4815,
                            path: "/api/user/zardoz"
                        };
                    http.get(options, function(res) {
                        if (res.statusCode >= 400 && res.statusCode < 500) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected status code"));
                        }
                    }).on('error', function(err) {
                        cb(err);
                    });
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we GET the user data with invalid client credentials': {
                topic: function(user, cl) {
                    httputil.getJSON('http://localhost:4815/api/user/zardoz',
                                     {consumer_key: "NOTACLIENT", consumer_secret: "NOTASECRET"},
                                     invert(this.callback));
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we GET the user data with client credentials and no access token': {
                topic: function(user, cl) {
                    httputil.getJSON('http://localhost:4815/api/user/zardoz',
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     this.callback);
                },
                'it works': function(err, doc) {
                    assert.ifError(err);
                    assert.include(doc, 'nickname');
                    assert.include(doc, 'published');
                    assert.include(doc, 'updated');
                    assert.include(doc, 'profile');
                    assert.isObject(doc.profile);
                    assert.include(doc.profile, 'id');
                    assert.include(doc.profile, 'objectType');
                    assert.equal(doc.profile.objectType, 'person');
                }
            },
            'and we GET the user data with client credentials and an invalid access token': {
                topic: function(user, cl) {
                    httputil.getJSON('http://localhost:4815/api/user/zardoz',
                                     {consumer_key: cl.client_id,
                                      consumer_secret: cl.client_secret,
                                      token: "NOTATOKEN",
                                      token_secret: "NOTASECRET"},
                                     invert(this.callback));
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we GET the user data with client credentials and the same user\'s access token': {
                topic: function(user, cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            accessToken(cl, {nickname: "zardoz", password: "m3rl1n"}, this);
                        },
                        function(err, pair) {
                            if (err) throw err;
                            httputil.getJSON('http://localhost:4815/api/user/zardoz',
                                             {consumer_key: cl.client_id,
                                              consumer_secret: cl.client_secret,
                                              token: pair.token,
                                              token_secret: pair.token_secret},
                                              this);
                        },
                        function(err, results) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, results);
                            }
                        }
                    );
                },
                'it works': function(err, doc) {
                    assert.ifError(err);
                    assert.include(doc, 'nickname');
                    assert.include(doc, 'published');
                    assert.include(doc, 'updated');
                    assert.include(doc, 'profile');
                    assert.isObject(doc.profile);
                    assert.include(doc.profile, 'id');
                    assert.include(doc.profile, 'objectType');
                    assert.equal(doc.profile.objectType, 'person');
                }
            },
            'and we GET the user data with client credentials and a different user\'s access token': {
                topic: function(user, cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            register(cl, "yankee", "doodle", this);
                        },
                        function(err, user2) {
                            if (err) throw err;
                            accessToken(cl, {nickname: "yankee", password: "doodle"}, this);
                        },
                        function(err, pair) {
                            if (err) throw err;
                            httputil.getJSON('http://localhost:4815/api/user/zardoz',
                                             {consumer_key: cl.client_id,
                                              consumer_secret: cl.client_secret,
                                              token: pair.token,
                                              token_secret: pair.token_secret},
                                              this);
                        },
                        function(err, results) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, results);
                            }
                        }
                    );
                },
                'it works': function(err, doc) {
                    assert.ifError(err);
                    assert.include(doc, 'nickname');
                    assert.include(doc, 'published');
                    assert.include(doc, 'updated');
                    assert.include(doc, 'profile');
                    assert.isObject(doc.profile);
                    assert.include(doc.profile, 'id');
                    assert.include(doc.profile, 'objectType');
                    assert.equal(doc.profile.objectType, 'person');
                }
            }
        }
    }
});

suite.addBatch({
    'When we set up the app': {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        'it works': function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },

        'and we try to put a non-existent user': {

            topic: function(cl) {
                httputil.putJSON('http://localhost:4815/api/user/nonexistent',
                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                 {nickname: 'nonexistent', password: 'whatever'},
                                 invert(this.callback));
            },

            'it fails correctly': function(err) {
                assert.ifError(err);
            }
        },

        'and we register a user': {

            topic: function(cl) {
                register(cl, "xerxes", "sparta", this.callback);
            },

            'it works': function(err, user) {
                assert.ifError(err);
            },

            'and we PUT new user data without OAuth credentials': {
                topic: function(user, cl) {
                    var cb = this.callback,
                        options = {
                            host: 'localhost',
                            port: 4815,
                            path: "/api/user/xerxes",
                            method: "PUT",
                            headers: {
                                'User-Agent': 'activitypump-test/0.1.0dev',
                                'Content-Type': 'application/json'
                            }
                        };
                    var req = http.request(options, function(res) {
                        if (res.statusCode >= 400 && res.statusCode < 500) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected status code"));
                        }
                    }).on('error', function(err) {
                        cb(err);
                    });
                    req.write(JSON.stringify({nickname: "xerxes", password: "athens"}));
                    req.end();
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we PUT new user data with invalid client credentials': {
                topic: function(user, cl) {
                    httputil.putJSON('http://localhost:4815/api/user/xerxes',
                                     {consumer_key: "BADKEY", consumer_secret: "BADSECRET"},
                                     {nickname: 'xerxes', password: 'thebes'},
                                     invert(this.callback));
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we PUT new user data with client credentials and no access token': {
                topic: function(user, cl) {
                    httputil.putJSON('http://localhost:4815/api/user/xerxes',
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     {nickname: 'xerxes', password: 'corinth'},
                                     invert(this.callback));
                },
                'it works': function(err) {
                    assert.ifError(err);
                }
            },
            'and we PUT new user data with client credentials and an invalid access token': {
                topic: function(user, cl) {
                    httputil.putJSON('http://localhost:4815/api/user/xerxes',
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: "BADTOKEN", token_secret: "BADSECRET"},
                                     {nickname: 'xerxes', password: 'thessaly'},
                                     invert(this.callback));
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we PUT new user data with client credentials and a different user\'s access token': {
                topic: function(user, cl) {
                    var cb = this.callback;
                    
                    Step(
                        function() {
                            register(cl, "themistocles", "salamis", this);
                        },
                        function(err, res) {
                            if (err) throw err;
                            accessToken(cl, {nickname: "themistocles", password: "salamis"}, this);
                        },
                        function(err, pair) {
                            if (err) {
                                cb(err);
                            } else {
                                httputil.putJSON('http://localhost:4815/api/user/xerxes',
                                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                                  token: pair.token, token_secret: pair.token_secret},
                                                 {nickname: 'xerxes', password: 'isuck'},
                                                 invert(cb));
                            }
                        }
                    );
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we PUT new user data with client credentials and the same user\'s access token': {
                topic: function(user, cl) {
                    var cb = this.callback;
                    
                    Step(
                        function() {
                            accessToken(cl, {nickname: "xerxes", password: "sparta"}, this);
                        },
                        function(err, pair) {
                            if (err) {
                                cb(err);
                            } else {
                                httputil.putJSON('http://localhost:4815/api/user/xerxes',
                                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                                  token: pair.token, token_secret: pair.token_secret},
                                                 {nickname: 'xerxes', password: 'athens'},
                                                 cb);
                            }
                        }
                    );
                },
                'it works': function(err, doc) {
                    assert.ifError(err);
                    assert.include(doc, 'nickname');
                    assert.include(doc, 'published');
                    assert.include(doc, 'updated');
                    assert.include(doc, 'profile');
                    assert.isObject(doc.profile);
                    assert.include(doc.profile, 'id');
                    assert.include(doc.profile, 'objectType');
                    assert.equal(doc.profile.objectType, 'person');
                }
            }
        }
    }
});

suite.addBatch({
    'When we set up the app': {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        'it works': function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },
        'and we register a user': {
            topic: function(cl) {
                register(cl, "c3po", "ihateanakin", this.callback);
            },
            'it works': function(err, user) {
                assert.ifError(err);
            },
            'and we get an access token': {
                topic: function(user, cl) {
                    accessToken(cl, {nickname: "c3po", password: "ihateanakin"}, this.callback);
                },
                'it works': function(err, pair) {
                    assert.ifError(err);
                    assert.isObject(pair);
                },
                'and we PUT third-party user data': {
                    topic: function(pair, user, cl) {
                        httputil.putJSON('http://localhost:4815/api/user/c3po',
                                         {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                          token: pair.token, token_secret: pair.token_secret},
                                         {nickname: 'c3po', password: 'ihateanakin', langs: 6000000},
                                         this.callback);
                    },
                    'it works': function(err, res) {
                        assert.ifError(err);
                        assert.include(res, 'langs');
                        assert.equal(res.langs, 6000000);
                    },
                    'and we GET user with third-party data': {
                        topic: function(dup, pair, user, cl) {
                            httputil.getJSON('http://localhost:4815/api/user/c3po',
                                             {consumer_key: cl.client_id,
                                              consumer_secret: cl.client_secret,
                                              token: pair.token,
                                              token_secret: pair.token_secret},
                                             this.callback);
                        },
                        'it works': function(err, res) {
                            assert.ifError(err);
                            assert.include(res, 'langs');
                            assert.equal(res.langs, 6000000);
                        }
                    }
                }
            }
        }
    }
});

suite.addBatch({
    'When we set up the app': {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        'it works': function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },
        'and we register a user': {
            topic: function(cl) {
                register(cl, "willy", "wonka", this.callback);
            },
            'it works': function(err, user) {
                assert.ifError(err);
            },
            'and we get an access token': {
                topic: function(user, cl) {
                    accessToken(cl, {nickname: "willy", password: "wonka"}, this.callback);
                },
                'it works': function(err, pair) {
                    assert.ifError(err);
                },
                'and we PUT a new nickname': {
                    topic: function(pair, user, cl) {
                        httputil.putJSON('http://localhost:4815/api/user/willy',
                                         {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                          token: pair.token, token_secret: pair.token_secret},
                                         {nickname: 'william', password: 'wonka'},
                                         invert(this.callback));
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we PUT a new published value': {
                    topic: function(pair, user, cl) {
                        httputil.putJSON('http://localhost:4815/api/user/willy',
                                         {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                          token: pair.token, token_secret: pair.token_secret},
                                         {nickname: 'willy', password: 'wonka', published: '2001-11-10T00:00:00'},
                                         invert(this.callback));
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we PUT a new updated value': {
                    topic: function(pair, user, cl) {
                        httputil.putJSON('http://localhost:4815/api/user/willy',
                                         {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                          token: pair.token, token_secret: pair.token_secret},
                                         {nickname: 'willy', password: 'wonka', updated: '2003-11-10T00:00:00'},
                                         invert(this.callback));
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we PUT a new profile': {
                    topic: function(pair, user, cl) {
                        var profile = {
                            objectType: "person",
                            id: "urn:uuid:8cec1280-28a6-4173-a523-2207ea964a2a"
                        };
                        httputil.putJSON('http://localhost:4815/api/user/willy',
                                         {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                          token: pair.token, token_secret: pair.token_secret},
                                         {nickname: 'willy', password: 'wonka', profile: profile},
                                         invert(this.callback));
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we PUT new profile data': {
                    topic: function(pair, user, cl) {
                        var profile = user.profile;
                        profile.displayName = "William Q. Wonka";
                        httputil.putJSON('http://localhost:4815/api/user/willy',
                                         {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                          token: pair.token, token_secret: pair.token_secret},
                                         {nickname: 'willy', password: 'wonka', profile: profile},
                                         invert(this.callback));
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                }
            }
        }
    }
});

suite.addBatch({
    'When we set up the app': {

        topic: function() {
            var cb = this.callback;
            setupApp(function(err, app) {
                if (err) {
                    cb(err, null, null);
                } else {
                    newClient(function(err, cl) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(err, cl, app);
                        }
                    });
                }
            });
        },

        'it works': function(err, cl, app) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl, app) {
            if (cl && cl.del) {
                cl.del(function(err) {});
            }
            if (app) {
                app.close();
            }
        },
        'and we register a user': {
            topic: function(cl) {
                register(cl, "victor", "hugo", this.callback);
            },
            'it works': function(err, user) {
                assert.ifError(err);
            },
            'and we DELETE the user without OAuth credentials': {
                topic: function(user, cl) {
                    var cb = this.callback,
                        options = {
                            host: 'localhost',
                            port: 4815,
                            path: "/api/user/victor",
                            method: "DELETE",
                            headers: {
                                'User-Agent': 'activitypump-test/0.1.0dev'
                            }
                        };
                    var req = http.request(options, function(res) {
                        if (res.statusCode >= 400 && res.statusCode < 500) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected status code"));
                        }
                    }).on('error', function(err) {
                        cb(err);
                    });
                    req.end();
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we DELETE the user with invalid client credentials': {
                topic: function(user, cl) {
                    httputil.delJSON('http://localhost:4815/api/user/victor',
                                     {consumer_key: "BADKEY", consumer_secret: "BADSECRET"},
                                     invert(this.callback));
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we DELETE the user with client credentials and no access token': {
                topic: function(user, cl) {
                    httputil.delJSON('http://localhost:4815/api/user/victor',
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     invert(this.callback));
                },
                'it works': function(err) {
                    assert.ifError(err);
                }
            },
            'and we DELETE the user with client credentials and an invalid access token': {
                topic: function(user, cl) {
                    httputil.delJSON('http://localhost:4815/api/user/victor',
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                      token: "BADTOKEN", token_secret: "BADSECRET"},
                                     invert(this.callback));
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we DELETE the user with client credentials and a different user\'s access token': {
                topic: function(user, cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            register(cl, "napoleon", "third", this);
                        },
                        function(err, res) {
                            if (err) throw err;
                            accessToken(cl, {nickname: "napoleon", password: "third"}, this);
                        },
                        function(err, pair) {
                            if (err) {
                                cb(err);
                            } else {
                                httputil.delJSON('http://localhost:4815/api/user/victor',
                                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                                  token: pair.token, token_secret: pair.token_secret},
                                                 invert(cb));
                            }
                        }
                    );
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we DELETE the user with client credentials and the same user\'s access token': {
                topic: function(user, cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            accessToken(cl, {nickname: "victor", password: "hugo"}, this);
                        },
                        function(err, pair) {
                            if (err) {
                                cb(err);
                            } else {
                                httputil.delJSON('http://localhost:4815/api/user/victor',
                                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret,
                                                  token: pair.token, token_secret: pair.token_secret},
                                                 invert(cb));
                            }
                        }
                    );
                },
                'it works': function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite['export'](module);
