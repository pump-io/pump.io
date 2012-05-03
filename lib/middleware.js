// middleware.js
//
// Some things you may need
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
    Step = require('step'),
    _ = require('underscore'),
    bcrypt  = require('bcrypt'),
    fs = require('fs'),
    Activity = require('./model/activity').Activity,
    User = require('./model/user').User,
    NoSuchThingError = databank.NoSuchThingError;

var reqUser = function(req, res, next) {

    Step(
        function() {
            User.get(req.params.nickname, this);
        },
        function(err, user) {
            if (err) throw err;
            user.sanitize();
            req.user = user;
            user.expand(this);
        },
        function(err, user) {
            if (err) {
                next(err);
            } else {
                req.person = user.person;
                next();
            }
        }
    );
};

var sameUser = function(req, res, next) {
    if (!req.remoteUser ||
        !req.user ||
        req.remoteUser.nickname != req.user.nickname) {
        next(new Error("Not authorized"));
    } else {
        next();
    }
};

var maybeAuth = function(req, res, next) {

    // Set these up as default

    req.remoteUser = null;
    res.local('remoteUser', null); // init to null

    Step(
        function() {
            getCurrentUser(req, res, this);
        },
        function(err, user) {
            if (err) {
                next(err);
            } else {
                req.remoteUser = user;
                res.local('remoteUser', user);
                next();
            }
        }
    );

};

var mustAuth = function(req, res, next) {

    Step(
        function() {
            getCurrentUser(req, res, this);
        },
        function(err, user) {
            if (err) {
                next(err);
            } else if (!user) {
                next(new Error("No logged-in user."));
            } else {
                req.remoteUser = user;
                next();
            }
        }
    );
};

var noUser = function(req, res, next) {

    Step(
        function() {
            getCurrentUser(req, res, this);
        },
        function(err, user) {
            if (err) {
                next(err);
            } else if (user) {
                next(new Error("Already logged in."));
            } else {
                req.remoteUser = null;
                next();
            }
        }
    );
};

var getCurrentUser = function(req, res, callback) {
    
    if (req.session.nickname) {
        getSessionUser(req, res, callback);
    } else {
        callback(null, null);
    }
};

var getSessionUser = function(req, res, callback) {
    Step(
        function() {
            User.get(req.session.nickname, this);
        },
        function(err, user) {
            if (err) {
                callback(err, null);
            } else {
                user.sanitize();
                callback(null, user);
            }
        }
    );
};

var checkCredentials = function(nickname, password, callback) {
    User.checkCredentials(nickname, password, callback);
};

exports.maybeAuth = maybeAuth;
exports.reqUser = reqUser;
exports.mustAuth = mustAuth;
exports.sameUser = sameUser;
exports.noUser = noUser;
exports.checkCredentials = checkCredentials;
exports.getCurrentUser = getCurrentUser;
exports.getSessionUser = getSessionUser;

