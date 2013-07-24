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
    wf = require("webfinger"),
    ActivityObject = require("./activityobject").ActivityObject,
    Stream = require("./stream").Stream,
    Step = require("step"),
    _ = require("underscore"),
    URLMaker = require("../urlmaker").URLMaker;

var Group = DatabankObject.subClass("group", ActivityObject);

Group.schema = ActivityObject.subSchema(["attachments",
                                         "inReplyTo"],
                                        ["members"]);

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
		    props.members = {
			url: URLMaker.makeURL("api/group/"+props._uuid+"/members")
		    };
		    props.documents = {
			url: URLMaker.makeURL("api/group/"+props._uuid+"/documents")
		    };
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
                Stream.create({name: group.membersStreamName()}, this.parallel());
                Stream.create({name: group.inboxStreamName()}, this.parallel());
                Stream.create({name: group.documentsStreamName()}, this.parallel());
            }
        },
        function(err, members, inbox) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

// Test for lack of members

Group.prototype.afterGet = function(callback) {

    var group = this,
        Upgrader = require("../upgrader");

    // Perform automated upgrades at read-time

    Upgrader.upgradeGroup(group, callback);
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
                group.getMembersStream(this.parallel());
                group.getDocumentsStream(this.parallel());
            }
        },
        function(err, members, documents) {
            if (err) throw err;
            members.count(this.parallel());
            documents.count(this.parallel());
        },
        function(err, membersCount, documentsCount) {
            if (err) {
                callback(err);
            } else {
                group.members.totalItems   = membersCount;
                group.documents.totalItems = documentsCount;
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

// Get the stream of this object's members.

Group.prototype.getMembersStream = function(callback) {
    var group = this;
    Stream.get(group.membersStreamName(), callback);
};

// Get the name of the stream used for this groups's documents

Group.prototype.documentsStreamName = function() {
    var group = this;
    return "group:"+group._uuid+":documents";
};

// Get the stream of this group's documents

Group.prototype.getDocumentsStream = function(callback) {
    var group = this;
    Step(
	function() {
	    Stream.get(group.documentsStreamName(), this);
	},
	function(err, str) {
	    if (!err) {
		callback(null, str);
	    } else if (err && err.name == "NoSuchThingError") {
		Stream.create({name: group.documentsStreamName()}, this);
	    } else if (err) {
		callback(err, null);
	    }
	},
	function(err, str) {
	    if (!err) {
		callback(null, str);
	    } else if (err && err.name == "AlreadyExistsError") {
		// Try again from the top
		group.getDocumentStream(callback);
	    } else if (err) {
		callback(err, null);
	    }
	}
    );
};

// Get the name of the stream used for this object's inbox.
// Just some boilerplate to avoid typos.

Group.prototype.inboxStreamName = function() {
    var group = this;
    return "group:"+group._uuid+":inbox";
};

// Get the stream of this object's inbox.

Group.prototype.getInboxStream = function(callback) {
    var group = this;
    Stream.get(group.inboxStreamName(), callback);
};

Group.prototype.getInbox = function(callback) {
    var group = this;

    Step(
        function() {
            wf.webfinger(group.id, this);
        },
        function(err, jrd) {
            var inboxes;
            if (err) {
                callback(err, null);
                return;
            } else if (!_(jrd).has("links") ||
                       !_(jrd.links).isArray()) {
                callback(new Error("Can't get inbox for " + group.id), null);
                return;
            } else {
                // Get the inboxes
                inboxes = jrd.links.filter(function(link) {
                    return (link.hasOwnProperty("rel") &&
                            link.rel == "activity-inbox" &&
                            link.hasOwnProperty("href"));
                });

                if (inboxes.length === 0) {
                    callback(new Error("Can't get inbox for " + group.id), null);
                    return;
                }

                callback(null, inboxes[0].href);
            }
        }
    );
};

Group.prototype.beforeUpdate = function(props, callback) {
    var group = this;

    Step(
        function() {
            ActivityObject.prototype.beforeUpdate.apply(group, [props, this]);
        },
        function(err, props) {
            if (err) {
                callback(err, null);
            } else {
                // Trim them if they existed before
                ActivityObject.trimCollection(props, "members");

                callback(null, props);
            }
        }
    );
};

Group.prototype.beforeSave = function(callback) {

    var group = this;

    Step(
        function() {
            ActivityObject.prototype.beforeSave.apply(group, [this]);
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                // Trim them if they existed before
                ActivityObject.trimCollection(group, "members");

                callback(null);
            }
        }
    );
};

exports.Group = Group;
