// lib/saveupload.js
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

var Step = require("step"),
    path = require("path"),
    fs = require("fs"),
    mkdirp = require("mkdirp"),
    _ = require("underscore"),
    gm = require("gm"),
    HTTPError = require("../lib/httperror").HTTPError,
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    URLMaker = require("../lib/urlmaker").URLMaker,
    randomString = require("../lib/randomstring").randomString,
    mm = require("./mimemap"),
    thumbnail = require("./thumbnail"),
    mover = require("./mover"),
    safeMove = mover.safeMove,
    typeToClass = mm.typeToClass,
    typeToExt = mm.typeToExt,
    extToType = mm.extToType,
    addImageMetadata = thumbnail.addImageMetadata,
    addAvatarMetadata = thumbnail.addAvatarMetadata,
    autorotate = thumbnail.autorotate;

// Since saveUpload and saveAvatar are so similar, except for a single
// function call, I have a factory and then use it below.

var saver = function(thumbnailer) {

    return function(user, mimeType, fileName, uploadDir, params, callback) {

        var props,
            now = new Date(),
            ext = typeToExt(mimeType),
            dir = path.join(user.nickname,
                            ""+now.getUTCFullYear(),
                            ""+(now.getUTCMonth() + 1),
                            ""+now.getUTCDate()),
            fulldir = path.join(uploadDir, dir),
            slug,
            obj,
            fname,
            Cls = typeToClass(mimeType);

        // params are optional

        if (!callback) {
            callback = params;
            params = {};
        }

        Step(
            function() {
                mkdirp(fulldir, this);
            },
            function(err) {
                if (err) throw err;
                randomString(4, this);
            },
            function(err, rnd) {
                if (err) throw err;
                slug = path.join(dir, rnd + "." + ext),
                fname = path.join(uploadDir, slug);
                // autorotate requires a copy, so we do it here
                if (Cls.type == ActivityObject.IMAGE) {
                    autorotate(fileName, fname, this);
                } else {
                    safeMove(fileName, fname, this);
                }
            },
            function(err) {
                var url;
                if (err) throw err;

                url = URLMaker.makeURL("uploads/" + slug);

                switch (Cls.type) {
                case ActivityObject.IMAGE:
                    props = {
                        _slug: slug,
                        author: user.profile,
                        image: {
                            url: url
                        }
                    };
                    break;
                case ActivityObject.AUDIO:
                case ActivityObject.VIDEO:
                    props = {
                        _slug: slug,
                        author: user.profile,
                        stream: {
                            url: url
                        }
                    };
                    break;
                case ActivityObject.FILE:
                    props = {
                        _slug: slug,
                        author: user.profile,
                        fileUrl: url,
                        mimeType: mimeType
                    };
                    break;
                default:
                    throw new Error("Unknown type.");
                }

                // XXX: summary, or content?

                if (_.has(params, "description")) {
                    props.content = params.description;
                }

                if (_.has(params, "title")) {
                    props.displayName = params.title;
                }
                
                // Images get some additional metadata

                if (Cls.type == ActivityObject.IMAGE) {
                    thumbnailer(props, uploadDir, this);
                } else {
                    this(null, props);
                }
            },
            function(err, props) {
                if (err) throw err;
                Cls.create(props, this);
            },
            function(err, result) {
                if (err) throw err;
                obj = result;
                user.uploadsStream(this);
            },
            function(err, str) {
                if (err) throw err;
                str.deliverObject({id: obj.id, objectType: obj.objectType}, this);
            },
            function(err) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, obj);
                }
            }
        );
    };
};

var saveUpload = saver(addImageMetadata);
var saveAvatar = saver(addAvatarMetadata);

exports.saveUpload = saveUpload;
exports.saveAvatar = saveAvatar;
