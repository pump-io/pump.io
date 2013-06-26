// membership.js
//
// A membership by a person in a group
//
// Copyright 2013 E14N https://e14n.com/
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
    _ = require("underscore");

var Membership = DatabankObject.subClass("membership");

exports.Membership = Membership;

Membership.schema = { pkey: "id",
                    fields: ["member",
                             "group",
                             "published",
                             "updated"],
                    indices: ["member.id", "group.id"] };

// Helper to create a compliant and unique membership ID

Membership.id = function(memberId, groupId) {
    return memberId + "∈" + groupId;
};

// Before creation, check that member and group are reasonable
// and compress them. Also, timestamp for published/updated.

Membership.beforeCreate = function(props, callback) {

    var now = Stamper.stamp(),
        oldMember,
        oldGroup;

    if (!_(props).has("member") ||
        !_(props.member).has("id") ||
        !_(props.member).has("objectType") ||
        !_(props).has("group") ||
        !_(props.group).has("id") ||
        !_(props.group).has("objectType")) {
        callback(new Error("Invalid Membership"), null);
        return;
    }

    props.published = props.updated = now;

    props.id = Membership.id(props.member.id, props.group.id);

    oldMember = props.member;

    props.member = {
        id: oldMember.id,
        objectType: oldMember.objectType
    };

    oldGroup = props.group;

    props.group = {
        id: oldGroup.id,
        objectType: oldGroup.objectType
    };

    callback(null, props);
};

// Before update, discard immutable properties,
// and add an update timestamp.

Membership.prototype.beforeUpdate = function(props, callback) {

    var immutable = ["member", "group", "id", "published"],
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

// Save is a little bit create, a little bit update.

Membership.prototype.beforeSave = function(callback) {

    var ship = this,
        oldMember,
        oldGroup;

    if (!_(ship).has("member") ||
        !_(ship.member).has("id") ||
        !_(ship.member).has("objectType") ||
        !_(ship).has("group") ||
        !_(ship.group).has("id") ||
        !_(ship.group).has("objectType")) {
        callback(new Error("Invalid Membership"), null);
        return;
    }

    var now = Stamper.stamp();

    ship.updated = now;

    // This is how we can tell it's new.

    if (!_(ship).has("id")) {

        ship.id = Membership.id(ship.member.id, ship.group.id);

        if (!_(ship).has("published")) {
            ship.published = now;
        }
    }

    oldMember = ship.member;

    ship.member = {
        id: oldMember.id,
        objectType: oldMember.objectType
    };

    oldGroup = ship.group;

    ship.group = {
        id: oldGroup.id,
        objectType: oldGroup.objectType
    };

    callback(null);
};

// Utility to determine if a person is a member of a group

Membership.isMember = function(person, group, callback) {
    Step(
        function() {
            Membership.get(Membership.id(person.id, group.id), this);
        },
        function(err, ship) {
            if (err && err.name == "NoSuchThingError") {
                callback(null, false);
            } else if (err) {
                callback(err, null);
            } else {
                callback(null, true);
            }
        }
    );
};
