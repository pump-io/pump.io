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
    "watch": "view"
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

var defaultObjectBuilder = function(obj, cb) {
    assert(_.isObject(obj));
    var method = objectTypeToMethod(obj.objectType);
    assert(_.isFunction(as[method]));
    var builder = as[method]();
    cb(null, builder);
};

var defaultObjectProperties = function(builder, obj, cb) {
    // For ActivityPub, IDs should resolve to the thing
    var self = _.get(obj, "links.self.href");
    if (self && self !== obj.id) {
        builder.id(self);
    } else if (obj.id) {
        builder.id(obj.id);
    }
    builder.name(obj.displayName);
    if (_.has(obj, "links['activity-inbox'].href")) {
        builder.inbox(_.get(obj, "links['activity-inbox'].href"));
    }
    if (_.has(obj, "links['activity-outbox'].href")) {
        builder.outbox(_.get(obj, "links['activity-outbox'].href"));
    }
    // XXX: DRY
    if (obj.published) {
        builder.published(new Date(obj.published));
    }
    if (obj.updated) {
        builder.updated(new Date(obj.updated));
    }
    if (obj.content) {
        builder.content(obj.content);
    }
    if (obj.summary) {
        builder.summary(obj.summary);
    }
    if (obj.url) {
        builder.url(
          as.link()
            .href(obj.url)
            .mediaType("text/html")
        );
    }
    // Async recurse into the complex properties
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

var defaultObjectConverter = function(obj, cb) {
    Step(
        function() {
            defaultObjectBuilder(obj, this);
        },
        function(err, builder) {
            if (err) throw err;
            defaultObjectProperties(builder, obj, this);
        },
        function(err, builder) {
            if (err) throw err;
            builder.get().export(this);
        },
        cb
    );
};

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

var activityBuilder = function(act, cb) {
  if (!act.verb) {
    defaultActivityBuilder(act, cb);
  } else if (_.has(activityBuilders, act.verb)) {
    activityBuilders[act.verb](act, cb);
  } else {
    defaultActivityBuilder(act, cb);
  }
};

var defaultActivityBuilder = function(act, cb) {
  assert(_.isObject(act));
  var method = verbToMethod(act.verb);
  assert(_.isFunction(as[method]));
  var builder = as[method]();
  cb(null, builder);
};

var defaultActivityProperties = function(builder, act, cb) {
    // For ActivityPub, IDs should resolve to the thing
    var self = _.get(act, "links.self.href");
    if (self && self !== act.id) {
        builder.id(self);
    } else if (act.id) {
        builder.id(act.id);
    }
    if (act.displayName) {
        builder.name(act.displayName);
    } else if (act.title) {
        builder.name(act.title);
    }
    if (act.content) {
        builder.summary(act.content);
    }
    if (act.published) {
        builder.published(new Date(act.published));
    }
    if (act.updated) {
        builder.updated(new Date(act.updated));
    }
    if (act.url) {
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

var defaultActivityConverter = function(act, cb) {
    Step(
      function() {
        activityBuilder(act, this);
      },
      function(err, builder) {
        if (err) throw err;
        defaultActivityProperties(builder, act, this);
      },
      function(err, builder) {
        if (err) throw err;
        builder.get().export(this);
      },
      cb
    );
};

// XXX: special case for page?

var collectionConverter = function(coll, cb) {
    var builder = as.orderedCollection();
    if (coll.totalItems) {
        builder.totalItems(coll.totalItems);
    }
    if (coll.url) {
        builder.id(coll.url);
    }
    if (coll.items) {

    }
    Step(
        function() {
            toAS2Builder(coll.items, this);
        },
        function(err, as2ified) {
            var pb = as.orderedCollectionPage();
            pb.orderedItems(as2ified);
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
            builder.get().export(cb);
        }
    );
};

var objectConverters = {

};

var activityConverters = {

};

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
        if (obj.objectType) { // Regular old activity object
            if (_.isFunction(objectConverters[obj.objectType])) {
                objectConverters[obj.objectType](obj, cb);
            } else {
                defaultObjectConverter(obj, cb);
            }
        } else if (obj.verb) {  // An activity
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

var toAS2Builder = function(obj, cb) {
    Step(
        function() {
            toAS2(obj, this);
        },
        function(err, converted) {
            if (err) throw err;
            if (!converted) {
                this(null, converted);
            } else if (_.isString(converted)) {
                this(null, converted);
            } else if (_.isArray(converted)) {
                as.import(converted, this);
            } else if (_.isObject(converted)) {
                as.import(converted, this);
            } else {
                this(new Error("Can't handle converted object of type" + typeof(converted)));
            }
        },
        cb
    );
};

module.exports = toAS2;
