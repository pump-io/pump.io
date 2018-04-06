// routes/oauth2.js
//
// Routes for the OAuth 2.0 authorization flow
//
// Copyright 2018, E14N https://e14n.com/
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

"use strict";

var _ = require("lodash");
var Step = require("step");
var qs = require("querystring");
var authc = require("../lib/authc");
var csrf = require("../lib/csrf").csrf;
var User = require("../lib/model/user").User;
var AuthorizationCode = require("../lib/model/authorizationcode").AuthorizationCode;
var Client = require("../lib/model/client").Client;
var principal = authc.principal;

var SCOPES = ["read", "writeown", "writeall"];

// Initialize the app controller

exports.addRoutes = function(app, session) {
    app.get("/oauth2/authz", session, csrf, principal, authorize);
    app.post("/oauth2/authz", session, csrf, principal, authorized);
    app.get("/oauth2/authc", session, csrf, principal, authenticate);
    app.post("/oauth2/authc", session, csrf, principal, authenticated);
};

// GET /oauth2/authz?response_type=code&redirect_uri=...&client_id=...&scope=...&state=...

var authorize = function(req, res, next) {

    var props = getProps(req.query);

    // Closure to make this a little shorter
    var redirectError = function(type) {
        var qp = {error: type, state: props.state};
        res.redirect(props.redirect_uri + "?" + qs.stringify(qp));
    };

    verifyProps(props, function(err, client) {
        if (err) {
            if (err instanceof RedirectError) {
                redirectError(err.type);
            } else {
                next(err);
            }
        } else {

            // Check login state

            if (!req.principal) {
                // Not logged in; login and come back
                res.redirect("/oauth2/authc?" + qs.stringify(props));
            } else if (!req.principalUser) {
                // Remote user
                return redirectError("invalid_request");
            } else {
                var aprops = _.extend(props, {
                    client: client
                });
                res.render("oauth2-authorize", aprops);
            }
        }
    });
};

// POST /oauth2/authz
// response_type=code&redirect_uri=...&client_id=...&scope=...&state=...

var authorized = function(req, res, next) {

    var props = getProps(req.body);

    // Closure to make this a little shorter
    var redirectError = function(type) {
        var qp = {error: type, state: props.state};
        res.redirect(props.redirect_uri + "?" + qs.stringify(qp));
    };

    verifyProps(props, function(err, client) {

        if (err) {
            next(err);
        } else {

            if (!req.principal || !req.principalUser) {
                return next(new Error("Unexpected login state"));
            }

            if (req.body.denied) {
                redirectError("access_denied");
            } else {
                Step(
                    function() {
                        var props = {
                            nickname: req.principalUser.nickname,
                            client_id: client.id,
                            redirect_uri: props.redirect_uri,
                            scope: props.scope
                        };
                        AuthorizationCode.create(props, this);
                    },
                    function(err, ac) {
                        if (err) return redirectError("server_error");
                        var rprops = {
                            code: ac.code,
                            state: props.state
                        };
                        var rurl = props.redirect_uri +
                            "?" +
                             qs.stringify(rprops);
                        res.redirect(303, rurl);
                    }
                );
            }
        }
    });
};

// GET /oauth2/authc?response_type=code&redirect_uri=...&client_id=...&scope=...&state=...

var authenticate = function(req, res, next) {

    var props = getProps(req.query);

    // if we're logged in (back button?) just go to /oauth2/authz

    if (req.principal) {
        // XXX make sure we don't have a mutual redirect loop here.
        res.redirect("/oauth2/authz?" + qs.stringify(props));
        return;
    }

    // Check all the passed-in properties

    verifyProps(props, function(err, client) {
        if (err) {
            // At this point in the flow, they should have all been checked
            // already. So any validation problem is due to naughty behaviour.
            return next(err);
        } else {
            var aprops = _.extend(props, {
                client: client,
                error: req.session.oauth2AuthcError
            });
            res.render("oauth2-authenticate", aprops);
        }
    });
};

// POST /oauth2/authc
// nickname=...&password=...&response_type=code&redirect_uri=...&client_id=...&scope=...&state=...

var authenticated = function(req, res, next) {

    var props = getProps(req.body);

    var retry = function(message) {
        req.session.oauth2AuthcError = message;
        res.redirect(303, "/oauth2/authc?" + qs.stringify(props));
    };

    // if we're logged in (back button?) just go to /oauth2/authz

    if (req.principal) {
        // XXX make sure we don't have a mutual redirect loop here.
        res.redirect(303, "/oauth2/authz?" + qs.stringify(props));
        return;
    }

    // Check all the passed-in properties

    verifyProps(props, function(err, client) {
        if (err) {
            // At this point in the flow, they should have all been checked
            // already. So any validation problem is due to naughty behaviour.
            return next(err);
        } else {
            var nickname = req.body.nickname;
            var password = req.body.password;

            if (!nickname || !password) {
                return retry("nickname and password are required.");
            }

            Step(
                function() {
                    User.checkCredentials(nickname, password, this);
                },
                function(err, user) {
                    if (err) throw err;
                    if (!user) {
                        retry("No match for that nickname and password.");
                    } else {
                        req.principal = user.profile;
                        req.principalUser = user;
                        res.locals.principal = user.profile;
                        res.locals.principalUser = user;
                        authc.setPrincipal(req.session, user.profile, this);
                    }
                },
                function(err) {
                    if (err) return next(err);
                    // XXX make sure we don't have a mutual redirect loop here.
                    res.redirect(303, "/oauth2/authz?" + qs.stringify(props));
                }
            );
        }
    });
};

var verifyProps = function(props, callback) {

    if (!props.client_id) {
        return callback(new Error("No client_id parameter"));
    }

    if (!props.redirect_uri) {
        return callback(new Error("No redirect_uri parameter"));
    }

    Step(
        function() {
            Client.get(props.client_id, this);
        },
        function(err, client) {

            if (err) {
                // If there's a problem getting the client, don't
                // bounce the user back
                return callback(err);
            }

            if (!matchRedirectURI(client, props.redirect_uri)) {
                // If there's a sketchy redirect, don't
                // bounce the user back
                return callback(new Error("Invalid redirect_uri for this client"));
            }

            // from here on, we redirect errors

            if (!props.response_type || props.response_type !== "code") {
                return callback(new RedirectError("unsupported_response_type"));
            }

            if (props.scope && !(props.scope in SCOPES)) {
                return callback(new RedirectError("invalid_scope"));
            }

            // Looks good

            return callback(null, client);
        }
    );
};

var getProps = function(input) {
    var params = ["client_id", "redirect_uri", "response_type", "state", "scope"];
    return _.pick(input, params);
};

var RedirectError = function(type) {
    this.type = type;
};

RedirectError.prototype = new Error();
RedirectError.prototype.constructor = RedirectError;

var matchRedirectURI = function(client, uri) {
    return true;
};
