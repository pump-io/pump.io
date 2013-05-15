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

var os = require("os"),
    Step = require("step"),
    URLMaker = require("../urlmaker").URLMaker,
    _ = require("underscore"),
    path = require("path"),
    DatabankObject = require("databank").DatabankObject,
    thumbnail = require("../thumbnail"),
    mover = require("../mover"),
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

// Part of a no-upgrade upgrade from v0.2.x. If we get an image that's
// been saved without a thumbnail, add the thumbnail and save.

Image.prototype.afterGet = function(callback) {

    var img = this,
        fname,
        tmpname;

    // Is this a local image with no size metadata?

    if (img._slug && _.isObject(img.image) && !_.has(img.image, "width")) {

        // Do the things needed to bring it up to date

        fname = path.join(Image.uploadDir, img._slug);
        tmpname = path.join(os.tmpdir(), img._uuid);

        Step(
            function() {
                thumbnail.autorotate(fname, tmpname, this);
            },
            function(err) {
                if (err) throw err;
                mover.safeMove(tmpname, fname, this);
            },
            function(err) {
                if (err) throw err;
                thumbnail.addImageMetadata(img, Image.uploadDir, this);
            },
            function(err) {
                if (err) throw err;
                img.save(this);
            },
            function(err, saved) {
                callback(err);
            }
        );
    } else {
        callback(null);
    }
};

exports.Image = Image;
