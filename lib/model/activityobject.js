// activityobject.js
//
// utility superclass for activity stuff
//
// Copyright 2012, StatusNet Inc.
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
    _ = require("underscore"),
    Step = require("step"),
    NoSuchThingError = databank.NoSuchThingError,
    AlreadyExistsError = databank.AlreadyExistsError,
    DatabankObject = databank.DatabankObject,
    uuid = require("node-uuid"),
    URLMaker = require("../urlmaker").URLMaker,
    IDMaker = require("../idmaker").IDMaker,
    Stamper = require("../stamper").Stamper,
    Stream = require("./stream").Stream;

var UnknownTypeError = function(type) {
    Error.captureStackTrace(this, UnknownTypeError);
    this.name = "UnknownTypeError";
    this.type = type;
    this.message = "Unknown type: " + type;
};

UnknownTypeError.prototype = new Error();
UnknownTypeError.prototype.constructor = UnknownTypeError;

var ActivityObject = function(properties) {
    ActivityObject.init(this, properties);
};

ActivityObject.init = DatabankObject.init;

ActivityObject.prototype = new DatabankObject({});

ActivityObject.beforeCreate = function(props, callback) {

    if (!_.has(props, "objectType")) {
        props.objectType = this.type;
    }

    var now = Stamper.stamp();

    props.published = props.updated = now;

    if (!_(props).has("id")) {
        props.uuid = IDMaker.makeID();
        props.id   = ActivityObject.makeURI(this.type, props.uuid);

        if (!_.has(props, "links")) {
            props.links = {};
        }

        props.links.self = {
            href: URLMaker.makeURL("api/" + this.type + "/" + props.uuid)
        };

        props.likes = {
            url: URLMaker.makeURL("api/" + this.type + "/" + props.uuid + "/likes")
        };

        props.replies = {
            url: URLMaker.makeURL("api/" + this.type + "/" + props.uuid + "/replies")
        };

    } else {
        // For non-new stuff, clear out volatile data
        ActivityObject.trimCollection(props, "likes");
        ActivityObject.trimCollection(props, "replies");
        if (_(props).has("replies")) {
            if (_(props.replies).isObject()) {
                delete props.replies.totalItems;
                delete props.replies.items;
            } else {
                delete props.replies;
            }
        }
    }

    Step(
        function() {
            // Save the author by reference; don't save the whole thing
            ActivityObject.compressProperty(props, "author", this.parallel());
            ActivityObject.compressProperty(props, "inReplyTo", this.parallel());
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

ActivityObject.prototype.afterUpdate = 
ActivityObject.prototype.afterSave = function(callback) {
    this.expand(callback);
};

ActivityObject.prototype.afterGet = function(callback) {
    if (this.inReplyTo) {
        this.inReplyTo = ActivityObject.toObject(this.inReplyTo);
    }
    this.expand(callback);
};

ActivityObject.prototype.afterCreate = function(callback) {
    var obj = this;

    Step(
        function() {
            var name = "activityobject:replies:"+obj.id;
            Stream.create({name: name}, this);
        },
        function(err, stream) {
            obj.expand(this);
        },
        function(err) {
            if (err) throw err;
            if (!_(obj).has("inReplyTo") || !_(obj.inReplyTo).isObject()) {
                callback(null);
            } else {
                ActivityObject.ensureObject(obj.inReplyTo, this);
            }
        },
        function(err, irt) {
            if (err) throw err;
            irt.getRepliesStream(this);
        },
        function(err, replies) {
            var compressed;
            if (err) throw err;
            compressed = {id: obj.id,
                          objectType: obj.objectType};
            replies.deliverObject(compressed, this);
        },
        callback
    );
};

ActivityObject.prototype.afterDel =
ActivityObject.prototype.afterEfface = function(callback) {
    var obj = this;

    Step(
        function() {
            if (!_(obj).has("inReplyTo") || !_(obj.inReplyTo).isObject()) {
                callback(null);
            } else {
                ActivityObject.ensureObject(obj.inReplyTo, this);
            }
        },
        function(err, irt) {
            if (err) throw err;
            irt.getRepliesStream(this);
        },
        function(err, replies) {
            var compressed;
            if (err) throw err;
            compressed = {id: obj.id,
                          objectType: obj.objectType};
            replies.removeObject(compressed, this);
        },
        callback
    );
};

ActivityObject.prototype.expand = function(callback) {
    ActivityObject.expandProperty(this, "author", callback);
};

ActivityObject.prototype.beforeSave = function(callback) {

    var obj = this, 
        now = Stamper.stamp();

    this.updated = now;

    ActivityObject.trimCollection(this, "likes");
    ActivityObject.trimCollection(this, "replies");

    // Save the author by reference; don't save the whole thing

    Step(
        function() {
            // Save the author by reference; don't save the whole thing
            ActivityObject.compressProperty(obj, "author", this);
        },
        function(err) {
            if (err) throw err;
            ActivityObject.compressProperty(obj, "inReplyTo", this);
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, obj);
            }
        }
    );
};

ActivityObject.prototype.beforeUpdate = function(props, callback) {

    var immutable = ["id", "objectType", "uuid", "published"],
        i, prop;

    for (i = 0; i < immutable.length; i++) {
        prop = immutable[i];
        if (props.hasOwnProperty(prop)) {
            delete props[prop];
        }
    }

    ActivityObject.trimCollection(props, "likes");
    ActivityObject.trimCollection(props, "replies");

    var now = Stamper.stamp();

    props.updated = now;

    Step(
        function() {
            // Save the author by reference; don't save the whole thing
            ActivityObject.compressProperty(props, "author", this);
        },
        function(err) {
            if (err) throw err;
            ActivityObject.compressProperty(props, "inReplyTo", this);
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

// For now, we make HTTP URIs. Maybe someday we'll
// do something else. I like HTTP URIs, though.

ActivityObject.makeURI = function(type, uuid) {
    return URLMaker.makeURL("api/" + type + "/" + uuid);
};

ActivityObject.toClass = function(type) {
    var module, className;

    if (!type ||
        ActivityObject.objectTypes.indexOf(type.toLowerCase()) == -1) {
        return require("./other").Other;
    }
        
    module = require("./" + type);
    className = type.substring(0,1).toUpperCase() + type.substring(1, type.length).toLowerCase();
    return module[className];
};

ActivityObject.toObject = function(props, defaultType) {
    var Cls, type; 

    // Try rational fallbacks
    type = props.objectType || defaultType || ActivityObject.NOTE;

    Cls = ActivityObject.toClass(type);
    return new Cls(props);
};

ActivityObject.getObject = function(type, id, callback) {
    var Cls;
    Cls = ActivityObject.toClass(type);
    Cls.get(id, callback);
};

ActivityObject.createObject = function(obj, callback) {
    var Cls, type = obj.objectType;
    Cls = ActivityObject.toClass(type);
    Cls.create(obj, callback);
};

ActivityObject.ensureObject = function(obj, callback) {
    var Cls,
        type = obj.objectType,
        id = obj.id;
    Cls = ActivityObject.toClass(type);
    Cls.create(obj, function(err, result) {
        if (err) {
            if (err.name == "AlreadyExistsError") {
                Cls.get(id, callback);
            } else {
                callback(err, null);
            }
        } else {
            callback(null, result);
        }
    });
};

ActivityObject.compressProperty = function(obj, name, callback) {
    // Easy enough!
    if (!_(obj).has(name)) {
        callback(null);
        return;
    }

    if (!_.isObject(obj[name])) {
        callback(new Error("Not an object"));
        return;
    }

    Step(
        function() {
            ActivityObject.ensureObject(obj[name], this);
        },
        function(err, sub) {
            var Cls;
            if (err) {
                callback(err);
            } else {
                Cls = ActivityObject.toClass(sub.objectType);
                if (!Cls) {
                    callback(new UnknownTypeError(sub.objectType));
                } else {
                    obj[name] = new Cls({id: sub.id,
                                         objectType: sub.objectType});
                    callback(null);
                }
            }
        }
    );
};

ActivityObject.compressArray = function(obj, name, callback) {

    // Easy enough!

    if (!_(obj).has(name)) {
        callback(null);
        return;
    }

    if (!_(obj[name]).isArray()) {
        callback(new Error("Property '" + name + "' of object '" + obj.id + "' is not an array"));
        return;
    }

    Step(
        function() {
            var i, group = this.group();
            for (i = 0; i < obj[name].length; i++) {
                ActivityObject.ensureObject(obj[name][i], group());
            }
        },
        function(err, subs) {
            var Cls;
            if (err) {
                callback(err);
            } else {
                obj[name] = new Array(subs.length);
                for (i = 0; i < subs.length; i++) {
                    Cls = ActivityObject.toClass(subs[i].objectType);
                    if (!Cls) {
                        callback(new UnknownTypeError(subs[i].objectType));
                        return;
                    } else {
                        obj[name][i] = new Cls({id: subs[i].id,
                                                objectType: subs[i].objectType});
                    }
                }
                callback(null);
            }
        }
    );
};

ActivityObject.expandProperty = function(obj, name, callback) {
    // Easy enough!

    if (!_(obj).has(name)) {
        callback(null);
        return;
    }

    if (!_.isObject(obj[name])) {
        callback(new Error("Not an object"));
        return;
    }

    Step(
        function() {
            ActivityObject.ensureObject(obj[name], this);
        },
        function(err, sub) {
            if (err) {
                callback(err);
            } else {
                obj[name] = sub;
                callback(null);
            }
        }
    );
};

ActivityObject.expandArray = function(obj, name, callback) {

    // Easy enough!

    if (!_(obj).has(name)) {
        callback(null);
        return;
    }

    if (!_(obj[name]).isArray()) {
        callback(new Error("Property '" + name + "' of object '" + obj.id + "' is not an array"));
        return;
    }

    Step(
        function() {
            var i, group = this.group();
            for (i = 0; i < obj[name].length; i++) {
                ActivityObject.ensureObject(obj[name][i], group());
            }
        },
        function(err, subs) {
            var Cls;
            if (err) {
                callback(err);
            } else {
                obj[name] = subs;
                callback(null);
            }
        }
    );
};

ActivityObject.prototype.favoritedBy = function(id, callback) {
    var obj = this,
        name = "favoriters:"+obj.id;
    Step(
        function() {
            Stream.get(name, this);
        },
        function(err, stream) {
            if (err && err.name == "NoSuchThingError") {
                Stream.create({name: name}, this);
            } else if (err) {
                throw err;
            } else {
                this(null, stream);
            }
        },
        function(err, stream) {
            if (err) throw err;
            stream.deliver(id, this);
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

ActivityObject.prototype.unfavoritedBy = function(id, callback) {
    var obj = this,
        name = "favoriters:"+obj.id;
    Step(
        function() {
            Stream.get(name, this);
        },
        function(err, stream) {
            if (err && err.name == "NoSuchThingError") {
                Stream.create({name: name}, this);
            } else if (err) {
                throw err;
            } else {
                this(null, stream);
            }
        },
        function(err, stream) {
            if (err) throw err;
            stream.remove(id, this);
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

ActivityObject.getObjectStream = function(className, streamName, start, end, callback) {

    var ids,
        Cls = ActivityObject.toClass(className);

    Step(
        function() {
            Stream.get(streamName, this);
        },
        function(err, stream) {
            if (err) throw err;
            stream.getIDs(start, end, this);
        },
        function(err, results) {
            if (err) throw err;
            ids = results;
            if (ids.length === 0) {
                callback(null, []);
            } else {
                Cls.readAll(ids, this);
            }
        },
        function(err, map) {
            var i, objects = [];
            if (err) {
                if (err.name == "NoSuchThingError") {
                    callback(null, []);
                } else {
                    callback(err, null);
                }
            } else {
                objects = new Array(ids.length);
                // Try to get it in the right order
                for (i = 0; i < ids.length; i++) {
                    objects[i] = map[ids[i]];
                }
                callback(null, objects);
            }
        }
    );
};

ActivityObject.prototype.getFavoriters = function(start, end, callback) {
    ActivityObject.getObjectStream("person", "favoriters:"+this.id, start, end, callback);
};

ActivityObject.prototype.favoritersCount = function(callback) {
    Stream.count("favoriters:"+this.id, function(err, count) {
        if (err && err.name == "NoSuchThingError") {
            callback(null, 0);
        } else if (err) {
            callback(err, null);
        } else {
            callback(null, count); 
        }
    });
};

ActivityObject.prototype.expandFeeds = function(callback) {
    var obj = this;
    Step(
        function() {
            obj.repliesCount(this.parallel());
            obj.favoritersCount(this.parallel());
            obj.getReplies(0, 4, this.parallel());
        },
        function(err, repliesCount, favoritersCount, replies) {
            if (err) {
                callback(err);
            } else {
                if (obj.replies) {
                    obj.replies.totalItems = repliesCount;
                    if (replies && replies.length > 0) {
                        obj.replies.items = replies;
                    }
                }
                if (obj.likes) {
                    obj.likes.totalItems = favoritersCount;
                }
                callback(null);
            }
        }
    );
};

ActivityObject.prototype.getRepliesStream = function(callback) {

    var obj = this,
        name = "activityobject:replies:"+obj.id;

    Stream.get(name, callback);
};

ActivityObject.prototype.getReplies = function(start, end, callback) {

    var obj = this,
        full = [];

    Step(
        function() {
            obj.getRepliesStream(this);
        },
        function(err, stream) {
            if (err) throw err;
            stream.getObjects(start, end, this);
        },
        function(err, compressed) {
            var i, group = this.group();
            if (err) throw err;
            for (i = 0; i < compressed.length; i++) {
                ActivityObject.ensureObject(compressed[i], group());
            }
        },
        function(err, results) {
            var i, group = this.group();
            if (err) throw err;
            full = results;
            for (i = 0; i < full.length; i++) {
                full[i].expandFeeds(group());
            }
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, full);
            }
        }
    );
};

ActivityObject.prototype.repliesCount = function(callback) {
    var name = "activityobject:replies:"+this.id;
    Stream.count(name, function(err, count) {
        if (err && err.name == "NoSuchThingError") {
            callback(null, 0);
        } else if (err) {
            callback(err, null);
        } else {
            callback(null, count); 
        }
    });
};

ActivityObject.prototype.keepers = function() {
    return ["id", "objectType", "author", "published", "updated", "uuid", "inReplyTo"];
};

// Default hooks for efface()

ActivityObject.prototype.beforeEfface = function(callback) {
    callback(null);
};

ActivityObject.prototype.efface = function(callback) {
    
    var keepers = this.keepers(),
        prop,
        obj = this;
    
    Step(
        function() {
            obj.beforeEfface(this);
        },
        function(err) {
            if (err) throw err;

            for (prop in obj) {
                if (obj.hasOwnProperty(prop) && keepers.indexOf(prop) === -1) {
                    delete obj[prop];
                }
            }

            var now = Stamper.stamp();

            obj.deleted = obj.updated = now;

            obj.save(this);
        },
        function(err) {
            obj.afterEfface(this);
        },
        callback
    );
};

ActivityObject.canonicalID = function(id) {
    if (id.indexOf("@") !== -1 && id.substr(0, 5) != "acct:") {
        return "acct:" + id;
    }
    return id;
};

ActivityObject.sameID = function(id1, id2) {
    return ActivityObject.canonicalID(id1) == ActivityObject.canonicalID(id2);
};

ActivityObject.prototype.sanitize = function() {
    delete this.uuid;
    if (this.inReplyTo && this.inReplyTo.sanitize) {
        this.inReplyTo.sanitize();
    }
    if (this.author && this.author.sanitize) {
        this.author.sanitize();
    }
    return;
};

ActivityObject.trimCollection = function(obj, prop) {
    if (_(obj).has(prop)) {
        if (_(obj[prop]).isObject()) {
            delete obj[prop].totalItems;
            delete obj[prop].items;
        } else {
            delete obj[prop];
        }
    }
};

ActivityObject.objectTypes = ["alert",
                              "application",
                              "article",
                              "audio",
                              "badge",
                              "binary",
                              "bookmark",
                              "collection",
                              "comment",
                              "device",
                              "event",
                              "file",
                              "game",
                              "group",
                              "image",
                              "issue",
                              "job",
                              "note",
                              "offer",
                              "organization",
                              "page",
                              "person",
                              "place",
                              "process",
                              "product",
                              "question",
                              "review",
                              "service",
                              "task",
                              "video"];

var objectType, i;

// Constants-like members for activity object types

for (i = 0; i < ActivityObject.objectTypes.length; i++) {
    objectType = ActivityObject.objectTypes[i];
    ActivityObject[objectType.toUpperCase().replace("-", "_")] = objectType;
}

ActivityObject.baseSchema = {
    pkey: "id",
    fields: ["attachments",
             "author",
             "content",
             "displayName",
             "downstreamDuplicates",
             "id",
             "image",
             "objectType",
             "published",
             "summary",
             "updated",
             "upstreamDuplicates",
             "url",
             "uuid"
    ],
    indices: ["uuid"]
};

exports.ActivityObject = ActivityObject;
exports.UnknownTypeError = UnknownTypeError;
