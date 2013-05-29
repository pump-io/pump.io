// oauth-test.js
//
// Test the client registration API
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
    fs = require("fs"),
    path = require("path"),
    OAuth = require("oauth-evanp").OAuth,
    Browser = require("zombie"),
    version = require("../lib/version").version,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    setupAppConfig = oauthutil.setupAppConfig,
    requestToken = oauthutil.requestToken,
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken;

var ignore = function(err) {};
var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var suite = vows.describe("OAuth authorization");

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we try to get the authorization form without a request token": {
            topic: function() {
                var cb = this.callback,
                    options = {
                        host: "localhost",
                        port: 4815,
                        path: "/oauth/authorize"
                    };
                http.get(options, function(res) {
                    if (res.statusCode >= 400 && res.statusCode < 500) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected status code"));
                    }
                }).on("error", function(err) {
                    cb(err);
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to get the authorization form with an invalid request token": {
            topic: function() {
                var cb = this.callback,
                    options = {
                        host: "localhost",
                        port: 4815,
                        path: "/oauth/authorize?oauth_token=NOTAREQUESTTOKEN"
                    };
                http.get(options, function(res) {
                    if (res.statusCode >= 400 && res.statusCode < 500) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected status code"));
                    }
                }).on("error", function(err) {
                    cb(err);
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to get an access token without any OAuth credentials": {
            topic: function() {
                var cb = this.callback;
                httputil.post("localhost", 4815, "/oauth/access_token", {}, function(err, res, body) {
                    if (err) {
                        cb(err);
                    } else if (res.statusCode === 400) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to get an access token with an invalid client key": {
            topic: function() {
                var cb = this.callback,
                    oa;

                oa = new OAuth("http://localhost:4815/oauth/request_token",
                               "http://localhost:4815/oauth/access_token",
                               "NOTACLIENT",
                               "NOTASECRET",
                               "1.0",
                               "oob",
                               "HMAC-SHA1",
                               null, // nonce size; use default
                               {"User-Agent": "pump.io/"+version});
                                        
                oa.getOAuthAccessToken("NOTATOKEN", "NOTATOKENSECRET", "NOTAVERIFIER", function(err, token, secret) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to get an access token with an valid client key and invalid client secret": {
            topic: function() {
                var cb = this.callback;
                Step(
                    function() {
                        newClient(this);
                    },
                    function(err, cl) {
                        if (err) throw err;
                        var oa = new OAuth("http://localhost:4815/oauth/request_token",
                                           "http://localhost:4815/oauth/access_token",
                                           cl.client_id,
                                           "NOTASECRET",
                                           "1.0",
                                           "oob",
                                           "HMAC-SHA1",
                                           null, // nonce size; use default
                                           {"User-Agent": "pump.io/"+version});
                        
                        oa.getOAuthAccessToken("NOTATOKEN", "NOTATOKENSECRET", "NOTAVERIFIER", function(err, token, secret) {
                            if (err) {
                                cb(null, cl);
                            } else {
                                cb(new Error("Unexpected success"), null);
                            }
                        });
                    }
                );
            },
            "it fails correctly": function(err, cl) {
                assert.ifError(err);
            },
            teardown: function(cl) {
                if (cl && cl.del) {
                    cl.del(ignore);
                }
            }
        },
        "and we try to get an access token with an valid client key and valid client secret and invalid request token": {
            topic: function() {
                var cb = this.callback;
                Step(
                    function() {
                        newClient(this);
                    },
                    function(err, cl) {
                        if (err) throw err;
                        var oa = new OAuth("http://localhost:4815/oauth/request_token",
                                           "http://localhost:4815/oauth/access_token",
                                           cl.client_id,
                                           cl.client_secret,
                                           "1.0",
                                           "oob",
                                           "HMAC-SHA1",
                                           null, // nonce size; use default
                                           {"User-Agent": "pump.io/"+version});
                        
                        oa.getOAuthAccessToken("NOTATOKEN", "NOTATOKENSECRET", "NOTAVERIFIER", function(err, token, secret) {
                            if (err) {
                                cb(null, cl);
                            } else {
                                cb(new Error("Unexpected success"), null);
                            }
                        });
                    }
                );
            },
            "it fails correctly": function(err, cl) {
                assert.ifError(err);
            },
            teardown: function(cl) {
                if (cl && cl.del) {
                    cl.del(ignore);
                }
            }
        },
        "and we try to get an access token with an valid client key and valid client secret and valid request token and invalid request token secret": {
            topic: function() {
                var cb = this.callback,
                    cl;

                Step(
                    function() {
                        newClient(this);
                    },
                    function(err, client) {
                        if (err) throw err;
                        cl = client;
                        requestToken(cl, this);
                    },
                    function(err, rt) {
                        var oa = new OAuth("http://localhost:4815/oauth/request_token",
                                           "http://localhost:4815/oauth/access_token",
                                           cl.client_id,
                                           cl.client_secret,
                                           "1.0",
                                           "oob",
                                           "HMAC-SHA1",
                                           null, // nonce size; use default
                                           {"User-Agent": "pump.io/"+version});
                        
                        oa.getOAuthAccessToken(rt.token, "NOTATOKENSECRET", "NOTAVERIFIER", function(err, token, secret) {
                            if (err) {
                                cb(null, {cl: cl, rt: rt});
                            } else {
                                cb(new Error("Unexpected success"), null);
                            }
                        });
                    }
                );
            },
            "it fails correctly": function(err, res) {
                assert.ifError(err);
            },
            teardown: function(res) {
                if (res.cl && res.cl.del) {
                    res.cl.del(ignore);
                }
                if (res.rt && res.rt.del) {
                    res.rt.del(ignore);
                }
            }
        },
        "and we try to get an access token with an valid client key and valid client secret and valid request token and valid request token secret and invalid verifier": {
            topic: function() {
                var cb = this.callback,
                    cl;

                Step(
                    function() {
                        newClient(this);
                    },
                    function(err, client) {
                        if (err) throw err;
                        cl = client;
                        requestToken(cl, this);
                    },
                    function(err, rt) {
                        var oa = new OAuth("http://localhost:4815/oauth/request_token",
                                           "http://localhost:4815/oauth/access_token",
                                           cl.client_id,
                                           cl.client_secret,
                                           "1.0",
                                           "oob",
                                           "HMAC-SHA1",
                                           null, // nonce size; use default
                                           {"User-Agent": "pump.io/"+version});
                        
                        oa.getOAuthAccessToken(rt.token, rt.token_secret, "NOTAVERIFIER", function(err, token, secret) {
                            if (err) {
                                cb(null, {cl: cl, rt: rt});
                            } else {
                                cb(new Error("Unexpected success"), null);
                            }
                        });
                    }
                );
            },
            "it fails correctly": function(err, res) {
                assert.ifError(err);
            },
            teardown: function(res) {
                if (res.cl && res.cl.del) {
                    res.cl.del(ignore);
                }
                if (res.rt && res.rt.del) {
                    res.rt.del(ignore);
                }
            }
        },
        "and we submit the authentication form with the wrong password": {
            topic: function() {
                var callback = this.callback,
                    cl,
                    br;

                Step(
                    function() {
                        newClient(this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        cl = results;
                        httputil.postJSON("http://localhost:4815/api/users", 
                                          {consumer_key: cl.client_id, consumer_secret: cl.client_secret}, 
                                          {nickname: "dormouse", password: "feed*ur*head"},
                                          this);
                    },
                    function(err, user) {
                        if (err) throw err;
                        requestToken(cl, this);
                    },
                    function(err, rt) {
                        if (err) throw err;
                        br = new Browser({runScripts: false});
                        br.visit("http://localhost:4815/oauth/authorize?oauth_token=" + rt.token, this);
                    },
                    function(err, br) {
                        if (err) throw err;
                        if (!br.success) throw new Error("Browser error");
                        br.fill("username", "dormouse", this);
                    },
                    function(err) {
                        if (err) throw err;
                        br.fill("password", "BADPASSWORD", this);
                    },
                    function(err) {
                        if (err) throw err;
                        br.pressButton("#authenticate", this);
                    },
                    function(err) {
                        if (err && br.statusCode >= 400 && br.statusCode < 500) {
                            callback(null);
                        } else if (err) {
                            callback(err);
                        } else {
                            callback(new Error("Unexpected success"));
                        }
                    }
                );
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we submit the authentication form with a non-existent user": {
            topic: function() {
                var callback = this.callback,
                    cl,
                    br;

                Step(
                    function() {
                        newClient(this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        cl = results;
                        requestToken(cl, this);
                    },
                    function(err, rt) {
                        if (err) throw err;
                        br = new Browser({runScripts: false});
                        br.visit("http://localhost:4815/oauth/authorize?oauth_token=" + rt.token, this);
                    },
                    function(err, br) {
                        if (err) throw err;
                        if (!br.success) throw new Error("Browser error");
                        br.fill("username", "nonexistent", this);
                    },
                    function(err) {
                        if (err) throw err;
                        br.fill("password", "DOESNTMATTER", this);
                    },
                    function(err) {
                        if (err) throw err;
                        br.pressButton("#authenticate", this);
                    },
                    function(err) {
                        if (err && br.statusCode >= 400 && br.statusCode < 500) {
                            callback(null);
                        } else if (err) {
                            callback(err);
                        } else {
                            callback(new Error("Unexpected success"));
                        }
                    }
                );
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we create a client using the api": {
            topic: function() {
                newClient(this.callback);
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
                assert.isString(cl.client_id);
                assert.isString(cl.client_secret);
            },
            "and we create a user using the API": {
                topic: function(cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            newClient(this);
                        },
                        function(err, other) {
                            if (err) throw err;
                            httputil.postJSON("http://localhost:4815/api/users", 
                                              {consumer_key: other.client_id, consumer_secret: other.client_secret}, 
                                              {nickname: "alice", password: "white*rabbit"},
                                              this);
                        },
                        function(err, user, resp) {
                            cb(err, user);
                        }
                    );
                },
                "it works": function(err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                },
                "and we request a request token with valid client_id and client_secret": {
                    topic: function(user, cl) {
                        requestToken(cl, this.callback);
                    },
                    "it works": function(err, cred) {
                        assert.ifError(err);
                        assert.isObject(cred);
                    },
                    "it has the right results": function(err, cred) {
                        assert.include(cred, "token");
                        assert.isString(cred.token);
                        assert.include(cred, "token_secret");
                        assert.isString(cred.token_secret);
                    },
                    "and we get the authentication form": {
                        topic: function(rt) {
                            var cb = this.callback;
                            Browser.runScripts = false;
                            Browser.visit("http://localhost:4815/oauth/authorize?oauth_token=" + rt.token, cb);
                        },
                        "it works": function(err, browser) {
                            assert.ifError(err);
                            assert.ok(browser.success);
                        },
                        "it contains the login form": function(err, browser) {
                            assert.ok(browser.query("form#oauth-authentication"));
                        },
                        "and we submit the authentication form": {
                            topic: function(browser) {
                                var cb = this.callback;
                                browser.fill("username", "alice", function(err) {
                                    if (err) {
                                        cb(err);
                                    } else {
                                        browser.fill("password", "white*rabbit", function(err) {
                                            if (err) {
                                                cb(err);
                                            } else {
                                                browser.pressButton("#authenticate", function(err) {
                                                    cb(err, browser);
                                                });
                                            }
                                        });
                                    }
                                });
                            },
                            "it works": function(err, browser) {
                                assert.ifError(err);
                                assert.ok(browser.success);
                            },
                            "it has the right location": function(err, browser) {
                                assert.equal(browser.location.pathname, "/oauth/authorize");
                            },
                            "it contains the authorization form": function(err, browser) {
                                assert.ok(browser.query("form#authorize"));
                            },
                            "and we submit the authorization form": {
                                topic: function(browser) {
                                    var cb = this.callback;
                                    browser.pressButton("Authorize", function(err) {
                                        if (err) {
                                            cb(err, null);
                                        } else if (!browser.success) {
                                            cb(new Error("Browser not successful"), null);
                                        } else {
                                            cb(null, {token: browser.text("#token"),
                                                      verifier: browser.text("#verifier")});
                                                      
                                        }
                                    });
                                },
                                "it works": function(err, results) {
                                    assert.ifError(err);
                                },
                                "results include token and verifier": function(err, results) {
                                    assert.isString(results.token);
                                    assert.isString(results.verifier);
                                },
                                "and we try to get an access token": {
                                    topic: function(pair) {
                                        var cb = this.callback,
                                            oa,
                                            rt = arguments[5],
                                            cl = arguments[7];

                                        oa = new OAuth("http://localhost:4815/oauth/request_token",
                                                       "http://localhost:4815/oauth/access_token",
                                                       cl.client_id,
                                                       cl.client_secret,
                                                       "1.0",
                                                       "oob",
                                                       "HMAC-SHA1",
                                                       null, // nonce size; use default
                                                       {"User-Agent": "pump.io/"+version});
                                        
                                        oa.getOAuthAccessToken(pair.token, rt.token_secret, pair.verifier, function(err, token, secret) {
                                            if (err) {
                                                cb(new Error(err.data), null);
                                            } else {
                                                cb(null, {token: token, token_secret: secret});
                                            }
                                        });
                                    },
                                    "it works": function(err, pair) {
                                        assert.ifError(err);
                                    },
                                    "results are correct": function(err, pair) {
                                        assert.isObject(pair);
                                        assert.include(pair, "token");
                                        assert.isString(pair.token);
                                        assert.include(pair, "token_secret");
                                        assert.isString(pair.token_secret);
                                    },
                                    "and we try to get another access token with the same data": {
                                        topic: function() {
                                            var cb = this.callback,
                                                oa,
                                                pair = arguments[1],
                                                rt = arguments[6],
                                                cl = arguments[8];

                                            oa = new OAuth("http://localhost:4815/oauth/request_token",
                                                           "http://localhost:4815/oauth/access_token",
                                                           cl.client_id,
                                                           cl.client_secret,
                                                           "1.0",
                                                           "oob",
                                                           "HMAC-SHA1",
                                                           null, // nonce size; use default
                                                           {"User-Agent": "pump.io/"+version});
                                            oa.getOAuthAccessToken(pair.token, rt.token_secret, pair.verifier, function(err, token, secret) {
                                                if (err) {
                                                    cb(null);
                                                } else {
                                                    cb(new Error("Unexpected success"));
                                                }
                                            });
                                        },
                                        "it fails correctly": function(err) {
                                            assert.ifError(err);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
