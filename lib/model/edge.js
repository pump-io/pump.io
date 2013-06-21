// edge.js
//
// An edge in the social graph, from follower to followed
//
// Copyright 2011,2012 E14N https://e14n.com/
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
    DatabankObject = require("databank").DatabankObject,
    IDMaker = require("../idmaker").IDMaker,
    Stamper = require("../stamper").Stamper,
    ActivityObject = require("./activityobject").ActivityObject,
    _ = require("underscore");

var Edge = DatabankObject.subClass("edge");

exports.Edge = Edge;

Edge.schema = { pkey: "id", 
                fields: ["from",
                         "to",
                         "published",
                         "updated"],
                indices: ["from.id", "to.id"] };

Edge.id = function(fromId, toId) {
    return fromId + "→" + toId;
};

Edge.beforeCreate = function(props, callback) {

    if (!_(props).has("from") ||
        !_(props.from).has("id") ||
        !_(props.from).has("objectType") ||
        !_(props).has("to") ||
        !_(props.to).has("id") ||
        !_(props.to).has("objectType")) {
        callback(new Error("Invalid Edge"), null);
        return;
    }

    var now = Stamper.stamp();

    props.published = props.updated = now;

    props.id = Edge.id(props.from.id, props.to.id);

    Step(
        function() {
            ActivityObject.compressProperty(props, "from", this.parallel());
            ActivityObject.compressProperty(props, "to", this.parallel());
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

Edge.prototype.beforeUpdate = function(props, callback) {

    var immutable = ["from", "to", "id", "published"],
        i, prop;

    for (i = 0; i < immutable.length; i++) {
        prop = immutable[i];
        if (_(props).has(prop)) {
            delete props[prop];
        }
    }

    var now = Stamper.stamp();

    props.updated = now;

    // XXX: store from, to by reference

    callback(null, props);
};

Edge.prototype.beforeSave = function(callback) {

    if (!_(this).has("from") ||
        !_(this.from).has("id") ||
        !_(this.from).has("objectType") ||
        !_(this).has("to") ||
        !_(this.to).has("id") ||
        !_(this.to).has("objectType")) {
        callback(new Error("Invalid Edge"), null);
        return;
    }

    var now = Stamper.stamp();

    this.updated = now;

    if (!_(this).has("id")) {

        this.id = IDMaker.newId();

        if (!_(this).has("published")) {
            this.published = now;
        }
    }

    callback(null);
};
