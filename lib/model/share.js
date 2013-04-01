// share.js
//
// A share by a person of an object
//
// Copyright 2012 E14N https://e14n.com/
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
    Step = require("step"),
    DatabankObject = require("databank").DatabankObject,
    IDMaker = require("../idmaker").IDMaker,
    Stamper = require("../stamper").Stamper,
    ActivityObject = require("./activityobject").ActivityObject;

var Share = DatabankObject.subClass("share");

exports.Share = Share;

Share.schema = { pkey: "id", 
                 fields: ["sharer",
                          "shared",
                          "published",
                          "updated"],
                 indices: ["sharer.id", "shared.id"] };

Share.id = function(sharer, shared) {
    return sharer.id + "♻" + shared.id;
};

Share.beforeCreate = function(props, callback) {

    if (!_(props).has("sharer") ||
        !_(props.sharer).has("id") ||
        !_(props.sharer).has("objectType") ||
        !_(props).has("shared") ||
        !_(props.shared).has("id") ||
        !_(props.shared).has("objectType")) {
        callback(new Error("Invalid Share"), null);
        return;
    }

    var now = Stamper.stamp();

    props.published = props.updated = now;

    props.id = Share.id(props.sharer, props.shared);

    Step(
        function() {
            // Save the author by reference; don't save the whole thing
            ActivityObject.compressProperty(props, "sharer", this.parallel());
            ActivityObject.compressProperty(props, "shared", this.parallel());
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, props);
            }
        }
    );

    callback(null, props);
};

Share.prototype.beforeUpdate = function(props, callback) {

    var immutable = ["sharer", "shared", "id", "published"],
        i, prop;

    for (i = 0; i < immutable.length; i++) {
        prop = immutable[i];
        if (_(props).has(prop)) {
            delete props[prop];
        }
    }

    var now = Stamper.stamp();

    props.updated = now;

    // XXX: store sharer, to by reference

    callback(null, props);
};

Share.prototype.beforeSave = function(callback) {

    var share = this;

    if (!_(share).has("sharer") ||
        !_(share.sharer).has("id") ||
        !_(share.sharer).has("objectType") ||
        !_(share).has("shared") ||
        !_(share.shared).has("id") ||
        !_(share.shared).has("objectType")) {
        callback(new Error("Invalid Share"), null);
        return;
    }

    var now = Stamper.stamp();

    share.updated = now;

    if (!_(share).has("id")) {

        share.id = Share.id(share.sharer, share.shared);

        if (!_(share).has("published")) {
            share.published = now;
        }
    }

    callback(null);
};

Share.prototype.expand = function(callback) {

    var share = this;

    Step(
        function() {
            ActivityObject.expandProperty(share, "sharer", this.parallel());
            ActivityObject.expandProperty(share, "shared", this.parallel());
        },
        callback
    );
};
