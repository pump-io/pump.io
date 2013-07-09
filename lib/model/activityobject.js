// activityobject.js
//
// utility superclass for activity stuff
//
// Copyright 2012, E14N https://e14n.com/
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
    _ = require("underscore-contrib"),
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

    var type = this.type;

    if (!_.has(props, "objectType")) {
        props.objectType = type;
    }

    var now = Stamper.stamp();

    // Keep a timestamp for when we created something

    props._created = now;

    Step(
        function() {
            var User = require("./user").User;
            if (!_(props).getPath(["links", "self", "href"])) {

                props._uuid = IDMaker.makeID();

                if (!props.id) {
                    props.id = ActivityObject.makeURI(type, props._uuid);
                }

                if (!props.published) {
                    props.published = now;
                }

                if (!props.updated) {
                    props.updated = now;
                }

                if (!_.has(props, "links")) {
                    props.links = {};
                }

                props.links.self = {
                    href: URLMaker.makeURL("api/" + type + "/" + props._uuid)
                };

                _.each(["likes", "replies", "shares"], function(feed) {

                    if (!_.has(props, feed)) {
                        props[feed] = {
                            url: URLMaker.makeURL("api/" + type + "/" + props._uuid + "/" + feed)
                        };
                    }
                });

                if (!_.has(props, "url") && 
                    _.has(props, "author") &&
                    _.isObject(props.author)) {
                    if (_.has(props.author, "preferredUsername") &&
                        _.isString(props.author.preferredUsername)) {
                        props.url = URLMaker.makeURL([props.author.preferredUsername, type, props._uuid].join("/"));
                        this(null, null);
                    } else {
                        User.fromPerson(props.author.id, this);
                    }
                } else {
                    this(null, null);
                }

            } else {
                _.each(["likes", "replies", "shares"], function(feed) {
                    // For non-new stuff, clear out volatile data
                    ActivityObject.trimCollection(props, feed);
                });
                this(null, null);
            }
        },
        function(err, user) {
            if (err) throw err;
            if (user) {
                props.url = URLMaker.makeURL([user.nickname, type, props._uuid].join("/"));
            }
            // Save the author by reference; don't save the whole thing
            ActivityObject.compressProperty(props, "author", this.parallel());
            ActivityObject.compressProperty(props, "inReplyTo", this.parallel());
        },
        function(err) {
            if (err) throw err;
            ActivityObject.validate(props);
            this(null);
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
    var obj = this;
    if (obj.inReplyTo) {
        obj.inReplyTo = ActivityObject.toObject(obj.inReplyTo);
    }
    this.expand(callback);
};

ActivityObject.prototype.afterCreate = function(callback) {
    var obj = this;

    Step(
        function() {
            Stream.create({name: "activityobject:replies:"+obj.id}, this.parallel());
            Stream.create({name: "activityobject:shares:"+obj.id}, this.parallel());
        },
        function(err, replies, shares) {
            if (err) throw err;
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
                ActivityObject.getObject(obj.inReplyTo.objectType, obj.inReplyTo.id, this);
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
    ActivityObject.trimCollection(this, "shares");

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

    var immutable = ["id", "objectType", "_uuid", "published"],
        i, prop;

    for (i = 0; i < immutable.length; i++) {
        prop = immutable[i];
        if (props.hasOwnProperty(prop)) {
            delete props[prop];
        }
    }

    ActivityObject.trimCollection(props, "likes");
    ActivityObject.trimCollection(props, "replies");
    ActivityObject.trimCollection(props, "shares");

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

    var type = obj.objectType,
        Cls,
        id = obj.id,
        url = obj.url,
        tryCreate = function(obj, cb) {
            Step(
                function() {
                    Cls.create(obj, this);
                },
                function(err, result) {
                    if (err && err.name == "AlreadyExistsError") {
                        ActivityObject.ensureObject(obj, cb);                        
                    } else if (err) {
                        cb(err, null);
                    } else {
                        cb(null, result);
                    }
                }
            );
        },
        softGet = function(Cls, id, cb) {
            Step(
                function() {
                    Cls.get(id, this);
                },
                function(err, result) {
                    if (err && err.name == "NoSuchThingError") {
                        cb(null, null);
                    } else if (!err) {
                        cb(null, result);
                    } else {
                        cb(err, null);
                    }
                }
            );
        },
        findOne = function(Cls, criteria, cb) {
            Step(
                function() {
                    Cls.search(criteria, this);
                },
                function(err, results) {
                    if (err) throw err;
                    if (!results || results.length == 0) {
                        cb(null, null);
                    } else {
                        cb(null, results[0]);
                    }
                }
            );
        };
    
    // Since this is a major entry point, check our arguments

    if (!_.isString(id) && !_.isUndefined(id)) {
        callback(new TypeError("ID is not a string: " + id), null);
        return;
    }

    if (!_.isString(url) && !_.isUndefined(url)) {
        callback(new TypeError("URL is not a string: " + url), null);
        return;
    }

    if (!_.isString(type)) {
        callback(new TypeError("Type is not a string: " + type), null);
        return;
    }

    Cls = ActivityObject.toClass(type);

    Step(
        function() {
            if (_.isString(id)) {
                softGet(Cls, id, this);
            } else if (_.isString(url)) {
                // XXX: we could use other fields here to guide search
                findOne(Cls, {url: url}, this);
            } else {
                // XXX: without a unique identifier, just punt
                this(null, null);
            }
        },
        function(err, result) {
            var delta;
            if (err) throw err;
            if (!result) {
                tryCreate(obj, callback);
            } else if (!ActivityObject.isReference(obj) &&
                       (ActivityObject.isReference(result) || obj.updated > result.updated)) {
                delta = ActivityObject.delta(result, obj);
                result.update(delta, callback);
            } else {
                callback(null, result);
            }
        }
    );
};

ActivityObject.isReference = function(value) {
    var refKeys = ["id", "objectType", "updated", "published", "_uuid", "_created", "links"],
        nonRef = _.difference(_.keys(value), refKeys);

    return (nonRef.length === 0);
};

ActivityObject.delta = function(current, proposed) {
    var dupe = _.clone(proposed);

    _.each(dupe, function(value, key) {
        // XXX: accept updates of object data
        if (_.isObject(value) && _.isEqual(current[key], value)) {
            delete dupe[key];
        } else if (current[key] == value) {
            delete dupe[key];
        }
    });

    return dupe;
};

ActivityObject.compressProperty = function(obj, name, callback) {
    // Easy enough!
    if (!_(obj).has(name)) {
        callback(null);
        return;
    }

    if (!_.isObject(obj[name])) {
        callback(new TypeError(name + " property of " + obj + " is not an object"));
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
    
    var ref;

    // Easy enough!

    if (!_(obj).has(name)) {
        callback(null);
        return;
    }
    
    ref = obj[name];

    if (!_.isObject(ref)) {
        callback(new Error(obj.toString() + ": " + name + " property is not an object"));
        return;
    }

    if (!_.isString(ref.id)) {
        callback(new Error(obj.toString() + ": " + name + " property has no unique identifier"));
        return;
    }

    if (!_.isString(ref.objectType)) {
        callback(new Error(obj.toString() + ": " + name + " property has no object type"));
        return;
    }

    Step(
        function() {
            ActivityObject.getObject(ref.objectType, ref.id, this);
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
                ActivityObject.getObject(obj[name][i].objectType, obj[name][i].id, group());
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
    var obj = this;

    Step(
        function() {
            obj.getFavoritersStream(this);
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
    var obj = this;
    Step(
        function() {
            obj.getFavoritersStream(this);
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

ActivityObject.prototype.getFavoritersStream = function(callback) {

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
        callback
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
            obj.sharesCount(this.parallel());
        },
        function(err, repliesCount, favoritersCount, sharesCount) {
            if (err) {
                callback(err);
            } else {
                if (obj.replies) {
                    obj.replies.totalItems = repliesCount;
                }
                if (obj.likes) {
                    obj.likes.totalItems = favoritersCount;
                }
                if (obj.shares) {
                    obj.shares.totalItems = sharesCount;
                }
                callback(null);
            }
        }
    );
};

ActivityObject.prototype.getSharesStream = function(callback) {

    var obj = this,
        name = "activityobject:shares:"+obj.id;

    Stream.get(name, callback);
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
                ActivityObject.getObject(compressed[i].objectType, compressed[i].id, group());
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

ActivityObject.prototype.sharesCount = function(callback) {
    var obj = this;
        
    Step(
        function() {
            obj.getSharesStream(this);
        },
        function(err, str) {
            if (err) throw err;
            str.count(this);
        },
        callback
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
    return ["id", "objectType", "author", "published", "updated", "_uuid", "inReplyTo"];
};

// Default hooks for efface()

ActivityObject.prototype.beforeEfface = function(callback) {
    callback(null);
};

ActivityObject.prototype.efface = function(callback) {
    
    var keepers = this.keepers(),
        obj = this;
    
    Step(
        function() {
            obj.beforeEfface(this);
        },
        function(err) {
            if (err) throw err;

            _.each(obj, function(value, key) {
                if (!_.contains(keepers, key)) {
                    delete obj[key];
                }
            });

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

// Clean up stuff that shouldn't go through to the outside world.
// By convention, we start these properties with a "_".

ActivityObject.prototype.sanitize = function() {

    var obj = this,
        objects = ['author',
                   'location',
                   'inReplyTo'],
        arrays = ['attachments',
                  'tags'];

    // Sanitize stuff starting with _

    _.each(obj, function(value, key) {
        if (key[0] == '_') {
            delete obj[key];
        }
    });

    // Sanitize object properties

    _.each(objects, function(prop) {
        if (_.isObject(obj[prop]) && _.isFunction(obj[prop].sanitize)) {
            obj[prop].sanitize();
        }
    });

    // Sanitize array properties

    _.each(arrays, function(prop) {
        if (_.isArray(obj[prop])) {
            _.each(obj[prop], function(item) {
                if (_.isObject(item) && _.isFunction(item.sanitize)) {
                    item.sanitize();
                }
            });
        }
    });

    return;
};

ActivityObject.trimCollection = function(obj, prop) {
    if (_(obj).has(prop)) {
        if (_(obj[prop]).isObject()) {
            delete obj[prop].totalItems;
            delete obj[prop].items;
            delete obj[prop].pump_io;
        } else {
            delete obj[prop];
        }
    }
};

ActivityObject.prototype.isFollowable = function() {
    var obj = this,
        followableTypes = [ActivityObject.PERSON];

    if (_.contains(followableTypes, obj.objectType)) {
        return true;
    } else if (_.has(obj, "links") &&
               _.has(obj.links, "activity-outbox")) {
        return true;
    } else {
        return false;
    }
};

ActivityObject.prototype.toString = function() {
    var obj = this;

    if (!_.has(obj, "objectType")) {
        return "[activityobject]";
    } else if (!_.has(obj, "id")) {
        return "["+obj.objectType+"]";
    } else {
        return "["+obj.objectType+" "+obj.id+"]";
    }
};

ActivityObject.validate = function(props) {

    var dateprops = ["published", "updated"],
        uriarrayprops = ["downstreamDuplicates", "upstreamDuplicates"],
        htmlprops = ["content", "summary"],
        oprops = ["inReplyTo", "author"];

    // XXX: validate that id is a really-truly URI

    if (!_.isString(props.id)) {
        throw new TypeError("no id in activity object");
    }

    // XXX: validate that objectType is an URI or in our whitelist

    if (!_.isString(props.objectType)) {
        throw new TypeError("no objectType in activity object");
    }

    // XXX: validate that displayName is not HTML

    if (_.has(props, "displayName") && !_.isString(props.displayName)) {
        throw new TypeError("displayName property is not a string");
    }

    // XXX: validate that url is an URL

    if (_.has(props, "url") && !_.isString(props.url)) {
        throw new TypeError("url property is not a string");
    }

    _.each(oprops, function(name) {
        if (_.has(props, name)) {
            if (!_.isObject(props[name])) {
                throw new TypeError(name + " property is not an activity object");
            } else {
                ActivityObject.validate(props[name]);
            }
        }
    });

    // Validate attachments

    if (_.has(props, "attachments")) {
        if (!_.isArray(props.attachments)) {
            throw new TypeError("attachments is not an array");
        }
        _.each(props.attachments, function(attachment) {
            if (!_.isObject(attachment)) {
                throw new TypeError("attachment is not an object");
            }
            ActivityObject.validate(attachment);
        });
    }

    _.each(uriarrayprops, function(uriarrayprop) {
        if (_.has(props, uriarrayprop)) {
            if (!_.isArray(props[uriarrayprop])) {
                throw new TypeError(uriarrayprop + " is not an array");
            }

            if (_.some(props[uriarrayprop], function(str) { return !_.isString(str); })) {
                throw new TypeError(uriarrayprop + " member is not a string");
            }

            // XXX: validate that duplicates are URIs
        }
    });

    if (_.has(props, "image")) {
        if (!_.isObject(props.image)) {
            throw new TypeError("image property is not an object");
        }

        ActivityObject.validateMediaLink(props.image);
    }

    _.each(dateprops, function(dateprop) {
        // XXX: validate the date

        if (_.has(props, dateprop)) {
            if (!_.isString(props[dateprop])) {
                throw new TypeError(dateprop + " property is not a string");
            }
        }
    });

    _.each(htmlprops, function(name) {
        // XXX: validate HTML
        if (_.has(props, name) && !_.isString(props[name])) {
            throw new TypeError(name + " property is not a string");
        }
    });

    return;
};

ActivityObject.validateMediaLink = function(props) {

    var np = ["width", "height", "duration"];

    if (!_.isString(props.url)) {
        throw new TypeError("url property of media link is not a string");
    }

    _.each(np, function(nprop) {
        if (_.has(props, nprop) && !_.isNumber(props[nprop])) {
            throw new TypeError(nprop + " property of media link is not a number");
        }
    });

    return;
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
    fields: ["_created",
             "_uuid",
             "attachments",
             "author",
             "content",
             "displayName",
             "downstreamDuplicates",
             "id",
             "image",
             "inReplyTo",
             "likes",
             "links",
             "objectType",
             "published",
             "replies",
             "shares",
             "summary",
             "updated",
             "upstreamDuplicates",
             "url"],
    indices: ["_uuid", "url"]
};

ActivityObject.subSchema = function(withoutFields, addFields, addIndices) {
    var base = ActivityObject.baseSchema,
        schema = {
            pkey: base.pkey,
            indices: _.clone(base.indices)
        };

    if (withoutFields) {
        schema.fields = _.difference(base.fields,
                                     withoutFields);
    } else {
        schema.fields = base.fields;
    }

    if (addFields) {
        schema.fields = _.union(schema.fields, addFields);
    }

    if (addIndices) {
        schema.indices = _.union(schema.indices, addIndices);
    }

    return schema;
};

exports.ActivityObject = ActivityObject;
exports.UnknownTypeError = UnknownTypeError;
