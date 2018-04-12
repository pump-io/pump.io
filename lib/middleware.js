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

"use strict";

var databank = require("databank"),
    Step = require("step"),
    _ = require("lodash"),
    bcrypt = require("bcryptjs"),
    fs = require("fs"),
    path = require("path"),
    os = require("os"),
    randomString = require("./randomstring").randomString,
    tmp = require("./tmp"),
    Activity = require("./model/activity").Activity,
    User = require("./model/user").User,
    Client = require("./model/client").Client,
    HTTPError = require("./httperror").HTTPError,
    NoSuchThingError = databank.NoSuchThingError;

// If there is a user in the params, gets that user and
// adds them to the request as req.user
// also adds the user's profile to the request as req.profile
// Note: req.user !== req.principalUser

var reqUser = function(req, res, next) {
    var user;

    Step(
        function() {
            User.get(req.params.nickname, this);
        },
        function(err, results) {
            if (err) {
                if (err.name === "NoSuchThingError") {
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
        req.principal.id !== req.user.profile.id) {
        next(new HTTPError("Not authorized", 401));
    } else {
        next();
    }
};

var fileContent = function(req, res, next) {

    if (req.headers["content-type"] === "application/json") {
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

    if (obj.data.length % 3 === 1) {
        obj.data += "==";
    } else if (obj.data.length % 3 === 2) {
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
            fname = path.join(tmp.dirSync(), str + ".bin");
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
exports.fileContent = fileContent;
