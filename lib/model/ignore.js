// ignore.js
//
// A ignore by a user of an object
//
// Copyright 2012 E14N https://e14n.com/
//           2014 Mathias Gebbe https://intevation.de
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

var DatabankObject = require("databank").DatabankObject,
    IDMaker = require("../idmaker").IDMaker,
    Stamper = require("../stamper").Stamper,
    _ = require("underscore");

var Ignore = DatabankObject.subClass("ignore");

exports.Ignore = Ignore;

Ignore.schema = {   pkey: "id", 
                    fields: ["actor",
                             "object",
                             "published",
                             "updated"],
                    indices: ["actor.id", "object.id"] };

Ignore.id = function(actorId, objectId) {
    return actorId + "☓" + objectId;
};


Ignore.beforeCreate = function(props, callback) {

    if (!_(props).has("actor") ||
        !_(props.actor).has("id") ||
        !_(props.actor).has("objectType") ||
        !_(props).has("object") ||
        !_(props.object).has("id") ||
        !_(props.object).has("objectType")) {
        callback(new Error("Invalid Ignore"), null);
        return;
    }

    var now = Stamper.stamp();

    props.published = props.updated = now;

    props.id = Ignore.id(props.actor.id, props.object.id);

    callback(null, props);
};

Ignore.prototype.beforeUpdate = function(props, callback) {

    var immutable = ["actor", "object", "id", "published"],
        i, prop;

    for (i = 0; i < immutable.length; i++) {
        prop = immutable[i];
        if (_(props).has(prop)) {
            delete props[prop];
        }
    }

    var now = Stamper.stamp();

    props.updated = now;

    callback(null, props);
};

Ignore.prototype.beforeSave = function(callback) {

    if (!_(this).has("actor") ||
        !_(this.actor).has("id") ||
        !_(this.actor).has("objectType") ||
        !_(this).has("object") ||
        !_(this.object).has("id") ||
        !_(this.object).has("objectType")) {
        callback(new Error("Invalid Ignore"), null);
        return;
    }

    var now = Stamper.stamp();

    this.updated = now;

    if (!_(this).has("id")) {

        this.id = Ignore.id(this.actor.id, this.object.id);

        if (!_(this).has("published")) {
            this.published = now;
        }
    }

    callback(null);
};
