// as2.js
//
// conversion routine for AS1 -> AS2
//
// Copyright 2017 AJ Jordan <alex@strugee.net>
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

"use strict";

var assert = require("assert"),
    _ = require("lodash"),
    Step = require("step"),
    as = require("activitystrea.ms"),
    ActivityObject = require("./model/activityobject").ActivityObject,
    Activity = require("./model/activity").Activity;

// Converts an AS1 value to an AS2 value
// value can be a string, array, or object
// Callback will receive new plain JavaScript value

var toAS2 = function(obj, cb) {

    if (!obj) {
        // Usually during recursion when use a property without checking it
        cb(null, obj);
    } else if (_.isString(obj)) {
        // Strings usually (?) are IDs in place of object properties,
        // so just return that string
        cb(null, obj);
    } else if (_.isArray(obj)) {
        // We convert all members of an array and return the array
        Step(
            function() {
                var group = this.group();
                _.each(obj, function(item) {
                    toAS2(item, group());
                });
            },
            function(err, members) {
                if (err) throw err;
                this(null, members);
            },
            cb
        );
    } else if (_.isObject(obj)) {
        if (_.has(obj, "objectType")) { // Regular old activity object
            if (_.isFunction(objectConverters[obj.objectType])) {
                objectConverters[obj.objectType](obj, cb);
            } else {
                defaultObjectConverter(obj, cb);
            }
        } else if (_.has(obj, "verb")) {  // An activity
            if (_.isFunction(activityConverters[obj.verb])) {
                activityConverters[obj.verb](obj, cb);
            } else {
                defaultActivityConverter(obj, cb);
            }
        } else if (_.isNumber(obj.totalItems) || _.isArray(obj.items)) {  // Collection
            collectionConverter(obj, cb);
        } else { // XXX: are there other special cases?
            defaultObjectConverter(obj, cb);
        }
    } else {
        return cb(new Error("Don't recognize object of type " + typeof(obj)));
    }
};

// Converts an AS1 object to an AS2 object

var defaultObjectConverter = function(obj, cb) {
    Step(
        function() {
            // Get a builder for the object type
            defaultObjectBuilder(obj, this);
        },
        function(err, builder) {
            if (err) throw err;
            // Use the builder to set properties
            if (_.isFunction(objectProperties[obj.objectType])) {
                objectProperties[obj.objectType](builder, obj, this);
            } else {
                defaultObjectProperties(builder, obj, this);
            }
        },
        function(err, builder) {
            if (err) throw err;
            // Export the actual AS2 object from the builder
            builder.get().export(this);
        },
        cb
    );
};

// Create a builder based on the objectType

var defaultObjectBuilder = function(obj, cb) {
    assert(_.isObject(obj));
    var method = objectTypeToMethod(obj.objectType);
    assert(_.isFunction(as[method]));
    var builder = as[method]();
    cb(null, builder);
};

// Use the builder to set object properties

var defaultObjectProperties = function(builder, obj, cb) {
    // For ActivityPub, IDs should resolve to the thing
    var self = _.get(obj, "links.self.href");
    if (self && self !== obj.id) {
        builder.id(self);
    } else if (_.has(obj, "id")) {
        builder.id(obj.id);
    }
    if (_.has(obj, "displayName")) {
        builder.name(obj.displayName);
    }
    if (_.has(obj, "links['activity-inbox'].href")) {
        builder.inbox(_.get(obj, "links['activity-inbox'].href"));
    }
    if (_.has(obj, "links['activity-outbox'].href")) {
        builder.outbox(_.get(obj, "links['activity-outbox'].href"));
    }
    // XXX: DRY
    if (_.has(obj, "published")) {
        builder.published(new Date(obj.published));
    }
    if (_.has(obj, "updated")) {
        builder.updated(new Date(obj.updated));
    }
    if (_.has(obj, "content")) {
        builder.content(obj.content);
    }
    if (_.has(obj, "summary")) {
        builder.summary(obj.summary);
    }
    if (_.has(obj, "url")) {
        builder.url(
          as.link()
            .href(obj.url)
            .mediaType("text/html")
        );
    }
    // Async recurse into the complex (object or array) properties
    Step(
        function() {
            var group = this.group();
            var complex = ["attachments", "author", "image", "inReplyTo",
                "likes", "replies", "shares"];

            _.each(complex, function(prop) {
                var cb = group();
                if (!_.has(obj, prop)) {
                    cb(null);
                } else {
                    Step(
                        function() {
                            toAS2Builder(obj[prop], this);
                        },
                        function(err, imported) {
                            if (err) throw err;
                            var bfunc = (prop === "author") ? "attributedTo" : prop;
                            if (_.isFunction(builder[bfunc])) {
                                builder[bfunc](imported);
                            }
                            this(null);
                        },
                        cb
                    );
                }
            });
        },
        function(err) {
            if (err) {
                cb(err);
            } else {
                cb(null, builder);
            }
        }
    );
};

var objectProperties = {
    "person": function(builder, obj, cb) {
        Step(
            function() {
                defaultObjectProperties(builder, obj, this);
            },
            function(err, builder) {
                if (err) throw err;
                var streams = {
                    "followers": "followers",
                    "following": "following",
                    "favorites": "liked"
                };
                _.each(streams, function(bfunc, stream) {
                    if (_.isString(obj[stream])) {
                        builder[bfunc](obj[stream]);
                    } else if (_.isObject(obj[stream]) && _.isString(obj[stream].url)) {
                        builder[bfunc](obj[stream].url);
                    }
                });
                this(null, builder);
            },
            cb
        );
    }
};

// Special case map for objectType -> as method name
var objectVocabMap = {

};

// returns the name of the best as method to use for creating an as2 object
// that approximates this type

var objectTypeToMethod = function(objectType) {
    if (!objectType) {
        return "object";
    } else if (_.has(objectVocabMap, objectType)) {
        return objectVocabMap[objectType];
    } else if (_.includes(ActivityObject.objectTypes, objectType) &&
                _.has(as, objectType)) {
        return objectType;
    } else {
        return "object";
    }
};

// Converts an AS1 activity to an AS2 activity based on the verb

var defaultActivityConverter = function(act, cb) {
    Step(
      function() {
        activityBuilder(act, this);
      },
      function(err, builder) {
        if (err) throw err;
        // Use the builder to set properties
        if (_.isFunction(activityProperties[act.verb])) {
            activityProperties[act.verb](builder, act, this);
        } else {
            defaultActivityProperties(builder, act, this);
        }
      },
      function(err, builder) {
        if (err) throw err;
        builder.get().export(this);
      },
      cb
    );
};

// Returns an as builder based on the as1 activity

var activityBuilder = function(act, cb) {
  if (!act.verb) {
    defaultActivityBuilder(act, cb);
  } else if (_.has(activityBuilders, act.verb)) {
    activityBuilders[act.verb](act, cb);
  } else {
    defaultActivityBuilder(act, cb);
  }
};

// The default method for getting an as builder, but see below for special cases

var defaultActivityBuilder = function(act, cb) {
  assert(_.isObject(act));
  var method = verbToMethod(act.verb);
  assert(_.isFunction(as[method]));
  var builder = as[method]();
  cb(null, builder);
};

// Use the builder to set activity properties

var defaultActivityProperties = function(builder, act, cb) {
    // For ActivityPub, IDs should resolve to the thing
    var self = _.get(act, "links.self.href");
    if (self && self !== act.id) {
        builder.id(self);
    } else if (_.has(act, "id")) {
        builder.id(act.id);
    }
    if (_.has(act, "displayName")) {
        builder.name(act.displayName);
    } else if (_.has(act, "title")) {
        builder.name(act.title);
    }
    if (_.has(act, "content")) {
        builder.summary(act.content);
    }
    if (_.has(act, "published")) {
        builder.published(new Date(act.published));
    }
    if (_.has(act, "updated")) {
        builder.updated(new Date(act.updated));
    }
    if (_.has(act, "url")) {
        builder.url(
          as.link()
            .href(act.url)
            .mediaType("text/html")
        );
    }
    // Asynchronously recurse for potentially complex properties
    Step(
        function() {
            var group = this.group();
            var complex = _.concat(Activity.oprops, Activity.aprops, ["icon"]);

            _.each(complex, function(prop) {
                var cb = group();
                if (!_.has(act, prop)) {
                    cb(null);
                } else {
                    Step(
                        function() {
                            toAS2Builder(act[prop], this);
                        },
                        function(err, imported) {
                            if (err) throw err;
                            builder[prop](imported);
                            this(null);
                        },
                        cb
                    );
                }
            });
        },
        function(err) {
            if (err) {
                cb(err);
            } else {
                cb(null, builder);
            }
        }
    );
};

var undoActivityProperties = function(method) {
    return function(builder, act, cb) {
        // For ActivityPub, IDs should resolve to the thing
        var self = _.get(act, "links.self.href");
        if (self && self !== act.id) {
            builder.id(self);
        } else if (_.has(act, "id")) {
            builder.id(act.id);
        }
        if (_.has(act, "displayName")) {
            builder.name(act.displayName);
        } else if (_.has(act, "title")) {
            builder.name(act.title);
        }
        if (_.has(act, "content")) {
            builder.summary(act.content);
        }
        if (_.has(act, "published")) {
            builder.published(new Date(act.published));
        }
        if (_.has(act, "updated")) {
            builder.updated(new Date(act.updated));
        }
        if (_.has(act, "url")) {
            builder.url(
              as.link()
                .href(act.url)
                .mediaType("text/html")
            );
        }

        var ibuilder = as[method]();

        // Asynchronously recurse for potentially complex properties
        Step(
            function() {
                var group = this.group();
                var complex = _.concat(Activity.oprops, Activity.aprops, ["icon"]);
                var other = ["object", "target"];
                var both = ["actor"];

                _.each(complex, function(prop) {
                    var cb = group();
                    if (!_.has(act, prop)) {
                        cb(null);
                    } else {
                        Step(
                            function() {
                                toAS2Builder(act[prop], this);
                            },
                            function(err, imported) {
                                if (err) throw err;
                                if (other.indexOf(prop) !== -1) {
                                    ibuilder[prop](imported);
                                } else if (both.indexOf(prop) !== -1) {
                                    ibuilder[prop](imported);
                                    builder[prop](imported);
                                } else {
                                    builder[prop](imported);
                                }
                                this(null);
                            },
                            cb
                        );
                    }
                });
            },
            function(err) {
                if (err) {
                    cb(err);
                } else {
                    builder.object(ibuilder.get());
                    cb(null, builder);
                }
            }
        );
    };
};

var activityProperties = {
    "stop-following": undoActivityProperties("follow"),
    "unlike": undoActivityProperties("like"),
    "unfavorite": undoActivityProperties("like"),
    "unshare": undoActivityProperties("announce")
};

// Special case map for verb -> as method name
var verbVocabMap = {
    "share": "announce",
    "attach": "add",
    "author": "create",
    "favorite": "like",
    "flag-as-inappropriate": "flag",
    "play": "view",
    "rsvp-maybe": "tentativeAccept",
    "rsvp-no": "reject",
    "rsvp-yes": "accept",
    "watch": "view",
    "stop-following": "undo",
    "unlike": "undo",
    "unfavorite": "undo",
    "unshare": "undo"
};

// returns the name of the best as method to use for creating an as2 object
// that approximates this type

var verbToMethod = function(verb) {
    if (!verb) {
        return "activity";
    } else if (_.has(verbVocabMap, verb)) {
        return verbVocabMap[verb];
    } else if (_.includes(Activity.verbs, verb) && _.has(as, verb)) {
        return verb;
    } else {
        return "activity";
    }
};

// Special cases for builders for activities

var activityBuilders = {
  "post": function(act, cb) {
      var method = (act.target) ? "add" : "create";
      assert(_.isFunction(as[method]));
      cb(null, as[method]());
  },
  "submit": function(act, cb) {
      var method = (act.target) ? "add" : "create";
      assert(_.isFunction(as[method]));
      cb(null, as[method]());
  }
};

// Convert an untyped AS1 collection to an AS2 Collection

var collectionConverter = function(coll, cb) {
    var builder = as.orderedCollection();
    if (_.has(coll, "totalItems") && _.isNumber(coll.totalItems)) {
        builder.totalItems(coll.totalItems);
    }
    if (coll.url) {
        builder.id(coll.url);
    }
    Step(
        function() {
            if (_.isArray(coll.items)) {
                toAS2Builder(coll.items, this);
            } else {
                this(null, null);
            }
        },
        function(err, as2ified) {
            if (err) throw err;
            // We add a "first" property if the collection is not
            // empty
            if ((_.isNumber(coll.totalItems) && coll.totalItems > 0) ||
                (_.isArray(coll.items) && coll.items.length > 0)) {
                var pb = as.orderedCollectionPage();
                if (_.isArray(as2ified) && as2ified.length > 0) {
                    pb.orderedItems(as2ified);
                }
                if (_.isObject(coll.links)) {
                    if (_.isObject(coll.links.first)) {
                        pb.id(coll.links.first.href);
                    }
                    if (_.isObject(coll.links.next)) {
                        pb.next(coll.links.next.href);
                    }
                    if (_.isObject(coll.links.prev)) {
                        pb.prev(coll.links.prev.href);
                    }
                }
                builder.first(pb.get());
            }
            builder.get().export(this);
        },
        cb
    );
};

// Special cases for object conversion

var objectConverters = {
    // We special-case person since we want to use the profile URL as the
    // main identity
    "person": function(obj, cb) {
        Step(
            function() {
                defaultObjectConverter(obj, this);
            },
            function(err, person) {
                if (err) throw err;
                if (ActivityObject.isLocal(obj) && _.has(obj, "url")) {
                    person.id = obj.url;
                }
                this(null, person);
            },
            cb
        );
    }
};

// Special cases for activity conversion

var activityConverters = {
};

// Used internally to build properties of an object, activity, or collection.
// Recursivity ftw

var toAS2Builder = function(obj, cb) {

    if (!obj) {
        cb(null, obj);
    } else if (_.isString(obj)) {
        cb(null, obj);
    } else if (_.isArray(obj)) {
        if (obj.length === 0) {
            cb(null, obj);
        } else {
            Step(
                function() {
                    var group = this.group();
                    _.each(obj, function(item) {
                        toAS2Builder(item, group());
                    });
                },
                cb
            );
        }
    } else if (_.isObject(obj)) {
        Step(
            function() {
                toAS2(obj, this);
            },
            function(err, converted) {
                if (err) throw err;
                as.import(converted, this);
            },
            cb
        );
    } else {
        this(new Error("Can't handle converted object of type" + typeof(converted)));
    }
};

module.exports = toAS2;
