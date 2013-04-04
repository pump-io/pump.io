// oauth.js
//
// Utilities for generating clients, request tokens, and access tokens
//
// Copyright 2012-2013 E14N https://e14n.com/
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

var cp = require("child_process"),
    urlfmt = require("url").format,
    path = require("path"),
    Step = require("step"),
    _ = require("underscore"),
    http = require("http"),
    version = require("../../lib/version").version,
    OAuth = require("oauth-evanp").OAuth,
    Browser = require("zombie"),
    httputil = require("./http");

var OAuthError = function(obj) {
    Error.captureStackTrace(this, OAuthError);
    this.name = "OAuthError";  
    _.extend(this, obj);
};

OAuthError.prototype = new Error();  
OAuthError.prototype.constructor = OAuthError;

OAuthError.prototype.toString = function() {
    return "OAuthError (" + this.statusCode + "):" + this.data;
};

var getOAuth = function(hostname, port, client_id, client_secret) {

    var proto = (port === 443) ? "https" : "http",
            rtendpoint = urlfmt({protocol: proto,
                                 host: (port == 80 || port == 443) ? hostname : hostname+":"+port,
                                 pathname: "/oauth/request_token"}),
            atendpoint = urlfmt({protocol: proto,
                                 host: (port == 80 || port == 443) ? hostname : hostname+":"+port,
                                 pathname: "/oauth/access_token"}),
        oa = new OAuth(rtendpoint,
                       atendpoint,
                       client_id,
                       client_secret,
                       "1.0",
                       "oob",
                       "HMAC-SHA1",
                       null, // nonce size; use default
                       {"User-Agent": "pump.io/"+version});

    return oa;
};

var requestToken = function(cl, hostname, port, cb) {
    var oa,
        proto,
        rtendpoint,
        atendpoint;

    if (!port) {
        cb = hostname;
        hostname = "localhost";
        port = 4815;
    }

    oa = getOAuth(hostname, port, cl.client_id, cl.client_secret);

    oa.getOAuthRequestToken(function(err, token, secret) {
        if (err) {
            cb(new OAuthError(err), null);
        } else {
            cb(null, {token: token, token_secret: secret});
        }
    });
};

var newClient = function(hostname, port, cb) {

    if (!port) {
        cb = hostname;
        hostname = "localhost";
        port = 4815;
    }

    httputil.post(hostname, port, "/api/client/register", {type: "client_associate"}, function(err, res, body) {
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
};

var authorize = function(cl, rt, user, hostname, port, cb) {

    var browser = new Browser({runScripts: false, waitFor: 60000});

    if (!port) {
        cb = hostname;
        hostname = "localhost";
        port = 4815;
    }

    Step(
        function() {
            var proto = (port === 443) ? "https" : "http",
                url = urlfmt({protocol: proto,
                              host: (port == 80 || port == 443) ? hostname : hostname+":"+port,
                              pathname: "/oauth/authorize",
                              query: {oauth_token: rt.token}});
            
            browser.visit(url, this);
        },
        function(err) {
            if (err) throw err;
            if (!browser.success) throw new OAuthError({statusCode: browser.statusCode, data: browser.error || browser.text("#error")});
            browser.fill("#username", user.nickname, this);
        },
        function(err) {
            if (err) throw err;
            browser.fill("#password", user.password, this);
        },
        function(err) {
            if (err) throw err;
            browser.pressButton("#authenticate", this);
        },
        function(err) {
            var verifier;
            if (err) throw err;
            if (!browser.success) throw new OAuthError({statusCode: browser.statusCode, data: browser.error || browser.text("#error")});
            verifier = browser.text("#verifier");
            if (verifier) {
                cb(null, verifier);
            } else {
                browser.pressButton("Authorize", this);
            }
        },
        function(err) {
            var verifier;
            if (err) throw err;
            if (!browser.success) throw new OAuthError({statusCode: browser.statusCode, data: browser.error || browser.text("#error")});
            verifier = browser.text("#verifier");
            this(null, verifier);
        },
        cb
    );
};

var redeemToken = function(cl, rt, verifier, hostname, port, cb) {

    if (!port) {
        cb = hostname;
        hostname = "localhost";
        port = 4815;
    }

    Step(
        function() {
            var oa = getOAuth(hostname, port, cl.client_id, cl.client_secret);
            oa.getOAuthAccessToken(rt.token, rt.token_secret, verifier, this);
        },
        function(err, token, secret, res) {
            var pair;
            if (err) {
                if (err instanceof Error) {
                    cb(err, null);
                } else {
                    cb(new Error(err.data), null);
                }
            } else {
                pair = {token: token, token_secret: secret};
                cb(null, pair);
            }
        }
    );
};

var accessToken = function(cl, user, hostname, port, cb) {

    var rt;

    if (!port) {
        cb = hostname;
        hostname = "localhost";
        port = 4815;
    }

    Step(
        function() {
            requestToken(cl, hostname, port, this);
        },
        function(err, res) {
            if (err) throw err;
            rt = res;
            authorize(cl, rt, user, hostname, port, this);
        },
        function(err, verifier) {
            if (err) throw err;
            redeemToken(cl, rt, verifier, hostname, port, this);
        },
        cb
    );
};

var register = function(cl, nickname, password, hostname, port, callback) {
    var proto;

    if (!port) {
        callback = hostname;
        hostname = "localhost";
        port = 4815;
    }

    proto = (port === 443) ? "https" : "http";

    httputil.postJSON(proto+"://"+hostname+":"+port+"/api/users", 
                      {consumer_key: cl.client_id, consumer_secret: cl.client_secret}, 
                      {nickname: nickname, password: password},
                      function(err, body, res) {
                          callback(err, body);
                      });
};

var registerEmail = function(cl, nickname, password, email, hostname, port, callback) {
    var proto;

    if (!port) {
        callback = hostname;
        hostname = "localhost";
        port = 4815;
    }

    proto = (port === 443) ? "https" : "http";

    httputil.postJSON(proto+"://"+hostname+":"+port+"/api/users", 
                      {consumer_key: cl.client_id, consumer_secret: cl.client_secret}, 
                      {nickname: nickname, password: password, email: email},
                      function(err, body, res) {
                          callback(err, body);
                      });
};

var newCredentials = function(nickname, password, hostname, port, cb) {

    var cl, user;

    if (!port) {
        cb = hostname;
        hostname = "localhost";
        port = 4815;
    }
    
    Step(
        function() {
            newClient(hostname, port, this);
        },
        function(err, res) {
            if (err) throw err;
            cl = res;
            newPair(cl, nickname, password, hostname, port, this);
        },
        function(err, res) {
            if (err) {
                cb(err, null);
            } else {
                _.extend(res, {consumer_key: cl.client_id,
                               consumer_secret: cl.client_secret});
                cb(err, res);
            }
        }
    );
};

var newPair = function(cl, nickname, password, hostname, port, cb) {
    var user,
        regd;

    if (!port) {
        cb = hostname;
        hostname = "localhost";
        port = 4815;
    }

    Step(
        function() {
            register(cl, nickname, password, hostname, port, this);
        },
        function(err, res) {
            var pair;
            if (err) {
                cb(err, null);
            } else {
                user = res;
                pair = {
                    token: user.token,
                    token_secret: user.secret,
                    user: user
                };
                delete user.token;
                delete user.secret;
                cb(null, pair);
            }
        }
    );
};

// Call as setupApp(port, hostname, callback)
// setupApp(hostname, callback)
// setupApp(callback)

var setupApp = function(port, hostname, callback) {

    if (!hostname) {
        callback = port;
        hostname = "localhost";
        port = 4815;
    }

    if (!callback) {
        callback = hostname;
        hostname = "localhost";
    }

    port = port || 4815;
    hostname = hostname || "localhost";

    var config = {
        port: port,
        hostname: hostname
    };

    setupAppConfig(config, callback);
};

var setupAppConfig = function(config, callback) {

    var prop, args = [];

    config.port = config.port || 4815;
    config.hostname = config.hostname || "localhost";

    for (prop in config) {
        args.push(prop + "=" + config[prop]);
    }

    var child = cp.fork(path.join(__dirname, "app.js"), args);

    var dummy = {
        close: function() {
            child.kill();
        }
    };

    child.on("message", function(msg) {
        if (msg.cmd == "listening") {
            callback(null, dummy);
        } else if (msg.cmd == "error") {
            callback(msg.value, null);
        }
    });
};

exports.requestToken = requestToken;
exports.newClient = newClient;
exports.register = register;
exports.registerEmail = registerEmail;
exports.newCredentials = newCredentials;
exports.newPair = newPair;
exports.accessToken = accessToken;
exports.authorize = authorize;
exports.redeemToken = redeemToken;
exports.setupApp = setupApp;
exports.setupAppConfig = setupAppConfig;
