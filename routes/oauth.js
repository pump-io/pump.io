// routes/oauth.js
//
// Routes for the OAuth authentication flow
//
// Copyright 2011-2012, StatusNet Inc.
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

var url = require("url"),
    Step = require("step"),
    _ = require("underscore"),
    authc = require("../lib/authc"),
    RequestToken = require("../lib/model/requesttoken").RequestToken,
    Client = require("../lib/model/client").Client,
    User = require("../lib/model/user").User,
    HTTPError = require("../lib/httperror").HTTPError;

var authenticate = function(req, res) {
    // XXX: I think there's an easier way to get this, but leave it for now.
    var parsedUrl = url.parse(req.originalUrl, true),
        token = parsedUrl.query.oauth_token,
        rt,
        application;

    if (!token) {
        res.render("error", {page: {title: "Error",
                                    nologin: true},
                             status: 400,
                             error: new HTTPError("Must provide an oauth_token", 400)});
    } else {
        Step(
            function() {
                RequestToken.get(token, this);
            },
            function(err, results) {
                if (err) throw err;
                rt = results;
                Client.get(rt.consumer_key, this);
            },
            function(err, results) {
                if (err) throw err;
                application = results;
                req.app.session(req, res, this);
            },
            function(err) {
                if (err) throw err;
                authc.principal(req, res, this);
            },
            function(err) {
                if (err) throw err;
                if (!req.principalUser) {
                    // skip this step
                    this(null, rt);
                    return;
                }
                // We automatically authenticate the RT
                if (rt.username && rt.username != req.principalUser.nickname) {
                    throw new Error("Token already associated with a different user");
                }
                rt.update({username: req.principalUser.nickname, authenticated: true}, this);
            },
            function(err, result) {
                if (err) {
                    res.render("error", {status: 400,
                                         page: {title: "Error",
                                                nologin: true},
                                         error: err});
                } else if (req.principalUser) {
                    res.render("authorization", {page: {title: "Authorization",
                                                        nologin: true},
                                                 token: rt.token,
                                                 verifier: rt.verifier,
                                                 principalUser: req.principalUser,
                                                 principal: req.principal,
                                                 application: application});
                } else if (req.principal) {
                    res.render("error", {status: 400,
                                         page: {title: "Error",
                                                nologin: true},
                                         error: new Error("Logged in as remote user")});
                } else {
                    res.render("authentication", {page: {title: "Authentication",
                                                         nologin: true},
                                                  token: token,
                                                  error: false});
                }
            }
        );
    }
};

var authorize = function(err, req, res, authorized, rt, application, user) {  

    var self = this;
    
    if (err) {
        res.render("authentication", {status: 400,
                                      page: {title: "Authentication",
                                             nologin: true},
                                      token: rt.token,
                                      error: err});
    } else {
        User.get(rt.username, function(err, user) {
            if (err) {
                res.render("error", {status: 400,
                                     page: {title: "Error",
                                            nologin: true},
                                     error: err});
            } else {
                res.render("authorization", {page: {title: "Authorization",
                                                    nologin: true},
                                             token: rt.token,
                                             verifier: rt.verifier,
                                             principalUser: user,
                                             principal: user.profile,
                                             application: application});
            }
        });
    }
};  

var authorizationFinished = function(err, req, res, rt) {

    res.render("authorization-finished", {page: {title: "Authorization Finished",
                                                 nologin: true},
                                          token: rt.token,
                                          verifier: rt.verifier});
};

// Need these for OAuth shenanigans

exports.authenticate = authenticate;
exports.authorize = authorize;
exports.authorizationFinished = authorizationFinished;
