// group.js
//
// data object representing an group
//
// Copyright 2011-2013, E14N https://e14n.com/
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

var DatabankObject = require("databank").DatabankObject,
    ActivityObject = require("./activityobject").ActivityObject,
    Stream = require("./stream").Stream,
    Step = require("step"),
    _ = require("underscore"),
    URLMaker = require("../urlmaker").URLMaker;

var Group = DatabankObject.subClass("group", ActivityObject);

Group.schema = {
    pkey: "id",
    fields: ["author",
             "displayName",
             "published",
             "updated",
             "url"]
};

// Before creation, add a link to the activity inbox

Group.beforeCreate = function(props, callback) {
    var cls = this;
    Step(
        function() {
            ActivityObject.beforeCreate.apply(cls, [props, this]);
        },
        function(err, props) {
            if (err) throw err;
            Group.isLocal(props, this);
        },
        function(err, isLocal) {
            if (err) {
                callback(err, null);
            } else {
                if (isLocal) {
                    props.links["activity-inbox"] = {
                        href: URLMaker.makeURL("api/group/" + props._uuid + "/inbox")
                    };
                }
                callback(null, props);
            }
        }
    );
};

// After creation, for local groups, create a members stream

Group.prototype.afterCreate = function(callback) {

    var group = this;
    
    Step(
        function() {
            ActivityObject.prototype.afterCreate.apply(group, [this]);
        },
        function(err) {
            if (err) throw err;
            group.isLocal(this);
        },
        function(err, loc) {
            if (err) throw err;
            if (!loc) {
                callback(null);
            } else {
                Stream.create({name: group.membersStreamName()}, this);
            }
        },
        function(err, stream) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

// Test to see if a group is local

Group.prototype.isLocal = function(callback) {

    var group = this;

    Group.isLocal(group, callback);
};

// Class method so we can pass either an instance or a regular Object

Group.isLocal = function(props, callback) {

    var User = require("./user").User;

    if (!props.author || !props.author.id) {
        callback(null, false);
        return;
    }

    Step(
        function() {
            User.fromPerson(props.author.id, this);
        },
        function(err, user) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, !!user);
            }
        }
    );
};

// Add the extra feeds properties to an activity object. For groups, we have a
// members feed.

Group.prototype.expandFeeds = function(callback) {

    var group = this;

    Step(
        function() {
            group.isLocal(this);
        },
        function(err, isLocal) {
            if (err) throw err;
            if (!isLocal) {
                callback(null);
            } else {
                group.getMembersStream(this);
            }
        },
        function(err, stream) {
            if (err) throw err;
            stream.count(this.parallel());
            stream.getObjects(0, 4, this.parallel());
        },
        function(err, count, members) {
            if (err) {
                callback(err);
            } else {
                group.members = {
                    totalItems: count,
                    url: URLMaker.makeURL("api/group/"+group._uuid+"/members")
                };
                if (members && members.length > 0) {
                    group.members.items = members;
                }
                callback(null);
            }
        }
    );
};

// Get the name of the stream used for this object's members.
// Just some boilerplate to avoid typos.

Group.prototype.membersStreamName = function() {
    var group = this;
    return "group:"+group._uuid+":members";
};

// Get the name of the stream used for this object's members.
// Just some boilerplate to avoid typos.

Group.prototype.getMembersStream = function(callback) {
    var group = this;
    Stream.get(group.membersStreamName(), callback);
};

exports.Group = Group;
