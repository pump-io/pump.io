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

var suite = vows.describe('user followers API');

var invert = function(callback) {
    return function(err) {
        if (err) {
            callback(null);
        } else {
            callback(new Error("Unexpected success"));
        }
    };
};

var assertValidList = function(doc, count) {
    assert.include(doc, 'author');
    assert.include(doc.author, 'id');
    assert.include(doc.author, 'displayName');
    assert.include(doc.author, 'objectType');
    assert.include(doc, 'totalCount');
    assert.include(doc, 'items');
    assert.include(doc, 'displayName');
    assert.include(doc, 'id');
    assert.include(doc, 'objectTypes');
    assert.include(doc.objectTypes, 'person');
    if (_(count).isNumber()) {
        assert.equal(doc.totalCount, 0);
        assert.isEmpty(doc.items);
    }
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
                            // sneaky, but we just need it for teardown
                            cl.app = app;
                            cb(err, cl);
                        }
                    });
                }
            });
        },

        'it works': function(err, cl) {
            assert.ifError(err);
            assert.isObject(cl);
        },

        teardown: function(cl) {
            if (cl.app) {
                cl.app.close();
            }
        },

        'and we try to get followers for a non-existent user': {
            topic: function(cl) {
                var cb = this.callback;
                httputil.getJSON('http://localhost:4815/api/user/nonexistent/followers',
                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                 function(err, followers, result) {
                                     if (err && err.statusCode && err.statusCode === 404) {
                                         cb(null);
                                     } else if (err) {
                                         cb(err);
                                     } else {
                                         cb(new Error("Unexpected success"));
                                     }
                                 });
            },

            'it fails correctly': function(err) {
                assert.ifError(err);
            }
        },

        'and we try to get following for a non-existent user': {
            topic: function(cl) {
                var cb = this.callback;
                httputil.getJSON('http://localhost:4815/api/user/nonexistent/following',
                                 {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                 function(err, followers, result) {
                                     if (err && err.statusCode && err.statusCode === 404) {
                                         cb(null);
                                     } else if (err) {
                                         cb(err);
                                     } else {
                                         cb(new Error("Unexpected success"));
                                     }
                                 });
            },

            'it fails correctly': function(err) {
                assert.ifError(err);
            }
        },

        'and we register a user': {

            topic: function(cl) {
                register(cl, "tyrion", "payURdebts", this.callback);
            },

            'it works': function(err, user) {
                assert.ifError(err);
            },

            'and we get the options on the user followers endpoint': 
            httputil.endpoint('/api/user/tyrion/followers', ['GET']),

            'and we get the options on the user following endpoint': 
            httputil.endpoint('/api/user/tyrion/followers', ['GET']),

            'and we GET the followers list without OAuth credentials': {
                topic: function() {
                    var cb = this.callback,
                        options = {
                            host: 'localhost',
                            port: 4815,
                            path: "/api/user/tyrion/followers"
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
            'and we GET the followers list with invalid client credentials': {
                topic: function(user, cl) {
                    httputil.getJSON('http://localhost:4815/api/user/tyrion/followers',
                                     {consumer_key: "NOTACLIENT", consumer_secret: "NOTASECRET"},
                                     invert(this.callback));
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we GET the followers list with client credentials and no access token': {
                topic: function(user, cl) {
                    httputil.getJSON('http://localhost:4815/api/user/tyrion/followers',
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     this.callback);
                },
                'it works': function(err, doc) {
                    assert.ifError(err);
                    assertValidList(doc, 0);
                }
            },
            'and we GET the followers list with client credentials and an invalid access token': {
                topic: function(user, cl) {
                    httputil.getJSON('http://localhost:4815/api/user/tyrion/followers',
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
            'and we get an access token': {
                topic: function(user, cl) {
                    accessToken(cl, {nickname: "tyrion", password: "payURdebts"}, this.callback);
                },
                'it works': function(err, pair) {
                    assert.ifError(err);
                },
                'and we GET the following list with client credentials and the same user\'s access token': {
                    topic: function(pair, user, cl) {
                        var cb = this.callback;
                        Step(
                            function() {
                                httputil.getJSON('http://localhost:4815/api/user/tyrion/following',
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
                        assertValidList(doc, 0);
                    }
                },
                'and we GET the followers list with client credentials and the same user\'s access token': {
                    topic: function(pair, user, cl) {
                        var cb = this.callback;
                        Step(
                            function() {
                                httputil.getJSON('http://localhost:4815/api/user/tyrion/followers',
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
                        assertValidList(doc, 0);
                    }
                }
            },
            'and we GET the followers list with client credentials and a different user\'s access token': {
                topic: function(user, cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            register(cl, "cersei", "p0wer", this);
                        },
                        function(err, user2) {
                            if (err) throw err;
                            accessToken(cl, {nickname: "cersei", password: "p0wer"}, this);
                        },
                        function(err, pair) {
                            if (err) throw err;
                            httputil.getJSON('http://localhost:4815/api/user/tyrion/followers',
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
                    assertValidList(doc, 0);
                }
            },
            'and we GET the following list without OAuth credentials': {
                topic: function() {
                    var cb = this.callback,
                        options = {
                            host: 'localhost',
                            port: 4815,
                            path: "/api/user/tyrion/following"
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
            'and we GET the following list with invalid client credentials': {
                topic: function(user, cl) {
                    httputil.getJSON('http://localhost:4815/api/user/tyrion/following',
                                     {consumer_key: "NOTACLIENT", consumer_secret: "NOTASECRET"},
                                     invert(this.callback));
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and we GET the following list with client credentials and no access token': {
                topic: function(user, cl) {
                    httputil.getJSON('http://localhost:4815/api/user/tyrion/following',
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     this.callback);
                },
                'it works': function(err, doc) {
                    assert.ifError(err);
                    assertValidList(doc, 0);
                }
            },
            'and we GET the following list with client credentials and an invalid access token': {
                topic: function(user, cl) {
                    httputil.getJSON('http://localhost:4815/api/user/tyrion/following',
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
            'and we GET the following list with client credentials and a different user\'s access token': {
                topic: function(user, cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            register(cl, "tywin", "c4st3rly*r0ck", this);
                        },
                        function(err, user2) {
                            if (err) throw err;
                            accessToken(cl, {nickname: "tywin", password: "c4st3rly*r0ck"}, this);
                        },
                        function(err, pair) {
                            if (err) throw err;
                            httputil.getJSON('http://localhost:4815/api/user/tyrion/following',
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
                    assertValidList(doc, 0);
                }
            }
        }
    }
});


suite['export'](module);
