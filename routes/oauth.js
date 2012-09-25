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
    RequestToken = require("../lib/model/requesttoken").RequestToken,
    User = require("../lib/model/user").User,
    HTTPError = require("../lib/httperror").HTTPError;

var authenticate = function(req, res) {
    // XXX: I think there's an easier way to get this, but leave it for now.
    var parsedUrl = url.parse(req.originalUrl, true),
        token = parsedUrl.query.oauth_token;

    if (!token) {
        res.render("error", {status: 400,
                             error: new HTTPError("Must provide an oauth_token", 400),
                             title: "Error"});
    } else {
        RequestToken.get(token, function(err, rt) {
            if (err) {
                res.render("error", {status: 400,
                                     error: err,
                                     title: "Error"});
            } else {
                res.render("authentication", {title: "Authentication",
                                              token: token,
                                              error: false});
            }
        });
    }
};

var authorize = function(err, req, res, authorized, authResults, application, rt) {  

    var self = this;
    
    if (err) {
        res.render("authentication", {title: "Authentication",
                                      token: authResults.token,
                                      status: 400,
                                      error: err.message});
    } else {
        User.get(rt.username, function(err, user) {
            res.render("authorization", {title: "Authorization",
                                         token: authResults.token,
                                         verifier: authResults.verifier,
                                         user: user,
                                         application: application});
        });
    }
};  

var authorizationFinished = function(err, req, res, result) {
    res.render("authorization-finished", {title: "Authorization Finished",
                                          token: result.token,
                                          verifier: result.verifier});
};

// Need these for OAuth shenanigans

exports.authenticate = authenticate;
exports.authorize = authorize;
exports.authorizationFinished = authorizationFinished;
