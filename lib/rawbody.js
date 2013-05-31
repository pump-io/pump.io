// rawbody.js
//
// Middleware to grab the body of an HTTP request if it's not
// a well-known type
//
// Copyright 2012, E14N https://e14n.com/
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
    fs = require("fs"),
    os = require("os"),
    path = require("path"),
    _ = require("underscore"),
    Step = require("step"),
    mm = require("./mimemap"),
    typeToExt = mm.typeToExt,
    randomString = require("./randomstring").randomString;

var maybeCleanup = function(fname, callback) {
    Step(
        function() {
            fs.stat(fname, this);
        },
        function(err, stat) {
            if (err) {
                if (err.code == "ENOENT") {
                    // Good; it got used
                    return;
                } else {
                    throw err;
                }
            }
            fs.unlink(fname, this);
        },
        callback
    );
};

var rawBody = function(req, res, next) {

    var buf = new Buffer(0),
        len,
        mimeType,
        fname,
        fdir,
        skip = ["application/json",
                "application/x-www-form-urlencoded",
                "multipart/form-data"],
        bufferData = function(err, chunk) {
            buf = Buffer.concat([buf, chunk]);
        };

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

    // Buffer here to catch stuff while pause is sputtering to a stop

    req.on("data", bufferData);

    // Pause the request while we open our file

    req.pause();

    Step(
        function() {
            randomString(8, this);
        },
        function(err, str) {
            var ws,
                ext,
                tmpdir = (_.isFunction(os.tmpdir)) ? os.tmpdir() :
                    (_.isFunction(os.tmpDir)) ? os.tmpDir() : "/tmp";
                
            if (err) throw err;
            ext = typeToExt(mimeType) || "bin",
            fname = path.join(tmpdir, str + "." + ext);
            ws = fs.createWriteStream(fname);
            if (buf.length) {
                ws.write(buf);
            }
            req.removeListener("data", bufferData);
            req.resume();
            ws.on("close", this);
            req.pipe(ws);
        },
        function(err) {
            var end;
            if (err) {
                next(err);
            } else {
                req.uploadFile = fname;
                req.uploadMimeType = mimeType;
                end = res.end;
                // If needed, clean up our temp file
                res.end = function(chunk, encoding) {
                    res.end = end;
                    res.end(chunk, encoding);
                    maybeCleanup(fname, function(err) {
                        if (err) {
                            req.log.error(err);
                        }
                    });
                };
                next();
            }
        }
    );
};

exports.rawBody = rawBody;
