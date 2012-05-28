// oauth-test.js
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
    vows = require('vows'),
    Step = require('step'),
    _ = require('underscore'),
    querystring = require('querystring'),
    http = require('http'),
    OAuth = require('oauth').OAuth,
    Browser = require('zombie'),
    httputil = require('./lib/http');

var requestToken = function(cl, cb) {
    var oa;
    oa = new OAuth('http://localhost:4815/oauth/request_token',
                   'http://localhost:4815/oauth/access_token',
                   cl.client_id,
                   cl.client_secret,
                   "1.0",
                   "oob",
                   "HMAC-SHA1",
                   null, // nonce size; use default
                   {"User-Agent": "activitypump-test/0.1.0"});
    
    oa.getOAuthRequestToken(function(err, token, secret) {
        if (err) {
            cb(new Error(err.data), null);
        } else {
            cb(null, {token: token, token_secret: secret});
        }
    });
};

var suite = vows.describe('OAuth authorization');

suite.addBatch({
    'When we set up the app': {
        topic: function() {
            var cb = this.callback,
                config = {port: 4815,
                          hostname: 'localhost',
                          driver: 'memory',
                          params: {},
                          nologger: true
                         },
                makeApp = require('../lib/app').makeApp;

            process.env.NODE_ENV = 'test';

            makeApp(config, function(err, app) {
                if (err) {
                    cb(err, null);
                } else {
                    app.run(function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, app);
                        }
                    });
                }
            });
        },
        teardown: function(app) {
            app.close();
        },
        'it works': function(err, app) {
            assert.ifError(err);
        },
        'and we try to get the authorization form without a request token': {
            topic: function() {
                var cb = this.callback,
                    options = {
                        host: 'localhost',
                        port: 4815,
                        path: "/oauth/authorize"
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
        'and we try to get the authorization form with an invalid request token': {
            topic: function() {
                var cb = this.callback,
                    options = {
                        host: 'localhost',
                        port: 4815,
                        path: "/oauth/authorize?oauth_token=NOTAREQUESTTOKEN"
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
        'and we create a client using the api': {
            topic: function() {
                var cb = this.callback;
                httputil.post('localhost', 4815, '/api/client/register', {type: 'client_associate'}, function(err, res, body) {
                    var cl;
                    if (err) {
                        cb(err, null);
                    } else {
                        try {
                            cl = JSON.parse(body);
                            cb(null, cl);
                        } catch (err) {
                            cb(err, null);
                        }
                    }
                });
            },
            'it works': function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
                assert.isString(cl.client_id);
                assert.isString(cl.client_secret);
            },
            'and we create a user using the API': {
                topic: function(cl) {
                    var cb = this.callback,
                        resp = function(err, res, body) {
                            var user;
                            if (err) {
                                cb(new Error(err.data), null);
                            } else {
                                try {
                                    user = JSON.parse(body);
                                    cb(null, user);
                                } catch (err) {
                                    cb(err, null);
                                }
                            }
                        };

                    httputil.postJSON('http://localhost:4815/api/users', 
                                      {consumer_key: cl.client_id, consumer_secret: cl.client_secret}, 
                                      {nickname: "alice", password: "whiterabbit"},
                                      resp);
                },
                'it works': function(err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                },
                'and we request a request token with valid client_id and client_secret': {
                    topic: function(user, cl) {
                        requestToken(cl, this.callback);
                    },
                    'it works': function(err, cred) {
                        assert.ifError(err);
                        assert.isObject(cred);
                    },
                    'it has the right results': function(err, cred) {
                        assert.include(cred, 'token');
                        assert.isString(cred.token);
                        assert.include(cred, 'token_secret');
                        assert.isString(cred.token_secret);
                    },
                    'and we get the authentication form': {
                        topic: function(rt) {
                            var cb = this.callback;
                            Browser.visit("http://localhost:4815/oauth/authorize?oauth_token=" + rt.token, cb);
                        },
                        'it works': function(err, browser) {
                            assert.ifError(err);
                            assert.ok(browser.success);
                        },
                        'it contains the login form': function(err, browser) {
                            assert.ok(browser.query("form#login"));
                        },
                        'and we submit the authentication form': {
                            topic: function(browser) {
                                var cb = this.callback;
                                browser.fill("username", "alice", function(err) {
                                    browser.fill("password", "whiterabbit", function(err) {
                                        browser.pressButton("Login", cb);
                                    });
                                });
                            },
                            'it works': function(err, browser) {
                                assert.ifError(err);
                                assert.ok(browser.success);
                            },
                            'it has the right location': function(err, browser) {
                                assert.equal(browser.location.pathname, "/oauth/authorize");
                            },
                            'it contains the authorization form': function(err, browser) {
                                assert.ok(browser.query("form#authorize"));
                            },
                            'and we submit the authorization form': {
                                topic: function(browser) {
                                    var cb = this.callback;
                                    browser.pressButton("Authorize", cb);
                                },
                                'it works': function(err, browser) {
                                    assert.ifError(err);
                                    assert.ok(browser.success);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

suite['export'](module);