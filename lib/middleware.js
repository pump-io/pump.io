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

var databank = require("databank"),
    Step = require("step"),
    _ = require("underscore"),
    bcrypt  = require("bcrypt"),
    fs = require("fs"),
    Activity = require("./model/activity").Activity,
    User = require("./model/user").User,
    Client = require("./model/client").Client,
    HTTPError = require("./httperror").HTTPError,
    NoSuchThingError = databank.NoSuchThingError;

// If there is a user in the params, gets that user and
// adds them to the request as req.user
// also adds the user's profile to the request as req.profile
// Note: req.user != req.remoteUser

var reqUser = function(req, res, next) {
    var user;

    Step(
        function() {
            User.get(req.params.nickname, this);
        },
        function(err, results) {
            if (err) {
                if (err.name == "NoSuchThingError") {
                    throw new HTTPError(err.message, 404);
                } else {
                    throw err;
                }
            }
            user = results;
            user.sanitize();
            req.user = user;
            user.expand(this);
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                req.person = user.profile;
                next();
            }
        }
    );
};

var sameUser = function(req, res, next) {
    if (!req.remoteUser ||
        !req.user ||
        req.remoteUser.nickname != req.user.nickname) {
        next(new HTTPError("Not authorized", 401));
    } else {
        next();
    }
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

// Accept either 2-legged or 3-legged OAuth

var clientAuth = function(req, res, next) {

    var log = req.log;

    req.client = null;
    res.local("client", null); // init to null

    if (hasToken(req)) {
        userAuth(req, res, next);
        return;
    }

    log.info("Checking for 2-legged OAuth credentials");

    req.authenticate(["client"], function(error, authenticated) { 

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

        deetz = req.getAuthDetails();

        log.info(deetz);

        if (!deetz || !deetz.user || !deetz.user.id) {
            log.info("Incorrect auth details.");
            return;
        }

        Client.get(deetz.user.id, function(err, client) {

            if (error) {
                next(error);
                return;
            }

            req.client = client;
            res.local("client", req.client);
            next();
        });
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

    var log = req.log;

    req.remoteUser = null;
    res.local("remoteUser", null); // init to null
    req.client = null;
    res.local("client", null); // init to null

    log.info("Checking for 3-legged OAuth credentials");

    req.authenticate(["user"], function(error, authenticated) { 

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

        deetz = req.getAuthDetails();

        log.info(deetz);

        if (!deetz || !deetz.user || !deetz.user.user || !deetz.user.client) {
            log.info("Incorrect auth details.");
            next();
            return;
        }

        req.remoteUser = deetz.user.user;
        res.local("remoteUser", req.remoteUser);

        req.client = deetz.user.client;
        res.local("client", req.client);

        next();
    });
};

// Accept only 2-legged OAuth with

var remoteUserAuth = function(req, res, next) {

    req.client = null;
    res.local("client", null); // init to null
    req.remotePerson = null;
    res.local("person", null);

    req.authenticate(["client"], function(error, authenticated) { 

        var id;

        if (error) {
            next(error);
            return;
        }

        if (!authenticated) {
            return;
        }

        id = req.getAuthDetails().user.id;

        Step(
            function() {
                Client.get(id, this);
            },
            function(err, client) {
                if (err) {
                    next(err);
                    return;
                }
                if (!client) {
                    next(new HTTPError("No client", 401));
                    return;
                }
                if (!client.webfinger) {
                    next(new HTTPError("OAuth key not associated with a webfinger ID", 401));
                    return;
                }

                req.client = client;
                req.webfinger = client.webfinger;

                res.local("client", req.client); // init to null
                res.local("person", req.person); // init to null

                next();
            }
        );
    });
};

var fileContent = function(req, res, next) {

    switch (req.headers['content-type']) {
    case 'application/json':
        binaryJSONContent(req, res, next);
        break;
    default:
        otherFileContent(req, res, next);
    }
};

var otherFileContent = function(req, res, next) {

    req.uploadMimeType = req.headers["content-type"];
    req.uploadContent = req.body;

    next();
};

var binaryJSONContent = function(req, res, next) {

    var obj = req.body;

    if (!_.has(obj, "mimeType")) {
        next(new HTTPError("No mime type", 400));
        return;
    }

    req.uploadMimeType = obj.mimeType;

    if (!_.has(obj, "data")) {
        next(new HTTPError("No data", 400));
        return;
    }

    // Un-URL-safe the data

    obj.data.replace(/\-/g, "+");
    obj.data.replace(/_/g, "/");
    
    if (obj.data.length % 3 == 1) {
        obj.data += "==";
    } else if (obj.data.length % 3 == 2) {
        obj.data += "=";
    }

    try {
        req.uploadContent = new Buffer(obj.data, "base64");
        next();
    } catch (err) {
        next(err);
    }
};

exports.reqUser = reqUser;
exports.sameUser = sameUser;
exports.userAuth = userAuth;
exports.clientAuth = clientAuth;
exports.remoteUserAuth = remoteUserAuth;
exports.maybeAuth = maybeAuth;
exports.fileContent = fileContent;
