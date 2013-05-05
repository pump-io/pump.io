// image.js
//
// data object representing an image
//
// Copyright 2011, 2013 E14N https://e14n.com/
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
    URLMaker = require("../urlmaker").URLMaker,
    _ = require("underscore"),
    gm = require("gm"),
    path = require("path"),
    DatabankObject = require("databank").DatabankObject,
    ActivityObject = require("./activityobject").ActivityObject;

var Image = DatabankObject.subClass("image", ActivityObject);

Image.schema = {
    pkey: "id",
    fields: ["author",
             "displayName",
             "image",
             "fullImage",
             "published",
             "content",
             "updated",
             "url",
             "_uuid",
             "_slug",
             "_fslug"],
    indices: ["_uuid", "_slug", "_fslug", "image.url", "fullImage.url"]
};

Image.beforeCreate = function(props, callback) {
    var cls = this;

    Step(
        function() {
            ActivityObject.beforeCreate.apply(cls, [props, this]);
        },
        function(err, props) {
            if (_.has(props, "_slug")) {
                Image.addMetadata(props, this);
            } else {
                this(null);
            }
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, props);
            }
        }
    );
};

var MAX_THUMB = 640;

Image.addMetadata = function(props, callback) {

    var fname = path.join(Image.uploadDir, props._slug),
        thumbnail = function(size, callback) {
            var dirname = path.dirname(props._slug),
                extname = path.extname(fname),
                basename = path.basename(fname, extname),
                tslug = path.join(dirname, basename + "_thumb" + extname),
                tname = path.join(Image.uploadDir, tslug),
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
                        callback(err);
                    } else {
                        props.fullImage = props.image;
                        props.image = {
                            url: URLMaker.makeURL("uploads/" + tslug),
                            width: newWidth,
                            height: newHeight
                        };
                        props._fslug = props._slug;
                        props._slug = tslug;
                        callback(null);
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
                this(null);
            }
        },
        callback
    );
};

exports.Image = Image;
