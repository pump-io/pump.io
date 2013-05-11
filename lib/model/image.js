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

exports.Image = Image;
