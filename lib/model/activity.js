// activity.js
//
// data object representing an activity
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

var databank = require("databank"),
    Step = require("step"),
    _ = require("underscore"),
    URLMaker = require("../urlmaker").URLMaker,
    IDMaker = require("../idmaker").IDMaker,
    Stamper = require("../stamper").Stamper,
    ActivityObject = require("./activityobject").ActivityObject,
    Edge = require("./edge").Edge,
    Share = require("./share").Share,
    Favorite = require("./favorite").Favorite,
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
                             "_uuid",
                             "to",
                             "cc",
                             "bto",
                             "bcc",
                             "_received",
                             "updated",
                             "verb"],
                    indices: ["actor.id", "object.id", "_uuid"] };

var oprops = ["actor",
              "generator",
              "provider",
              "object",
              "target",
              "context",
              "location",
              "source"],
    aprops = ["to",
              "cc",
              "bto",
              "bcc"];

Activity.init = function(inst, properties) {

    var i;

    DatabankObject.init(inst, properties);

    if (!inst.verb) {
        inst.verb = "post";
    }

    if (inst.actor) {
        inst.actor = ActivityObject.toObject(inst.actor, ActivityObject.PERSON);
    }

    _.each(_.without(oprops, "actor"), function(prop) {
        if (inst[prop] && _.isObject(inst[prop]) && !(inst[prop] instanceof ActivityObject)) {
            inst[prop] = ActivityObject.toObject(inst[prop]);
        }
    });

    _.each(aprops, function(aprop) {
        var addrs = inst[aprop];
        if (addrs && _.isArray(addrs)) {
            _.each(addrs, function(addr, i) {
                if (addr && _.isObject(addr) && !(addr instanceof ActivityObject)) {
                    addrs[i] = ActivityObject.toObject(addr, ActivityObject.PERSON);
                }
            });
        }
    });
};

Activity.prototype.apply = function(defaultActor, callback) {

    var act = this,
        verb,
        method,
        camelCase = function(str) {
            var parts = str.split("-"),
                upcase = parts.map(function(part) {
                    return part.substring(0,1).toUpperCase() + part.substring(1, part.length).toLowerCase();
                });

            return upcase.join("");
        };

    // Ensure an actor

    act.actor = act.actor || defaultActor;

    // Find the apply method

    verb = act.verb;

    // On unknown verb, skip

    if (!_.contains(Activity.verbs, verb)) {
        callback(null);
        return;
    }

    // Method like applyLike or applyStopFollowing

    method = "apply" + camelCase(verb);

    // Do we know how to apply it?

    if (!_.isFunction(act[method])) {
        callback(null);
        return;
    }

    act[method](callback);
};

Activity.prototype.applyPost = function(callback) {

    var act = this,
        postNew = function(object, callback) {
            ActivityObject.createObject(act.object, callback);
        },
        postExisting = function(object, callback) {
            Step(
                function() {
                    Activity.postOf(object, this);
                },
                function(err, post) {
                    if (err) throw err;
                    if (post) {
                        callback(new Error("Already posted"), null);
                    } else {
                        callback(null, act.object);
                    }
                }
            );
        };

    // Force author data
    this.object.author = this.actor;
    // Is this it...?

    Step(
        function() {
            ActivityObject.getObject(act.object.objectType, act.object.id, this);
        },
        function(err, obj) {
            if (err && err.name == "NoSuchThingError") {
                postNew(act.object, this);
            } else if (err && err.name != "NoSuchThingError") {
                throw err;
            } else if (!err) {
                postExisting(act.object, this);
            }
        },
        function(err, obj) {
            if (err) {
                callback(err, null);
            } else if (act.target) {
                addToTarget(act.actor, act.object, act.target, callback);
            } else {
                callback(null, obj);
            }
        }
    );
};

Activity.prototype.applyCreate = Activity.prototype.applyPost;

Activity.prototype.applyFollow = function(callback) {

    var act = this,
        User = require("./user").User,
        user;

    if (!this.actor.id) {
        callback(new AppError("No actor ID for activity " + act.id));
        return;
    } else if (!this.object.id) {
        callback(new AppError("No object ID for activity " + act.id));
        return;
    }

    Step(
        function() {
            Edge.create({from: act.actor, to: act.object},
                        this);
        },
        function(err, edge) {
            if (err) throw err;
            ActivityObject.ensureObject(act.actor, this.parallel());
            ActivityObject.ensureObject(act.object, this.parallel());
        },
        function(err, follower, followed) {
            if (err) throw err;
            User.fromPerson(follower.id, this.parallel());
            User.fromPerson(followed.id, this.parallel());
        },
        function(err, followerUser, followedUser) {
            var group = this.group();
            if (err) throw err;
            if (followerUser) {
                followerUser.addFollowing(act.object.id, group());
            }
            if (followedUser) {
                followedUser.addFollower(act.actor.id, group());
            }
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

Activity.prototype.applyStopFollowing = function(callback) {

    var act = this,
        User = require("./user").User,
        user;

    if (!this.actor.id) {
        callback(new AppError("No actor ID for activity " + act.id));
        return;
    } else if (!this.object.id) {
        callback(new AppError("No object ID for activity " + act.id));
        return;
    }

    // XXX: OStatus if necessary

    Step(
        function() {
            Edge.get(Edge.id(act.actor.id, act.object.id), this);
        },
        function(err, edge) {
            if (err) throw err;
            edge.del(this);
        },
        function(err) {
            if (err) throw err;
            ActivityObject.ensureObject(act.actor, this.parallel());
            ActivityObject.ensureObject(act.object, this.parallel());
        },
        function(err, follower, followed) {
            if (err) throw err;
            User.fromPerson(follower.id, this.parallel());
            User.fromPerson(followed.id, this.parallel());
        },
        function(err, followerUser, followedUser) {
            var group = this.group();
            if (err) throw err;
            if (followerUser) {
                followerUser.removeFollowing(act.object.id, group());
            }
            if (followedUser) {
                followedUser.removeFollower(act.actor.id, group());
            }
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

Activity.prototype.applyFavorite = function(callback) {

    var act = this,
        User = require("./user").User;

    Step(
        function() {
            Favorite.create({from: act.actor,
                             to: act.object},
                            this);
        },
        function(err, fave) {
            if (err) throw err;
            ActivityObject.ensureObject(act.object, this);
        },
        function(err, object) {
            if (err) throw err;
            object.favoritedBy(act.actor.id, this);
        },
        function(err) {
            if (err) throw err;
            User.fromPerson(act.actor.id, this);
        },
        function(err, user) {
            if (err) throw err;
            if (user) {
                user.addToFavorites(act.object, this);
            } else {
                this(null);
            }
        },
        callback
    );
};

Activity.prototype.applyLike = Activity.prototype.applyFavorite;

Activity.prototype.applyUnfavorite = function(callback) {

    var act = this,
        User = require("./user").User;

    Step(
        function() {
            Favorite.get(Favorite.id(act.actor.id, act.object.id), this);
        },
        function(err, favorite) {
            if (err) throw err;
            favorite.del(this);
        },
        function(err) {
            if (err) throw err;
            ActivityObject.ensureObject(act.object, this);
        },
        function(err, obj) {
            if (err) throw err;
            obj.unfavoritedBy(act.actor.id, this);
        },
        function(err) {
            if (err) throw err;
            User.fromPerson(act.actor.id, this);
        },
        function(err, user) {
            if (err) throw err;
            if (user) {
                user.removeFromFavorites(act.object, this);
            } else {
                this(null);
            }
        },
        callback
    );
};

Activity.prototype.applyUnlike = Activity.prototype.applyUnfavorite;

Activity.prototype.applyDelete = function(callback) {

    var act = this;

    Step(
        function() {
            ActivityObject.getObject(act.object.objectType, act.object.id, this);
        },
        function(err, toDelete) {
            if (err) throw err;
            if (!_.has(toDelete, "author") ||
                !_.isObject(toDelete.author) ||
                (toDelete.author.id !== act.actor.id)) {
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
};

Activity.prototype.applyUpdate = function(callback) {

    var act = this;

    Step(
        function() {
            ActivityObject.getObject(act.object.objectType, act.object.id, this);
        },
        function(err, toUpdate) {
            if (err) throw err;

            if (_.has(toUpdate, "author") && _.isObject(toUpdate.author)) {
                // has an author; check if it's the actor
                if (toUpdate.author.id !== act.actor.id) {
                    throw new AppError("Can't update " + toUpdate.id + ": not author.");
                }
            } else {
                // has no author; only OK if it's the actor updating their own profile
                if (act.actor.id !== act.object.id) {
                    throw new AppError("Can't update " + toUpdate.id + ": not you.");
                }
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
};

Activity.prototype.applyAdd = function(callback) {
    var act = this;
    addToTarget(act.actor, act.object, act.target, callback);
};

var addToTarget = function(actor, object, target, callback) {

    var addToCollection = function(actor, object, target, callback) {

        var user;

        Step(
            function() {
                var Collection = require("./collection").Collection;
                Collection.isList(target, this);
            },
            function(err, result) {
                if (err) throw err;
                user = result;
                if (!user) {
                    // It's not our list, so we don't care.
                    callback(null, null);
                } else {
                    // XXX: we don't guard targets we don't know the author of
                    if (target.author && target.author.id !== actor.id) {
                        throw new AppError("Can't add to " + target.id + ": not author.");
                    }

                    // XXX: we don't guard targets with unknown types
                    if (_(target).has('objectTypes') && _(target.objectTypes).isArray() &&
                        target.objectTypes.indexOf(object.objectType) === -1) {
                        throw new AppError("Can't add to " + target.id + ": incorrect type.");
                    }
                    target.getStream(this);
                }
            },
            function(err, stream) {
                if (err) throw err;
                stream.deliverObject({id: object.id, objectType: object.objectType}, this);
            },
            function(err) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            }
        );
    },
        addToGroup = function(actor, object, target, callback) {

            var str;

            Step(
                function() {
                    var Membership = require("./membership").Membership;
                    Membership.isMember(actor, target, this);
                },
                function(err, isMember) {
                    if (err) throw err;
                    if (!isMember) throw new AppError("Actor is not a member of the group.");
                    target.getDocumentsStream(this);
                },
                function(err, results) {
                    if (err) throw err;
                    str = results;
                    str.hasObject({id: object.id, objectType: object.objectType}, this);
                },
                function(err, hasObject) {
                    if (err) throw err;
                    if (hasObject) throw new AppError("Group already contains object.");
                    str.deliverObject({id: object.id, objectType: object.objectType}, this);
                },
                callback
            );
        };

    Step(
        function() {
            ActivityObject.ensureObject(object, this.parallel());
            ActivityObject.ensureObject(target, this.parallel());
        },
        function(err, toAdd, target) {
            if (err) throw err;
            switch (target.objectType) {
            case ActivityObject.COLLECTION:
                addToCollection(actor, toAdd, target, this);
                break;
            case ActivityObject.GROUP:
                addToGroup(actor, toAdd, target, this);
                break;
            default:
                throw new AppError("Can't add to " + target.id + ": don't know how to add to type '" + target.objectType + "'");
            }
        },
        callback
    );
};

Activity.prototype.applyRemove = function(callback) {

    var act = this,
        removeFromCollection = function(actor, object, target, callback) {

            if (target.author.id !== actor.id) {
                throw new AppError("Can't remove from " + target.id + ": not author.");
            }
            if (!_(target).has('objectTypes') || !_(target.objectTypes).isArray() ||
                target.objectTypes.indexOf(object.objectType) === -1) {
                throw new AppError("Can't remove from " + target.id + ": incorrect type.");
            }

            Step(
                function() {
                    target.getStream(this);
                },
                function(err, stream) {
                    if (err) throw err;
                    stream.removeObject({id: object.id, objectType: object.objectType}, this);
                },
                function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                }
            );
        },
        removeFromGroup = function(actor, object, target, callback) {

            var str;

            Step(
                function() {
                    var Membership = require("./membership").Membership;
                    Membership.isMember(actor, target, this);
                },
                function(err, isMember) {
                    if (err) throw err;
                    if (!isMember) throw new AppError("Actor is not a member of the group.");
                    target.getDocumentsStream(this);
                },
                function(err, results) {
                    if (err) throw err;
                    str = results;
                    str.removeObject({id: object.id, objectType: object.objectType}, this);
                },
                callback
            );
        };

    Step(
        function() {
            ActivityObject.ensureObject(act.object, this.parallel());
            ActivityObject.getObject(act.target.objectType, act.target.id, this.parallel());
        },
        function(err, toRemove, target) {
            if (err) throw err;
            switch (target.objectType) {
            case ActivityObject.COLLECTION:
                removeFromCollection(act.actor, toRemove, target, this);
                return;
            case ActivityObject.GROUP:
                removeFromGroup(act.actor, toRemove, target, this);
                return;
            default:
                throw new AppError("Can't remove from " + target.id + ": don't know how to remove from a '"+target.objectType+"'.");
            }
        },
        callback
    );
};

Activity.prototype.applyShare = function(callback) {

    var act = this;

    Step(
        function() {
            ActivityObject.ensureObject(act.object, this);
        },
        function(err, obj) {
            if (err) throw err;
            obj.getSharesStream(this);
        },
        function(err, str) {
            var ref;
            if (err) throw err;
            ref = {
                objectType: act.actor.objectType,
                id: act.actor.id
            };
            str.deliverObject(ref, this);
        },
        function(err) {
            var share;
            if (err) throw err;
            share = new Share({
                sharer: act.actor,
                shared: act.object
            });
            share.save(this);
        },
        callback
    );
};

Activity.prototype.applyUnshare = function(callback) {

    var act = this;

    Step(
        function() {
            ActivityObject.ensureObject(act.object, this);
        },
        function(err, obj) {
            if (err) throw err;
            obj.getSharesStream(this);
        },
        function(err, str) {
            var ref;
            if (err) throw err;
            ref = {
                objectType: act.actor.objectType,
                id: act.actor.id
            };
            str.removeObject(ref, this);
        },
        function(err) {
            if (err) throw err;
            Share.get(Share.id(act.actor, act.object), this);
        },
        function(err, share) {
            if (err) throw err;
            share.del(this);
        },
        callback
    );
};

// For joining something.
// Although the object can be a few things (like services)
// we only monitor when someone joins a group.

Activity.prototype.applyJoin = function(callback) {

    var act = this,
        Membership = require("./membership").Membership,
        group,
        joinLocal = function(callback) {
            Step(
                function() {
                    Activity.postOf(group, this);
                },
                function(err, post) {
                    if (err) throw err;
                    if (!post) {
                        throw new Error("No authorization info for group " + group.displayName);
                    }
                    post.checkRecipient(act.actor, this);
                },
                function(err, isRecipient) {
                    if (err) throw err;
                    if (!isRecipient) {
                        throw new Error(act.actor.displayName + " is not allowed to join group " + group.displayName);
                    }
                    Membership.create({member: act.actor, group: group}, this);
                },
                function(err, mem) {
                    if (err) throw err;
                    group.getMembersStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    str.deliver(act.actor.id, this);
                },
                callback
            );
        },
        joinRemote = function(callback) {
            Step(
                function() {
                    Membership.create({member: act.actor, group: group}, this);
                },
                callback
            );
        };

    // We just care about groups

    if (act.object.objectType != ActivityObject.GROUP) {
        callback(null);
        return;
    }

    // Record the membership

    Step(
        function() {
            ActivityObject.ensureObject(act.object, this);
        },
        function(err, results) {
            if (err) throw err;
            group = results;
            group.isLocal(this);
        },
        function(err, isLocal) {
            if (err) throw err;
            if (isLocal) {
                joinLocal(this);
            } else {
                joinRemote(this);
            }
        },
        callback
    );
};

// For leaving something.
// Although the object can be a few things (like services)
// we only monitor when someone joins a group.

Activity.prototype.applyLeave = function(callback) {

    var act = this,
        group;

    // We just care about groups

    if (act.object.objectType != ActivityObject.GROUP) {
        callback(null);
        return;
    }

    // Record the membership

    Step(
        function() {
            ActivityObject.ensureObject(act.object, this);
        },
        function(err, results) {
            var Membership = require("./membership").Membership;
            if (err) throw err;
            group = results;
            Membership.get(Membership.id(act.actor.id, group.id), this);
        },
        function(err, membership) {
            if (err) throw err;
            membership.del(this);
        },
        function(err) {
            var User = require("./user").User;
            if (err) throw err;
            if (!group.author || !group.author.id) {
                callback(null);
            } else {
                User.fromPerson(group.author.id, this);
            }
        },
        function(err, user) {
            if (err) throw err;
            if (!user) {
                callback(null);
            } else {
                group.getMembersStream(this);
            }
        },
        function(err, str) {
            if (err) throw err;
            str.remove(act.actor.id, this);
        },
        callback
    );
};

Activity.prototype.recipients = function() {
    var act = this,
        props = ["to", "cc", "bto", "bcc", "_received"],
        recipients = [];

    props.forEach(function(prop) {
        if (_(act).has(prop) && _(act[prop]).isArray()) {
            recipients = recipients.concat(act[prop]);
        }
    });

    // XXX: ensure uniqueness

    return recipients;
};

// Set default recipients

Activity.prototype.ensureRecipients = function(callback) {

    var act = this,
        recipients = act.recipients(),
        setToFollowers = function(act, callback) {
            Step(
                function() {
                    ActivityObject.ensureObject(act.actor, this);
                },
                function(err, actor) {
                    if (err) throw err;
                    actor.followersURL(this);
                },
                function(err, url) {
                    if (err) {
                        callback(err);
                    } else if (!url) {
                        callback(new Error("no followers url"));
                    } else {
                        act.cc = [{
                            objectType: "collection",
                            id: url
                        }];
                        callback(null);
                    }
                }
            );
        };

    // If we've got recipients, cool.

    if (recipients.length > 0) {
        callback(null);
        return;
    }

    // Modification verbs use same as original post
    // Note: skip update/delete of self; handled below

    if ((act.verb == Activity.DELETE ||
         act.verb == Activity.UPDATE) &&
        (!act.actor || !act.object || act.actor.id != act.object.id)) {
        Step(
            function() {
                ActivityObject.getObject(act.object.objectType, act.object.id, this);
            },
            function(err, orig) {
                if (err) throw err;
                Activity.postOf(orig, this);
            },
            function(err, post) {
                var props = ["to", "cc", "bto", "bcc"];
                if (err) {
                    callback(err);
                } else if (!post) {
                    callback(new Error("no original post"));
                } else {
                    props.forEach(function(prop) {
                        if (post.hasOwnProperty(prop)) {
                            act[prop] = post[prop];
                        }
                    });
                    callback(null);
                }
            }
        );
    } else if (act.verb == Activity.FAVORITE ||
               act.verb == Activity.UNFAVORITE ||
               act.verb == Activity.LIKE ||
               act.verb == Activity.DISLIKE) {
        Step(
            function() {
                ActivityObject.getObject(act.object.objectType, act.object.id, this);
            },
            function(err, orig) {
                if (err && err.name == "NoSuchThingError") {
                    setToFollowers(act, callback);
                } else if (err) {
                    throw err;
                } else {
                    Activity.postOf(orig, this);
                }
            },
            function(err, post) {
                var props = ["to", "cc", "bto", "bcc"];
                if (err && err.name == "NoSuchThingError") {
                    setToFollowers(act, callback);
                } else if (err) {
                    callback(err);
                } else if (!post) {
                    setToFollowers(act, callback);
                } else {
                    props.forEach(function(prop) {
                        if (post.hasOwnProperty(prop)) {
                            act[prop] = post[prop];
                        }
                    });
                    callback(null);
                }
            }
        );

    } else if (act.object && act.object.objectType == ActivityObject.PERSON &&
               (!act.actor || act.actor.id != act.object.id)) {
        // XXX: cc? bto?
        act.to = [act.object];
        if (act.actor.followers && act.actor.followers.url) {
            act.cc = [{
                id: act.actor.followers.url,
                objectType: "collection"
            }];
        }
        callback(null);
    } else if (act.object &&
               act.object.objectType == ActivityObject.GROUP &&
               act.verb != Activity.CREATE) {
        // XXX: cc? bto?
        act.to = [act.object];
        if (act.actor.followers && act.actor.followers.url) {
            act.cc = [{
                id: act.actor.followers.url,
                objectType: "collection"
            }];
        }
        callback(null);
    } else if (act.target &&
               act.target.objectType == ActivityObject.GROUP &&
               (act.verb == Activity.ADD || act.verb == Activity.REMOVE || act.verb == Activity.POST)) {
        // XXX: cc? bto?
        act.to = [act.target];
        callback(null);
    } else if (act.object && act.object.inReplyTo) {
        // Replies use same as original post
        Step(
            function() {
                ActivityObject.ensureObject(act.object.inReplyTo, this);
            },
            function(err, orig) {
                if (err) throw err;
                Activity.postOf(orig, this);
            },
            function(err, post) {
                var props = ["to", "cc", "bto", "bcc"];
                if (err) {
                    callback(err);
                } else if (!post) {
                    callback(new Error("no original post"));
                } else {
                    props.forEach(function(prop) {
                        if (post.hasOwnProperty(prop)) {
                            act[prop] = [];
                            post[prop].forEach(function(addr) {
                                if (addr.id !== act.actor.id) {
                                    act[prop].push(addr);
                                }
                            });
                        }
                    });
                    if (!act.to) {
                        act.to = [];
                    }
                    act.to.push(post.actor);
                    callback(null);
                }
            }
        );
    } else if (act.actor && act.actor.objectType == ActivityObject.PERSON) {
        // Default is to user's followers
        setToFollowers(act, callback);
    } else {
        callback(new Error("Can't ensure recipients."));
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
        props._uuid = IDMaker.makeID();
        props.id   = ActivityObject.makeURI("activity", props._uuid);
        if (!_(props).has('links')) {
            props.links = {};
        }
        props.links.self = {
            href: URLMaker.makeURL("api/activity/" + props._uuid)
        };

        if (_.has(props, "author") &&
            _.isObject(props.author) &&
            _.has(props.author, "preferredUsername") &&
            _.isString(props.author.preferredUsername)) {
            props.url  = URLMaker.makeURL(props.actor.preferredUsername + "/activity/" + props._uuid);
        }

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

    if (!props.content) {
        props.content = Activity.makeContent(props);
    }

    // This can be omitted

    if (props.location && !props.location.objectType) {
        props.location.objectType = ActivityObject.PLACE;
    }

    Step(
        function() {
            var group = this.group();
            _.each(oprops, function(prop) {
                ActivityObject.compressProperty(props, prop, group());
            });
            _.each(aprops, function(prop) {
                ActivityObject.compressArray(props, prop, group());
            });
        },
        function(err) {
            if (err) throw err;
            try {
                Activity.validate(props);
                this(null);
            } catch (e) {
                this(e);
            }
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

// XXX: i18n, real real bad

Activity.makeContent = function(props) {

    var content,
        nameOf = function(obj) {
            if (_.has(obj, "displayName")) {
                return obj.displayName;
            } else if (!_.has(obj, "objectType")) {
                return "an object";
            } else if (['a', 'e', 'i', 'o', 'u'].indexOf(obj.objectType[0]) !== -1) {
                return "an " + obj.objectType;
            } else {
                return "a " + obj.objectType;
            }
        },
        reprOf = function(obj) {
            var name = nameOf(obj);
            if (_.has(obj, "url")) {
                return "<a href='"+obj.url+"'>"+name+"</a>";
            } else {
                return name;
            }
        },
        pastOf = function(verb) {
            var last = verb[verb.length - 1],
                irreg = {"at": "was at",
                         "build": "built",
                         "checkin": "checked into",
                         "find": "found",
                         "give": "gave",
                         "leave": "left",
                         "lose": "lost",
                         "make-friend": "made a friend of",
                         "play": "played",
                         "read": "read",
                         "remove-friend": "removed as a friend",
                         "rsvp-maybe": "may attend",
                         "rsvp-no": "will not attend",
                         "rsvp-yes": "will attend",
                         "sell": "sold",
                         "send": "sent",
                         "stop-following": "stopped following",
                         "submit": "submitted",
                         "tag": "tagged",
                         "win": "won"};

            if (_.has(irreg, verb)) {
                return irreg[verb];
            }

            switch (last) {
            case 'y':
                return verb.substr(0, verb.length - 1) + "ied";
                break;
            case 'e':
                return verb + "d";
            default:
                return verb + "ed";
            }
        };

    content = reprOf(props.actor) + " " + pastOf(props.verb || "post") + " " + reprOf(props.object);

    if (_.has(props.object, "inReplyTo")) {
        content = content + " in reply to " + reprOf(props.object.inReplyTo);
    }

    if (_.has(props.object, "target")) {
        content = content + " to " + reprOf(props.target);
    }

    return content;
};

Activity.prototype.beforeUpdate = function(props, callback) {

    var now = Stamper.stamp();

    props.updated = now;

    Step(
        function() {
            var group = this.group();
            _.each(oprops, function(prop) {
                ActivityObject.compressProperty(props, prop, group());
            });
            _.each(aprops, function(prop) {
                ActivityObject.compressArray(props, prop, group());
            });
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

    if (!act.id) {
        act._uuid = IDMaker.makeID();
        act.id   = ActivityObject.makeURI("activity", act._uuid);
        if (!_(act).has('links')) {
            act.links = {};
        }
        act.links.self = {
            href: URLMaker.makeURL("api/activity/" + act._uuid)
        };
        // FIXME: assumes person data was set and that it's a local actor
        act.url  = URLMaker.makeURL(act.actor.preferredUsername + "/activity/" + act._uuid);

        if (!act.published) {
            act.published = now;
        }
    }

    if (!act.actor) {
        callback(new Error("Activity has no actor"));
        return;
    }

    if (!act.object) {
        callback(new Error("Activity has no object"));
        return;
    }

    if (!act.content) {
        act.content = Activity.makeContent(act);
    }

    Step(
        function() {
            var group = this.group();
            _.each(oprops, function(prop) {
                ActivityObject.compressProperty(act, prop, group());
            });
            _.each(aprops, function(prop) {
                ActivityObject.compressArray(act, prop, group());
            });
        },
        function(err) {
            if (err) throw err;
            try {
                Activity.validate(act);
                this(null);
            } catch (e) {
                this(e);
            }
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

Activity.prototype.toString = function() {
    var act = this;

    if (!_.has(act, "verb")) {
        return "[activity]";
    } else if (!_.has(act, "id")) {
        return "["+act.verb+" activity]";
    } else {
        return "["+act.verb+" activity "+act.id+"]";
    }
};

// When get()'ing an activity, also get the actor and the object,
// which are saved by reference

Activity.prototype.afterCreate =
    Activity.prototype.afterSave =
    Activity.prototype.afterUpdate = function(callback) {
        this.expand(callback);
    };

// After getting, we check for old style or behaviour

Activity.prototype.afterGet = function(callback) {

    var act = this;

    Step(
        function() {
            var Upgrader = require("../upgrader");
            Upgrader.upgradeActivity(act, this);
        },
        function(err) {
            if (err) throw err;
            act.expand(this);
        },
        callback
    );
};

Activity.prototype.expand = function(callback) {
    var act = this;

    Step(
        function() {
            var group = this.group();
            _.each(oprops, function(prop) {
                ActivityObject.expandProperty(act, prop, group());
            });
            _.each(aprops, function(prop) {
                ActivityObject.expandArray(act, prop, group());
            });
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
            var group = this.group();
            _.each(oprops, function(prop) {
                ActivityObject.compressProperty(act, prop, group());
            });
            _.each(aprops, function(prop) {
                ActivityObject.compressArray(act, prop, group());
            });
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

    var keepers = ["actor", "object", "_uuid", "id", "published", "deleted", "updated"],
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

// Sanitize for going out over the wire

Activity.prototype.sanitize = function(principal) {

    var act = this,
        i,
        j;

    // Remove bcc and bto for non-user

    if (!principal || (principal.id !== this.actor.id)) {
        if (this.bcc) {
            delete this.bcc;
        }
        if (this.bto) {
            delete this.bto;
        }
    }

    // Remove properties with initial underscore

    _.each(act, function(value, key) {
        if (key[0] == '_') {
            delete act[key];
        }
    });

    // Sanitize object properties

    _.each(oprops, function(prop) {
        if (_.isObject(act[prop]) && _.isFunction(act[prop].sanitize)) {
            act[prop].sanitize();
        }
    });

    // Sanitize array properties

    _.each(aprops, function(prop) {
        if (_.isArray(act[prop])) {
            _.each(act[prop], function(item) {
                if (_.isObject(item) && _.isFunction(item.sanitize)) {
                    item.sanitize();
                }
            });
        }
    });

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
        addrProps = ["to", "cc", "bto", "bcc", "_received"],
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
                            if (err.name == "NotInStreamError") {
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
        isInGroups = function(person, callback) {
            var isInGroup = function(group, callback) {
                Step(
                    function() {
                        var Membership = require("./membership").Membership;
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
            Step(
                function() {
                    var i,
                        group = this.group(),
                        groups = recipientsOfType(ActivityObject.GROUP);
                    for (i = 0; i < groups.length; i++) {
                        isInGroup(groups[i], group());
                    }
                },
                function(err, inGroups) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, inGroups.some(function(b) { return b; }));
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
                    if (err && err.name == "NoSuchThingError") {
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

    // Always OK for author to view their own activity

    if (_.has(act, "actor") && person.id == act.actor.id) {
        return callback(null, true);
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
            isInGroups(person, this.parallel());
        },
        function(err, inlists, infollowers, ingroups) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, inlists || infollowers || ingroups);
            }
        }
    );
};

Activity.prototype.isMajor = function() {
    var alwaysVerbs = [Activity.SHARE, Activity.CHECKIN];
    var exceptVerbs = {};

    if (alwaysVerbs.indexOf(this.verb) !== -1) {
        return true;
    }

    exceptVerbs[Activity.POST] = [ActivityObject.COMMENT,
                                  ActivityObject.COLLECTION];

    exceptVerbs[Activity.CREATE] = [ActivityObject.COMMENT,
                                    ActivityObject.COLLECTION];

    if (exceptVerbs.hasOwnProperty(this.verb) &&
        exceptVerbs[this.verb].indexOf(this.object.objectType) == -1) {
        return true;
    }

    return false;
};

// XXX: we should probably just cache this somewhere

Activity.postOf = function(activityObject, callback) {

    var verbSearch = function(verb, object, cb) {
        Step(
            function() {
                Activity.search({verb: verb, "object.id": object.id}, this);
            },
            function(err, acts) {
                var matched;
                if (err) {
                    cb(err, null);
                } else if (acts.length === 0) {
                    cb(null, null);
                } else {
                    // get first author match
                    var act = _.find(acts, function(act) {
                        return (act.actor && object.author && act.actor.id == object.author.id);
                    });

                    cb(null, act);
                }
            }
        );
    };

    Step(
        function() {
            verbSearch(Activity.POST, activityObject, this);
        },
        function(err, act) {
            if (err) throw err;
            if (act) {
                callback(null, act);
            } else {
                verbSearch(Activity.CREATE, activityObject, this);
            }
        },
        function(err, act) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, act);
            }
        }
    );
};

Activity.prototype.addReceived = function(receiver, callback) {

    var act = this;

    if (!_.has(act, "_received")) {
        act._received = [];
    }

    act._received.push({id: receiver.id, objectType: receiver.objectType});

    Step(
        function() {
            act.save(this);
        },
        function(err, updated) {
            callback(err);
        }
    );
};

Activity.prototype.fire = function(callback) {

    var activity = this,
        User = require("./user").User,
        Distributor = require("../distributor");

    Step(
        function() {
            // First, ensure recipients
            activity.ensureRecipients(this);
        },
        function(err) {
            if (err) throw err;
            activity.apply(null, this);
        },
        function(err) {
            if (err) throw err;
            // ...then persist...
            activity.save(this);
        },
        function(err, saved) {
            if (err) throw err;
            activity = saved;
            User.fromPerson(activity.actor.id, this);
        },
        function(err, user) {
            if (err) throw err;
            if (!user) {
                this(null);
            } else {
                user.addToOutbox(activity, this.parallel());
                user.addToInbox(activity, this.parallel());
            }
        },
        function(err) {
            var d;
            if (err) throw err;
            d = new Distributor(activity);
            d.distribute(this);
        },
        callback
    );
};

Activity.validate = function(props) {

    _.each(oprops, function(name) {
        if (_.has(props, name)) {
            if (!_.isObject(props[name])) {
                throw new TypeError(name + " property is not an object.");
            } else {
                try {
                    ActivityObject.validate(props[name]);
                } catch (err) {
                    // rethrow an error with more data
                    throw new TypeError(name + ": " + err.message);
                }
            }
        }
    });

    _.each(aprops, function(name) {
        if (_.has(props, name)) {
            if (!_.isArray(props[name])) {
                throw new TypeError(name + " property is not an object.");
            } else {
                _.each(props[name], function(item, i) {
                    try {
                        ActivityObject.validate(item);
                    } catch (err) {
                        // rethrow an error with more data
                        throw new TypeError(name + "[" + i + "]: " + err.message);
                    }
                });
            }
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
