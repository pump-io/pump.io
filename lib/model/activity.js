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
    DatabankObject = databank.DatabankObject,
    NoSuchThingError = databank.NoSuchThingError,
    NotInStreamError = require("./stream").NotInStreamError;

var AppError = function(msg) {
    Error.captureStackTrace(this, AppError);
    this.name = 'AppError';
    this.message = msg;
};

AppError.prototype = new Error();
AppError.prototype.constructor = AppError;

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
    // but I kinda CBA. How's this: rewrite when we get over 10 case's...?

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
            callback(new AppError("No ID."));
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
    case Activity.DELETE:
        Step(
            function() {
                ActivityObject.getObject(act.object.objectType, act.object.id, this);
            },
            function(err, toDelete) {
                if (err) throw err;
                if (toDelete.author.id !== act.actor.id) {
                    throw new AppError("Can't delete " + toDelete.id + ": not author.");
                }
                toDelete.efface(this);
            },
            function(err, ts) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            }
        );
        break;
    case Activity.UPDATE:
        Step(
            function() {
                ActivityObject.getObject(act.object.objectType, act.object.id, this);
            },
            function(err, toUpdate) {
                if (err) throw err;
                if (toUpdate.author.id !== act.actor.id) {
                    throw new AppError("Can't update " + toUpdate.id + ": not author.");
                }
                toUpdate.update(act.object, this);
            },
            function(err, result) {
                if (err) {
                    callback(err);
                } else {
                    act.object = result;
                    callback(null);
                }
            }
        );
        break;
    case Activity.ADD:
        Step(
            function() {
                ActivityObject.ensureObject(act.object, this.parallel());
                ActivityObject.getObject(act.target.objectType, act.target.id, this.parallel());
            },
            function(err, toAdd, target) {
                if (err) throw err;
                if (target.author.id !== act.actor.id) {
                    throw new AppError("Can't add to " + target.id + ": not author.");
                }
                if (target.objectType !== "collection") {
                    throw new AppError("Can't add to " + target.id + ": not a collection.");
                }
                if (!_(target).has('objectTypes') || !_(target.objectTypes).isArray() ||
                    target.objectTypes.indexOf(toAdd.objectType) === -1) {
                    throw new AppError("Can't add to " + target.id + ": incorrect type.");
                }
                target.getStream(this);
            },
            function(err, stream) {
                if (err) throw err;
                stream.deliverObject({id: act.object.id, objectType: act.object.objectType}, this);
            },
            function(err) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            }
        );
        break;
    case Activity.REMOVE:
        Step(
            function() {
                ActivityObject.ensureObject(act.object, this.parallel());
                ActivityObject.getObject(act.target.objectType, act.target.id, this.parallel());
            },
            function(err, toAdd, target) {
                if (err) throw err;
                if (target.author.id !== act.actor.id) {
                    throw new AppError("Can't remove from " + target.id + ": not author.");
                }
                if (target.objectType !== "collection") {
                    throw new AppError("Can't remove from " + target.id + ": not a collection.");
                }
                if (!_(target).has('objectTypes') || !_(target.objectTypes).isArray() ||
                    target.objectTypes.indexOf(toAdd.objectType) === -1) {
                    throw new AppError("Can't remove from " + target.id + ": incorrect type.");
                }
                target.getStream(this);
            },
            function(err, stream) {
                if (err) throw err;
                stream.removeObject({id: act.object.id, objectType: act.object.objectType}, this);
            },
            function(err) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
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
        if (!_(props).has('links')) {
            props.links = {};
        }
        props.links.self = {
            href: URLMaker.makeURL("api/activity/" + props.uuid)
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
            ActivityObject.compressProperty(props, "target", this.parallel());
            ActivityObject.compressArray(props, "to", this.parallel());
            ActivityObject.compressArray(props, "cc", this.parallel());
            ActivityObject.compressArray(props, "bto", this.parallel());
            ActivityObject.compressArray(props, "bcc", this.parallel());
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
            ActivityObject.compressProperty(props, "target", this.parallel());
            ActivityObject.compressArray(props, "to", this.parallel());
            ActivityObject.compressArray(props, "cc", this.parallel());
            ActivityObject.compressArray(props, "bto", this.parallel());
            ActivityObject.compressArray(props, "bcc", this.parallel());
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
        if (!_(act).has('links')) {
            act.links = {};
        }
        act.links.self = {
            href: URLMaker.makeURL("api/activity/" + act.uuid)
        };
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
            ActivityObject.compressProperty(act, "target", this.parallel());
            ActivityObject.compressArray(act, "to", this.parallel());
            ActivityObject.compressArray(act, "cc", this.parallel());
            ActivityObject.compressArray(act, "bto", this.parallel());
            ActivityObject.compressArray(act, "bcc", this.parallel());
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
            ActivityObject.expandProperty(act, "target", this.parallel());
            ActivityObject.expandArray(act, "to", this.parallel());
            ActivityObject.expandArray(act, "cc", this.parallel());
            ActivityObject.expandArray(act, "bto", this.parallel());
            ActivityObject.expandArray(act, "bcc", this.parallel());
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
            ActivityObject.compressProperty(act, "target", this.parallel());
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

Activity.prototype.efface = function(callback) {
    
    var keepers = ["actor", "object", "uuid", "id", "published", "deleted", "updated"],
        prop,
        obj = this;
    
    for (prop in obj) {
        if (obj.hasOwnProperty(prop) && keepers.indexOf(prop) === -1) {
            delete obj[prop];
        }
    }

    var now = Stamper.stamp();

    obj.deleted = obj.updated = now;

    obj.save(callback);
};

Activity.prototype.sanitize = function(user) {

    if (!user || (user.profile.id !== this.actor.id)) {
        if (this.bcc) {
            delete this.bcc;
        }
        if (this.bto) {
            delete this.bto;
        }
    }

    // XXX: async?
    delete this.uuid;

    return;
};

// Is the person argument a recipient of this activity?
// Checks to, cc, bto, bcc
// If the public is a recipient, always works (even null)
// Otherwise if the person is a direct recipient, true.
// Otherwise if the person is in a list that's a recipient, true.
// Otherwise if the actor's followers list is a recipient, and the
// person is a follower, true.
// Otherwise false.

Activity.prototype.checkRecipient = function(person, callback) {

    var act = this,
        i,
        addrProps = ["to", "cc", "bto", "bcc"],
        recipientsOfType = function(type) {
            var i, j, addrs, rot = [];
            for (i = 0; i < addrProps.length; i++) {
                if (_(act).has(addrProps[i])) {
                    addrs = act[addrProps[i]];
                    for (j = 0; j < addrs.length; j++) {
                        if (addrs[j].objectType == type) {
                            rot.push(addrs[j]);
                        }
                    }
                }
            }
            return rot;
        },
        recipientWithID = function(id) {
            var i, j, addrs;
            for (i = 0; i < addrProps.length; i++) {
                if (_(act).has(addrProps[i])) {
                    addrs = act[addrProps[i]];
                    for (j = 0; j < addrs.length; j++) {
                        if (addrs[j].id == id) {
                            return addrs[j];
                        }
                    }
                }
            }
            return null;
        },
        isInLists = function(person, callback) {
            var isInList = function(list, callback) {
                Step(
                    function() {
                        Collection.isList(list, this);
                    },
                    function(err, isList) {
                        if (err) throw err;
                        if (!isList) {
                            callback(null, false);
                        } else {
                            list.getStream(this);
                        }
                    },
                    function(err, str) {
                        var val = JSON.stringify({id: person.id, objectType: person.objectType});
                        if (err) throw err;
                        str.indexOf(val, this);
                    },
                    function(err, i) {
                        if (err) {
                            if (err instanceof NotInStreamError) {
                                callback(null, false);
                            } else {
                                callback(err, null);
                            }
                        } else {
                            callback(null, true);
                        }
                    }
                );
            }; 
            Step(
                function() {
                    var i,
                        group = this.group(),
                        lists = recipientsOfType(ActivityObject.COLLECTION);
                    for (i = 0; i < lists.length; i++) {
                        isInList(lists[i], group());
                    }
                },
                function(err, inLists) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, inLists.some(function(b) { return b; }));
                    }
                }
            );
        },
        isInFollowers = function(person, callback) {
            if (!_(act).has("actor") || act.actor.objectType !== ActivityObject.PERSON) {
                callback(null, false);
                return;
            }
            Step(
                function() {
                    act.actor.followersURL(this);
                },
                function(err, url) {
                    if (err) throw err;
                    if (!url || !recipientWithID(url)) {
                        callback(null, false);
                    } else {
                        var Edge = require("./edge").Edge;
                        Edge.get(Edge.id(person.id, act.actor.id), this);
                    }
                },
                function(err, edge) {
                    if (err && err instanceof NoSuchThingError) {
                        callback(null, false);
                    } else if (!err) {
                        callback(null, true);
                    } else {
                        callback(err, null);
                    }
                }
            );
        },
        persons,
        Collection = require("./collection").Collection;

    // Check for public

    var pub = recipientWithID(Collection.PUBLIC);

    if (pub) {
        return callback(null, true);
    }

    // if not public, then anonymous user can't be a recipient

    if (!person) {
        return callback(null, false);
    }

    // Check for exact match

    persons = recipientsOfType("person");

    for (i = 0; i < persons.length; i++) {
        if (persons[i].id === person.id) {
            return callback(null, true);
        }
    }

    // From here on, things go async
    
    Step(
        function() {
            isInLists(person, this.parallel());
            isInFollowers(person, this.parallel());
        },
        function(err, inlists, infollowers) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, inlists || infollowers);
            }
        }
    );
};

// XXX: we should probably just cache this somewhere

Activity.postOf = function(obj, callback) {
    Activity.search({verb: Activity.POST, "object.id": obj.id}, function(err, acts) {
        var i;
        if (err) {
            return callback(err, null);
        } else if (acts.length === 0) {
            return callback(null, null);
        } else {
            // If there's more than one, check for match
            for (i = 0; i < acts.length; i++) {
                if (acts[i].actor && obj.author && acts[i].actor.id == obj.author.id) {
                    return callback(null, acts[i]);
                }
            }
            return callback(null, null);
        }
    });
};

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

exports.Activity = Activity;
exports.AppError = AppError;
