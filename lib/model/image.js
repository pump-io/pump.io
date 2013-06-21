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

var _ = require("underscore"),
    DatabankObject = require("databank").DatabankObject,
    ActivityObject = require("./activityobject").ActivityObject;

var Image = DatabankObject.subClass("image", ActivityObject);

Image.schema = ActivityObject.subSchema(["attachments"],
                                        ["fullImage",
                                         "_slug",
                                         "_fslug"]);

Image.schema.indices = _.union(Image.schema.indices,
                               ["_slug",
                                "_fslug",
                                "image.url",
                                "fullImage.url"]);

Image.prototype.afterGet = function(callback) {

    var img = this,
        fname,
        tmpname,
        Upgrader = require("../upgrader");

    // Part of a no-upgrade upgrade from v0.2.x. If we get an image that's
    // been saved without a thumbnail, add the thumbnail and save.

    Upgrader.upgradeImage(img, callback);
};

exports.Image = Image;
