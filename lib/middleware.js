// middleware.js
//
// Some things you may need
//
// Copyright 2011-2012, E14N https://e14n.com/
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
    User = require("./model/user").User,
    Client = require("./model/client").Client,
    HTTPError = require("./httperror").HTTPError,
    NoSuchThingError = databank.NoSuchThingError;

// If there is a user in the params, gets that user and
// adds them to the request as req.user
// also adds the user's profile to the request as req.profile
// Note: req.user != req.principalUser

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
            user.expand(this);
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                req.user   = user;
                req.person = user.profile;
                next();
            }
        }
    );
};

var sameUser = function(req, res, next) {
    if (!req.principal ||
        !req.user ||
        req.principal.id != req.user.profile.id) {
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

    req.principal = null;
    res.local("principal", null); // init to null
    req.principalUser = null;
    res.local("principalUser", null); // init to null
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

        // If email confirmation is required and not yet done, give an error.

        if (req.app.config.requireEmail && !deetz.user.user.email) {
            next(new HTTPError("Can't use the API until you confirm your email address.", 403));
            return;
        }

        req.principalUser = deetz.user.user;
        res.local("principalUser", req.principalUser);

        req.principal = req.principalUser.profile;
        res.local("principal", req.principal);

        req.client = deetz.user.client;
        res.local("client", req.client);

        next();
    });
};

// Accept only 2-legged OAuth with

var remoteUserAuth = function(req, res, next) {

    req.client = null;
    res.local("client", null); // init to null
    req.webfinger = null;
    res.local("webfinger", null);
    req.host = null;
    res.local("host", null);

    req.authenticate(["client"], function(error, authenticated) { 

        var id, client;

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
            function(err, results) {
                if (err) throw err;
                client = results;
                if (!client) {
                    throw new HTTPError("No client", 401);
                }
                if (!client.webfinger && !client.host) {
                    throw new HTTPError("OAuth key not associated with a webfinger or host", 401);
                }
                req.client = client;
                res.local("client", req.client);
                client.asActivityObject(this);
            },
            function(err, principal) {
                if (err) {
                    next(err);
                } else {
                    req.principal = principal;
                    res.local("principal", principal);
                    next();
                }
            }
        );
    });
};

var fileContent = function(req, res, next) {

    if (req.headers['content-type'] == 'application/json') {
        binaryJSONContent(req, res, next);
    } else {
        otherFileContent(req, res, next);
    }
};

var otherFileContent = function(req, res, next) {

    req.uploadMimeType = req.headers["content-type"];
    req.uploadContent = req.body;

    next();
};

var binaryJSONContent = function(req, res, next) {

    var obj = req.body,
        fname,
        data;

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
        data = new Buffer(obj.data, "base64");
    } catch (err) {
        next(err);
        return;
    }

    Step(
        function() {
            randomString(8, this);
        },
        function(err, str) {
            var ws;
            if (err) throw err;
            fname = path.join(os.tmpDir(), str + ".bin");
            ws = fs.createWriteStream(fname);
            ws.on("close", this);
            ws.write(data);
            ws.end();
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                req.uploadFile = fname;
                next();
            }
        }
    );
};

// Add a generator object to writeable requests

var reqGenerator = function(req, res, next) {
    var client = req.client;

    if (!client) {
        next(new HTTPError("No client", 500));
        return;
    }

    Step(
        function() {
            client.asActivityObject(this);
        },
        function(err, obj) {
            if (err) throw err;
            req.generator = obj;
            this(null);
        },
        next
    );
};

exports.reqUser = reqUser;
exports.reqGenerator = reqGenerator;
exports.sameUser = sameUser;
exports.userAuth = userAuth;
exports.clientAuth = clientAuth;
exports.remoteUserAuth = remoteUserAuth;
exports.maybeAuth = maybeAuth;
exports.fileContent = fileContent;
exports.hasOAuth = hasOAuth;
