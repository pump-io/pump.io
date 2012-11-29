// rawbody.js
//
// Middleware to grab the body of an HTTP request if it's not
// a well-known type
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

var express = require("express"),
    _ = require("underscore");

var rawBody = function(req, res, next) {

    var buf,
        len,
        offset = 0,
        mimeType,
        skip = ["application/json",
                "application/x-www-form-urlencoded",
                "multipart/form-data"];

    if (req.method != "PUT" && req.method != "POST") {
        next();
        return;
    }

    mimeType = req.headers["content-type"];

    if (!mimeType) {
        next();
        return;
    }

    mimeType = mimeType.split(";")[0];

    if (_.contains(skip, mimeType) || _.has(express.bodyParser.parse, mimeType)) {
        next();
        return;
    }

    req.log.info("Parsing raw body of request with type " + mimeType);

    if (_.has(req.headers, "content-length")) {
        try {
            len = parseInt(req.headers["content-length"], 10);
        } catch (e) {
            next(e);
            return;
        }
    }

    if (len) {
        buf = new Buffer(len);
    } else {
        buf = new Buffer(0);
    }

    req.on("data", function(chunk) {
        if (len) {
            chunk.copy(buf, offset);
            offset += chunk.length;
        } else {
            buf = Buffer.concat([buf, chunk]);
        }
    });

    req.on("err", function(err) {
        buf = null;
        next(err);
    });

    req.on("end", function() {
        req.body = buf;
        next();
    });
};

exports.rawBody = rawBody;
