// authc.js
//
// Authentication middleware
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

var databank = require("databank"),
    Step = require("step"),
    _ = require("underscore"),
    bcrypt  = require("bcrypt"),
    fs = require("fs"),
    path = require("path"),
    os = require("os"),
    randomString = require("./randomstring").randomString,
    Activity = require("./model/activity").Activity,
    ActivityObject = require("./model/activityobject").ActivityObject,
    User = require("./model/user").User,
    Client = require("./model/client").Client,
    HTTPError = require("./httperror").HTTPError,
    URLMaker = require("./urlmaker").URLMaker,
    NoSuchThingError = databank.NoSuchThingError;

// Remove all properties of an object and its properties if the key starts with _

var sanitizedJSON = function(obj) {
    var clean = {};
    _.each(obj, function(value, key) {
        if (!_.has(obj, key)) {
            return;
        } else if (key[0] == '_') {
            return;
        } else if (_.isObject(value)) { // includes arrays!
            clean[key] = sanitizedJSON(value);
        } else if (!_.isFunction(value)) {
            clean[key] = value;
        }
    });
    return clean;
};

var maybeAuth = function(req, res, next) {
    if (!hasOAuth(req)) {
        // No client, no user
        next();
    } else {
        clientAuth(req, res, next);
    }
};

var hasOAuth = function(req) {
    return (req &&
            _.has(req, "headers") &&
            _.has(req.headers, "authorization") &&
            req.headers.authorization.match(/^OAuth/));
};

var userOrClientAuth = function(req, res, next) {
    if (hasToken(req)) {
        userAuth(req, res, next);
    } else {
        clientAuth(req, res, next);
    }
};

var wrapRequest = function(req, path) {
    var areq = _.clone(req);

    if (path[0] != "/") {
	path = "/" + path;
    }

    areq.originalUrl = path + req.originalUrl;

    return areq;
};

// Accept either 2-legged or 3-legged OAuth

var clientAuth = function(req, res, next) {

    var log = req.log, areq;

    req.client = null;
    res.local("client", null); // init to null

    log.info("Checking for 2-legged OAuth credentials");

    // If we're coming in the front door, and we have a path, provide it
    if (req.header('Host').toLowerCase() == URLMaker.makeHost() && URLMaker.path) {
	areq = wrapRequest(req, URLMaker.path);
    } else {
	areq = req;
    }

    areq.authenticate(["client"], function(error, authenticated) {

        var deetz;

        if (error) {
            log.error(error);
            next(error);
            return;
        }

        if (!authenticated) {
            log.info("Not authenticated");
            return;
        }

        log.info("Authentication succeeded");

        deetz = areq.getAuthDetails();

        log.info(deetz);

        if (!deetz || !deetz.user || !deetz.user.id) {
            log.info("Incorrect auth details.");
            return;
        }

        Step(
            function() {
		req.app.provider.getClient(deetz.user.id, this);
            },
            function(err, client) {
                if (err) throw err;

                req.client = client;
                res.local("client", sanitizedJSON(req.client));

                if (client.webfinger || client.host) {
                    client.asActivityObject(this);
                } else {
                    this(null, null);
                }
            },
            function(err, principal) {
                if (err) {
                    log.error(err);
                    next(err);
                } else {
                    req.principal = principal;
                    res.local("principal", sanitizedJSON(principal));
                    next();
                }
            }
        );
    });
};

var hasToken = function(req) {
    return (req &&
            (_(req.headers).has("authorization") && req.headers.authorization.match(/oauth_token/)) ||
            (req.query && req.query.oauth_token) ||
            (req.body && req.headers["content-type"] === "application/x-www-form-urlencoded" && req.body.oauth_token));
};

// Accept only 3-legged OAuth
// XXX: It would be nice to merge these two functions

var userAuth = function(req, res, next) {

    var log = req.log,
        areq;

    req.principal = null;
    res.local("principal", null); // init to null
    req.principalUser = null;
    res.local("principalUser", null); // init to null
    req.client = null;
    res.local("client", null); // init to null

    log.info("Checking for 3-legged OAuth credentials");

    // If we're coming in the front door, and we have a path, provide it
    if (req.header('Host').toLowerCase() == URLMaker.makeHost() && URLMaker.path) {
	areq = wrapRequest(req, URLMaker.path);
    } else {
	areq = req;
    }

    areq.authenticate(["user"], function(error, authenticated) {

        var deetz;

        if (error) {
            log.error(error);
            next(error);
            return;
        }

        if (!authenticated) {
            log.info("Authentication failed");
            return;
        }

        log.info("Authentication succeeded");

        deetz = areq.getAuthDetails();

        log.info(deetz, "Authentication details");

        if (!deetz || !deetz.user || !deetz.user.user || !deetz.user.client) {
            log.info("Incorrect auth details.");
            next(new Error("Incorrect auth details"));
            return;
        }

        // If email confirmation is required and not yet done, give an error.

        if (req.app.config.requireEmail && !deetz.user.user.email) {
            next(new HTTPError("Can't use the API until you confirm your email address.", 403));
            return;
        }

        req.principalUser = deetz.user.user;
        res.local("principalUser", sanitizedJSON(req.principalUser));

        req.principal = req.principalUser.profile;
        res.local("principal", sanitizedJSON(req.principal));

        req.client = deetz.user.client;
        res.local("client", sanitizedJSON(req.client));

        log.info({principalUser: req.principalUser.nickname, principal: req.principal, client: req.client.title},
                 "User authorization complete.");

        next();
    });
};

// Accept only 2-legged OAuth with

var remoteUserAuth = function(req, res, next) {
    clientAuth(req, res, function(err) {
        if (err) {
            next(err);
        } else if (!req.principal) {
            next(new HTTPError("Authentication required", 401));
        } else {
            next();
        }
    });
};

var setPrincipal = function(session, obj, callback) {

    if (!_.isObject(obj)) {
        callback(new Error("Can't set principal to non-object"));
        return;
    }

    session.principal = {
        id: obj.id,
        objectType: obj.objectType
    };

    callback(null);
};

var getPrincipal = function(session, callback) {

    if (!session || !_.has(session, "principal")) {
        callback(null, null);
        return;
    }

    var ref = session.principal;

    Step(
        function() {
            ActivityObject.getObject(ref.objectType, ref.id, this);
        },
        callback
    );
};

var clearPrincipal = function(session, callback) {

    if (!session || !_.has(session, "principal")) {
        callback(null);
        return;
    }

    delete session.principal;

    callback(null);
};

var principal = function(req, res, next) {

    req.log.info({msg: "Checking for principal", session: req.session});

    Step(
        function() {
            getPrincipal(req.session, this);
        },
        function(err, principal) {
            if (err) throw err;
            if (principal) {
                req.log.info({msg: "Setting session principal", principal: principal});
                req.principal = principal;
                res.local("principal", sanitizedJSON(req.principal));
                User.fromPerson(principal.id, this);
            } else {
                req.principal = null;
                req.principalUser = null;
                next();
            }
        },
        function(err, user) {
            if (err) {
                next(err);
            } else {
                // XXX: null on miss
                if (user) {
                    req.log.info({msg: "Setting session principal user", user: user});
                    req.principalUser = user;
                    // Make the profile a "live" object
                    req.principalUser.profile = req.principal;
                    res.local("principalUser", sanitizedJSON(req.principalUser));
                }
                next();
            }
        }
    );
};

var principalUserOnly = function(req, res, next) {
    if (!_.has(req, "principalUser") || !req.principalUser) {
        next(new HTTPError("Not logged in.", 401));
    } else {
        next();
    }
};

var remoteWriteOAuth = remoteUserAuth;
var noneWriteOAuth = clientAuth;
var userWriteOAuth = userAuth;

var userReadAuth = function(req, res, next) {
    if (hasOAuth(req)) {
        userAuth(req, res, next);
    } else if (req.session) {
        principal(req, res, function(err) {
            if (err) {
                next(err);
            } else {
                principalUserOnly(req, res, next);
            }
        });
    } else {
        next(new HTTPError("Not logged in.", 401));
    }
};

var anyReadAuth = function(req, res, next) {
    if (hasOAuth(req)) {
        userOrClientAuth(req, res, next);
    } else if (req.session) {
        principal(req, res, function(err) {
            if (err) {
                next(err);
            } else if (!req.principal) {
                next(new HTTPError("Not logged in.", 401));
            } else {
                next();
            }
        });
    } else {
        next(new HTTPError("Not logged in.", 401));
    }
};

var someReadAuth = function(req, res, next) {
    if (hasOAuth(req)) {
        userAuth(req, res, next);
    } else if (req.session) {
        principal(req, res, function(err) {
            if (err) {
                next(err);
            } else if (!req.principal) {
                next(new HTTPError("Not logged in.", 401));
            } else {
                next();
            }
        });
    } else {
        next(new HTTPError("Not logged in.", 401));
    }
};

exports.principal = principal;
exports.setPrincipal = setPrincipal;
exports.getPrincipal = getPrincipal;
exports.clearPrincipal = clearPrincipal;
exports.principalUserOnly = principalUserOnly;

exports.userAuth = userAuth;
exports.clientAuth = clientAuth;
exports.userOrClientAuth = userOrClientAuth;
exports.remoteUserAuth = remoteUserAuth;
exports.maybeAuth = maybeAuth;
exports.hasOAuth = hasOAuth;

exports.remoteWriteOAuth = remoteWriteOAuth;
exports.noneWriteOAuth = noneWriteOAuth;
exports.userWriteOAuth = userWriteOAuth;
exports.userReadAuth = userReadAuth;
exports.anyReadAuth = anyReadAuth;
exports.someReadAuth = someReadAuth;
