// activity.js
//
// data object representing an activity
//
// Copyright 2011,2012 StatusNet Inc.
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

var databank = require("databank"),
    Step = require("step"),
    _ = require("underscore"),
    URLMaker = require("../urlmaker").URLMaker,
    IDMaker = require("../idmaker").IDMaker,
    Stamper = require("../stamper").Stamper,
    ActivityObject = require("./activityobject").ActivityObject,
    DatabankObject = databank.DatabankObject;

var Activity = DatabankObject.subClass("activity");

Activity.schema = { pkey: "id", 
                    fields: ["actor",
                             "content",
                             "generator",
                             "icon",
                             "id",
                             "object",
                             "published",
                             "provider",
                             "target",
                             "title",
                             "url",
                             "uuid",
                             "updated",
                             "verb"],
                    indices: ["actor.id", "object.id", "uuid"] };

Activity.verbs = ["accept",
                  "access",
                  "acknowledge",
                  "add",
                  "agree",
                  "append",
                  "approve",
                  "archive",
                  "assign",
                  "at",
                  "attach",
                  "attend",
                  "author",
                  "authorize",
                  "borrow",
                  "build",
                  "cancel",
                  "close",
                  "complete",
                  "confirm",
                  "consume",
                  "checkin",
                  "close",
                  "create",
                  "delete",
                  "deliver",
                  "deny",
                  "disagree",
                  "dislike",
                  "experience",
                  "favorite",
                  "find",
                  "follow",
                  "give",
                  "host",
                  "ignore",
                  "insert",
                  "install",
                  "interact",
                  "invite",
                  "join",
                  "leave",
                  "like",
                  "listen",
                  "lose",
                  "make-friend",
                  "open",
                  "play",
                  "post",
                  "present",
                  "purchase",
                  "qualify",
                  "read",
                  "receive",
                  "reject",
                  "remove",
                  "remove-friend",
                  "replace",
                  "request",
                  "request-friend",
                  "resolve",
                  "return",
                  "retract",
                  "rsvp-maybe",
                  "rsvp-no",
                  "rsvp-yes",
                  "satisfy",
                  "save",
                  "schedule",
                  "search",
                  "sell",
                  "send",
                  "share",
                  "sponsor",
                  "start",
                  "stop-following",
                  "submit",
                  "tag",
                  "terminate",
                  "tie",
                  "unfavorite",
                  "unlike",
                  "unsatisfy",
                  "unsave",
                  "unshare",
                  "update",
                  "use",
                  "watch",
                  "win"];

var i = 0, verb;

// Constants-like members for activity verbs

for (i = 0; i < Activity.verbs.length; i++) {
    verb = Activity.verbs[i];
    Activity[verb.toUpperCase().replace("-", "_")] = verb;
}

Activity.init = function(inst, properties) {

    DatabankObject.init(inst, properties);

    if (!this.verb) {
        this.verb = "post";
    }

    if (inst.actor) {
        inst.actor = ActivityObject.toObject(inst.actor, ActivityObject.PERSON);
    }

    if (inst.object) {
        inst.object = ActivityObject.toObject(inst.object);
    }
};

Activity.prototype.apply = function(defaultActor, callback) {

    var act = this,
        User = require("./user").User,
        user;

    // Ensure an actor

    this.actor = this.actor || defaultActor;

    // XXX: Polymorphism is probably the right thing here
    // but I kinda CBA. How's this: rewrite when we get over 5 case's...?

    switch (this.verb) {
    case Activity.POST:
        // Force author data
        this.object.author = this.actor;
        // Is this it...?
        ActivityObject.createObject(this.object, function(err, result) {
            callback(err, result);
        });
        break;
    case Activity.FOLLOW:
        if (!this.actor.id || !this.object.id) {
            callback(new Error("No ID."));
        }

        ActivityObject.ensureObject(act.object, function(err, followed) {
            User.fromPerson(act.actor.id, function(err, user) {
                if (err) {
                    callback(err, null);
                } else {
                    user.follow(act.object.id, callback);
                }
            });
        });
        break;
    case Activity.STOP_FOLLOWING:
        // XXX: OStatus if necessary
        ActivityObject.ensureObject(act.object, function(err, followed) {
            User.fromPerson(act.actor.id, function(err, user) {
                if (err) {
                    callback(err, null);
                } else {
                    user.stopFollowing(act.object.id, callback);
                }
            });
        });
        break;
    case Activity.FAVORITE: // synonyms
    case Activity.LIKE:
        // XXX: Should we record favorite data for 
        // remote users?
        Step(
            function() {
                User.fromPerson(act.actor.id, this);
            },
            function(err, results) {
                if (err) throw err;
                user = results;
                ActivityObject.ensureObject(act.object, this);
            },
            function(err, tofavor) {
                if (err) {
                    callback(err, null);
                } else {
                    user.favorite(tofavor.id, tofavor.objectType, callback);
                }
            }
        );
        break;
    case Activity.UNFAVORITE:
    case Activity.UNLIKE:
        // XXX: Should we record favorite data for 
        // remote users?
        Step(
            function() {
                User.fromPerson(act.actor.id, this);
            },
            function(err, results) {
                if (err) throw err;
                user = results;
                ActivityObject.ensureObject(act.object, this);
            },
            function(err, tounfavor) {
                if (err) {
                    callback(err, null);
                } else {
                    user.unfavorite(tounfavor.id, tounfavor.objectType, callback);
                }
            }
        );
        break;
    default:
        // XXX: fave/unfave, join/leave, ...?
        callback(null);
        break;
    }
};

// XXX: identical to save

Activity.beforeCreate = function(props, callback) {

    var now = Stamper.stamp();

    props.updated = now;

    if (!props.published) {
        props.published = now;
    }

    if (!props.id) {
        props.uuid = IDMaker.makeID();
        props.id   = ActivityObject.makeURI("activity", props.uuid);
        props.links = {
            self: URLMaker.makeURL("api/activity/" + props.uuid)
        };
        // FIXME: assumes person data was set and that it's a local actor
        props.url  = URLMaker.makeURL(props.actor.preferredUsername + "/activity/" + props.uuid);

        // default verb

        if (!props.verb) {
            props.verb = "post";
        }
    }

    if (!props.actor) {
        callback(new Error("Activity has no actor"), null);
    }

    if (!props.object) {
        callback(new Error("Activity has no object"), null);
    }

    Step(
        function() {
            ActivityObject.compressProperty(props, "actor", this.parallel());
            ActivityObject.compressProperty(props, "object", this.parallel());
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

Activity.prototype.beforeUpdate = function(props, callback) {

    var now = Stamper.stamp();

    props.updated = now;

    Step(
        function() {
            ActivityObject.compressProperty(props, "actor", this.parallel());
            ActivityObject.compressProperty(props, "object", this.parallel());
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

// When save()'ing an activity, ensure the actor and object
// are persisted, then save them by reference.

Activity.prototype.beforeSave = function(callback) {

    var now = Stamper.stamp(),
        act = this;

    act.updated = now;

    if (!act.published) {
        act.published = now;
    }

    if (!act.id) {
        act.uuid = IDMaker.makeID();
        act.id   = ActivityObject.makeURI("activity", act.uuid);
        act.links = {};
        act.links.self = URLMaker.makeURL("api/activity/" + act.uuid);
        // FIXME: assumes person data was set and that it's a local actor
        act.url  = URLMaker.makeURL(act.actor.preferredUsername + "/activity/" + act.uuid);
    }

    if (!act.actor) {
        callback(new Error("Activity has no actor"));
        return;
    }

    if (!act.object) {
        callback(new Error("Activity has no object"));
        return;
    }

    Step(
        function() {
            ActivityObject.compressProperty(act, "actor", this.parallel());
            ActivityObject.compressProperty(act, "object", this.parallel());
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

// When get()'ing an activity, also get the actor and the object,
// which are saved by reference

Activity.prototype.afterCreate = 
Activity.prototype.afterSave = 
Activity.prototype.afterUpdate = 
Activity.prototype.afterGet = function(callback) {
    this.expand(callback);
};

Activity.prototype.expand = function(callback) {
    var act = this;

    Step(
        function() {
            ActivityObject.expandProperty(act, "actor", this.parallel());
            ActivityObject.expandProperty(act, "object", this.parallel());
        },
        function(err) {
            if (err) throw err;
            act.object.expandFeeds(this);
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                // Implied
                if (act.verb === "post" && _(act.object).has("author")) {
                    delete act.object.author;
                }
                callback(null);
            }
        }
    );
};

Activity.prototype.compress = function(callback) {
    var act = this;
    Step(
        function() {
            ActivityObject.compressProperty(act, "actor", this.parallel());
            ActivityObject.compressProperty(act, "object", this.parallel());
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

exports.Activity = Activity;
