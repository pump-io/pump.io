// routes/web.js
//
// Spurtin' out pumpy goodness all over your browser window
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

var databank = require('databank'),
    url = require('url'),
    Step = require('step'),
    _ = require('underscore'),
    Activity = require('../lib/model/activity').Activity,
    RequestToken = require('../lib/model/requesttoken').RequestToken,
    User = require('../lib/model/user').User,
    mw = require('../lib/middleware'),
    he = require('../lib/httperror'),
    HTTPError = he.HTTPError,
    maybeAuth = mw.maybeAuth,
    reqUser = mw.reqUser,
    mustAuth = mw.mustAuth,
    sameUser = mw.sameUser,
    noUser = mw.noUser,
    checkCredentials = mw.checkCredentials,
    NoSuchThingError = databank.NoSuchThingError;

var addRoutes = function(app) {

    app.get('/', maybeAuth, showMain);

    app.post('/main/login', noUser, handleLogin);
    app.post('/main/logout', mustAuth, handleLogout);

    app.get('/main/settings', mustAuth, showSettings);

    app.get('/:nickname', maybeAuth, reqUser, showStream);
    app.get('/:nickname/inbox', mustAuth, reqUser, sameUser, showInbox);
    app.get('/:nickname/activity/:uuid', maybeAuth, reqUser, showActivity);
};

var showSettings = function(req, res, next) {
    res.render("settings", {title: "Settings"});
};

var showMain = function(req, res, next) {
    res.render("main", {title: "Welcome"});
};

var handleLogin = function(req, res, next) {
    Step( 
        function () { 
            checkCredentials(req.body.nickname, req.body.password, this);
        },
        function(err, user) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    next(new HTTPError("Not authorized", 403));
                } else {
                    next(err);
                }
            } else if (!user) {
                // done here
                next(new HTTPError("Not authorized", 403));
            } else {
                user.expand(this);
            }
        },
        function(err, user) {
            if (err) {
                next(err);
            } else {
                req.session.nickname = user.nickname;
                user.sanitize();
                res.json(user);
            }
        }
    );
};

var handleLogout = function(req, res, next) {
    delete req.session.nickname;
    res.json("OK");
};

var showActivity = function(req, res, next) {
    var uuid = req.params.uuid,
        user = req.user;

    Step(
        function() {
            Activity.search({'uuid': req.params.uuid}, this);
        },
        function(err, activities) {
            if (err) throw err;
            if (activities.length === 0) {
                next(new NoSuchThingError('activity', uuid));
            }
            if (activities.length > 1) {
                next(new Error("Too many activities with ID = " + req.params.uuid));
            }
            activities[0].expand(this);
        },
        function(err, activity) {
            if (err) {
                next(err);
            } else {
                res.render("activity", {title: "Welcome",
                                        user: req.remoteUser,
                                        activity: activity});
            }
        }
    );
};

var showInbox = function(req, res, next) {

    Step(
        function() {
            req.user.getInbox(0, 20, this);
        },
        function(err, activities) {
            if (err) {
                next(err);
            } else {
                res.render("inbox", {title: "Inbox",
                                     user: req.remoteUser,
                                     activities: activities});
            }
        }
    );
};

var showStream = function(req, res, next) {
    var pump = this;

    Step(
        function() {
            req.user.getStream(0, 20, this);
        },
        function(err, activities) {
            if (err) {
                next(err);
            } else {
                res.render("user", {title: req.user.nickname,
                                    user: req.remoteUser,
                                    actor: req.user.profile,
                                    activities: activities});
            }
        }
    );
};

var authenticate = function(req, res, next) {
    // XXX: I think there's an easier way to get this, but leave it for now.
    var parsedUrl = url.parse(req.originalUrl, true),
        token = parsedUrl.query.oauth_token;

    if (!token) {
        next(new HTTPError("Must provide an oauth_token", 400));
    } else {
        RequestToken.get(token, function(err, rt) {
            if (err) {
                next(new HTTPError(err.toString(), 400));
            } else {
                res.render('authentication', {title: "Authentication", token: token, nologin: true, error: false});
            }
        });
    }
};

var authorize = function(err, req, res, authorized, authResults, application, rt) {  

    var self = this;
    
    if (err) {
        res.render('authentication', {title: "Authentication",
                                      token: authResults.token,
                                      status: 400,
                                      nologin: true,
                                      error: err.message});
    } else {
        User.get(rt.username, function(err, user) {
            res.render('authorization', {title: "Authorization",
                                         token: authResults.token,
                                         verifier: authResults.verifier,
                                         user: user,
                                         application: application});
        });
    }
};  

var authorizationFinished = function(err, req, res, result) {
    res.render('authorization-finished', {title: "Authorization Finished",
                                          token: result.token,
                                          verifier: result.verifier});
};

exports.addRoutes = addRoutes;

// Need these for OAuth shenanigans

exports.authenticate = authenticate;
exports.authorize = authorize;
exports.authorizationFinished = authorizationFinished;
