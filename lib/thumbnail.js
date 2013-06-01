// lib/thumbnail.js
//
// The necessary recipe for saving uploaded files
//
// Copyright 2012,2013 E14N https://e14n.com/
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

var os = require("os"),
    path = require("path"),
    fs = require("fs"),
    Step = require("step"),
    mkdirp = require("mkdirp"),
    _ = require("underscore"),
    gm = require("gm"),
    HTTPError = require("./httperror").HTTPError,
    ActivityObject = require("./model/activityobject").ActivityObject,
    URLMaker = require("./urlmaker").URLMaker,
    randomString = require("./randomstring").randomString,
    tmp = require("./tmp"),
    mover = require("./mover"),
    mm = require("./mimemap"),
    typeToClass = mm.typeToClass,
    typeToExt = mm.typeToExt,
    extToType = mm.extToType;

var MAX_THUMB = 320;

var addImageMetadata = function(props, uploadDir, callback) {

    var fname = path.join(uploadDir, props._slug),
        thumbnail = function(size, callback) {
            var dirname = path.dirname(props._slug),
                extname = path.extname(fname),
                basename = path.basename(fname, extname),
                tslug = path.join(dirname, basename + "_thumb" + extname),
                tname = path.join(uploadDir, tslug),
                width,
                height,
                newWidth,
                newHeight;

            width = size.width;
            height = size.height;

            if (height > MAX_THUMB && height > width) {
                newHeight = MAX_THUMB;
                newWidth = Math.floor(MAX_THUMB * (width * 1.0) / (height * 1.0));
            } else if (width > MAX_THUMB) {
                newWidth = MAX_THUMB;
                newHeight = Math.floor(MAX_THUMB * (height * 1.0) / (width * 1.0));
            }

            Step(
                function() {
                    gm(fname).resize(newWidth, newHeight)
                        .quality(80)
                        .write(tname, this);
                },
                function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        props.fullImage = props.image;
                        props.image = {
                            url: URLMaker.makeURL("uploads/" + tslug),
                            width: newWidth,
                            height: newHeight
                        };
                        props._fslug = props._slug;
                        props._slug = tslug;
                        callback(null, props);
                    }
                }
            );
        };

    Step(
        function() {
            gm(fname).size(this);
        },
        function(err, size) {
            if (err) throw err;
            props.image.width  = size.width;
            props.image.height = size.height;
            if (size.width > MAX_THUMB || size.height > MAX_THUMB) {
                thumbnail(size, this);
            } else {
                this(null, props);
            }
        },
        callback
    );
};

var MAX_AVATAR = 96;

var addAvatarMetadata = function(props, uploadDir, callback) {

    var fname = path.join(uploadDir, props._slug),
        avatar = function(size, callback) {
            var dirname = path.dirname(props._slug),
                extname = path.extname(fname),
                basename = path.basename(fname, extname),
                tslug = path.join(dirname, basename + "_thumb" + extname),
                tname = path.join(uploadDir, tslug),
                width,
                height,
                square,
                x,
                y,
                gmd;

            width = size.width;
            height = size.height;

            if (height > width) {
                x = 0;
                y = (height - width)/2;
                square = width;
            } else if (width > height) {
                y = 0;
                x = (width - height)/2;
                square = height;
            } else {
                x = y = 0;
                square = width;
            }

            gmd = gm(fname);

            if (x !== 0 || y !== 0) {
                gmd.crop(square, square, x, y);
            }

            if (square != MAX_AVATAR) {
                gmd.resize(MAX_AVATAR, MAX_AVATAR);
            }
            
            gmd.quality(90);

            Step(
                function() {
                    gmd.write(tname, this);
                },
                function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        props.fullImage = props.image;
                        props.image = {
                            url: URLMaker.makeURL("uploads/" + tslug),
                            width: MAX_AVATAR,
                            height: MAX_AVATAR
                        };
                        props._fslug = props._slug;
                        props._slug = tslug;
                        callback(null, props);
                    }
                }
            );
        };

    Step(
        function() {
            gm(fname).size(this);
        },
        function(err, size) {
            if (err) throw err;
            props.image.width  = size.width;
            props.image.height = size.height;
            avatar(size, this);
        },
        callback
    );
};

var autorotate = function(oldName, newName, callback) {

    var tmpname;

    Step(
        function() {
            tmp.name(path.extname(oldName), this);
        },
        function(err, results) {
            if (err) throw err;
            tmpname = results;
            gm(oldName).autoOrient().write(tmpname, this);
        },
        function(err) {
            if (err) throw err;
            mover.safeMove(tmpname, newName, this);
        },
        function(err) {
            if (err) throw err;
            fs.unlink(oldName, this);
        },
        callback
    );
};

exports.addImageMetadata = addImageMetadata;
exports.addAvatarMetadata = addAvatarMetadata;
exports.autorotate = autorotate;
