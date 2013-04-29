// routes/oauth.js
//
// Routes for the OAuth authentication flow
//
// Copyright 2011-2013, E14N https://e14n.com/
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
    qs = require("querystring"),
    Step = require("step"),
    _ = require("underscore"),
    authc = require("../lib/authc"),
    RequestToken = require("../lib/model/requesttoken").RequestToken,
    AccessToken = require("../lib/model/accesstoken").AccessToken,
    Client = require("../lib/model/client").Client,
    User = require("../lib/model/user").User,
    HTTPError = require("../lib/httperror").HTTPError;

// Renders the login form
// Will *skip* the login form if the user is already logged in

var authenticate = function(req, res) {
    // XXX: I think there's an easier way to get this, but leave it for now.
    var parsedUrl = url.parse(req.originalUrl, true),
        token = parsedUrl.query.oauth_token,
        rt,
        application;

    if (!token) {
        res.render("error", {page: {title: "Error",
                                    nologin: true,
                                    url: req.originalUrl},
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

                if (req.principal && !req.principalUser) {
                    throw new Error("Logged in as remote user");
                }

                if (!req.principalUser) {
                    // skip this step
                    this(null, rt);
                    return;
                }

                if (rt.username && rt.username != req.principalUser.nickname) {
                    throw new Error("Token already associated with a different user");
                }

                // We automatically authenticate the RT
                rt.update({username: req.principalUser.nickname, authenticated: true}, this);
            },
            function(err, result) {
                if (err) {
                    res.render("error", {page: {title: "Error",
                                                nologin: true,
                                                url: req.originalUrl},
                                         status: 400,
                                         error: err});
                    return;
                }

                if (req.principalUser) {
                    authorize(null, req, res, true, rt, application, rt);
                } else {
                    res.render("authentication", {page: {title: "Authentication",
                                                         nologin: true,
                                                         url: req.originalUrl},
                                                  token: token,
                                                  error: false});
                }
            }
        );
    }
};

// Renders the authorization form
// Will *skip* the authorization form if the user has already authenticated already logged in

var authorize = function(err, req, res, authenticated, rt, application) {  

    var self = this,
        user;

    if (err) {
        res.render("authentication", {status: 400,
                                      page: {title: "Authentication",
                                             nologin: true,
                                             url: req.originalUrl},
                                      token: rt.token,
                                      error: err.message});
        return;
    }

    if (!authenticated) {
        res.render("authentication", {page: {title: "Authentication",
                                             nologin: true,
                                             url: req.originalUrl},
                                      token: rt.token,
                                      error: "Incorrect username or password."});
        return;
    }

    Step(
        function() {
            User.get(rt.username, this);
        },
        function(err, results) {
            if (err) throw err;
            user = results;
            // Make sure there's a session
            if (req.session) {
                this(null);
            } else {
                req.app.session(req, res, this);
            }
        },
        function(err) {
            if (err) throw err;
            req.principal = user.profile;
            req.principalUser = user;
            res.local("principal", user.profile);
            res.local("principalUser", user);
            authc.setPrincipal(req.session, user.profile, this);
        },
        function(err) {
            if (err) throw err;
            AccessToken.search({consumer_key: application.consumer_key,
                                username: user.nickname},
                               this);
        },
        function(err, ats) {
            var url, sep;
            if (err) {
                res.render("error", {status: 400,
                                     page: {title: "Error",
                                            nologin: true,
                                            url: req.originalUrl},
                                     error: err});
            } else if (!ats || ats.length === 0) {
                // No access tokens yet; show authorization page
                res.render("authorization", {page: {title: "Authorization",
                                                    nologin: true,
                                                    url: req.originalUrl},
                                             token: rt.token,
                                             verifier: rt.verifier,
                                             principalUser: user,
                                             principal: user.profile,
                                             application: application});
            } else {
                // Already authorized; either redirect back or show the verifier
                if (rt.callback && rt.callback != "oob") {
                    sep = (rt.callback.indexOf("?") === -1) ? "?" : "&";
                    url = rt.callback + sep + qs.stringify({oauth_token: rt.token,
                                                            oauth_verifier: rt.verifier});
                    res.redirect(url);
                } else {
                    authorizationFinished(null, req, res, rt);
                }
            }
        }
    );
};  

var authorizationFinished = function(err, req, res, rt) {

    res.render("authorization-finished", {page: {title: "Authorization Finished",
                                                 nologin: true,
                                                 url: req.originalUrl},
                                          token: rt.token,
                                          verifier: rt.verifier});
};

// Need these for OAuth shenanigans

exports.authenticate = authenticate;
exports.authorize = authorize;
exports.authorizationFinished = authorizationFinished;
