// oauth.js
//
// Utilities for generating clients, request tokens, and access tokens
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

var cp = require("child_process"),
    path = require("path"),
    Step = require("step"),
    _ = require("underscore"),
    http = require("http"),
    OAuth = require("oauth").OAuth,
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

var requestToken = function(cl, hostname, port, cb) {
    var oa;

    if (!port) {
        cb = hostname;
        hostname = "localhost";
        port = 4815;
    }

    oa = new OAuth("http://"+hostname+":"+port+"/oauth/request_token",
                   "http://"+hostname+":"+port+"/oauth/access_token",
                   cl.client_id,
                   cl.client_secret,
                   "1.0",
                   "oob",
                   "HMAC-SHA1",
                   null, // nonce size; use default
                   {"User-Agent": "activitypump-test/0.1.0"});
    
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
            var browser;
            if (err) throw err;
            rt = res;
            browser = new Browser({runScripts: false, waitFor: 60000});
            browser.visit("http://"+hostname+":"+port+"/oauth/authorize?oauth_token=" + rt.token, this);
        },
        function(err, br) {
            if (err) throw err;
            if (!br.success) throw new OAuthError({statusCode: br.statusCode, data: br.error || br.text("#error")});
            br.fill("username", user.nickname, this);
        },
        function(err, br) {
            if (err) throw err;
            br.fill("password", user.password, this);
        },
        function(err, br) {
            if (err) throw err;
            br.pressButton("#authenticate", this);
        },
        function(err, br) {
            if (err) throw err;
            if (!br.success) throw new OAuthError({statusCode: br.statusCode, data: br.error || br.text("#error")});
            br.pressButton("Authorize", this);
        },
        function(err, br) {
            var oa, verifier;
            if (err) throw err;
            if (!br.success) throw new OAuthError({statusCode: br.statusCode, data: br.error || br.text("#error")});
            verifier = br.text("#verifier");
            oa = new OAuth("http://"+hostname+":"+port+"/oauth/request_token",
                           "http://"+hostname+":"+port+"/oauth/access_token",
                           cl.client_id,
                           cl.client_secret,
                           "1.0",
                           "oob",
                           "HMAC-SHA1",
                           null, // nonce size; use default
                           {"User-Agent": "activitypump-test/0.1.0"});
                                        
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

var register = function(cl, nickname, password, hostname, port, callback) {

    if (!port) {
        callback = hostname;
        hostname = "localhost";
        port = 4815;
    }

    httputil.postJSON("http://"+hostname+":"+port+"/api/users", 
                      {consumer_key: cl.client_id, consumer_secret: cl.client_secret}, 
                      {nickname: nickname, password: password},
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
            if (err) throw err;
            regd = res;
            user = {nickname: nickname, password: password};
            accessToken(cl, user, hostname, port, this);
        },
        function(err, res) {
            if (err) {
                cb(err, null);
            } else {
                _.extend(res, {user: regd});
                cb(null, res);
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

    var child = cp.fork(path.join(__dirname, "app.js"), [hostname, port]);

    var dummy = {
        close: function() {
            child.kill();
        }
    };

    child.on("message", function(msg) {
        if (msg.tag == "listening") {
            callback(null, dummy);
        } else if (msg.tag == "error") {
            callback(msg.value, null);
        }
    });
};

exports.requestToken = requestToken;
exports.newClient = newClient;
exports.register = register;
exports.newCredentials = newCredentials;
exports.newPair = newPair;
exports.accessToken = accessToken;
exports.setupApp = setupApp;
