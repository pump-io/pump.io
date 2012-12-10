// lib/finishers.js
//
// Functions for adding extra flags and stream data to API output
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

var _ = require("underscore"),
    Step = require("step"),
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    Edge = require("../lib/model/edge").Edge,
    Favorite = require("../lib/model/favorite").Favorite,
    Share = require("../lib/model/share").Share,
    FilteredStream = require("../lib/filteredstream").FilteredStream,
    filters = require("../lib/filters"),
    recipientsOnly = filters.recipientsOnly,
    objectRecipientsOnly = filters.objectRecipientsOnly,
    objectPublicOnly = filters.objectPublicOnly,
    publicOnly = filters.publicOnly;

// finisher that adds followed flag to stuff

var addFollowedFinisher = function(req, collection, callback) {

    // Ignore for non-users

    if (!req.remoteUser) {
        callback(null);
        return;
    }

    addFollowed(req.remoteUser.profile, _.pluck(collection.items, "object"), callback);
};

var addFollowed = function(profile, objects, callback) {

    var edgeIDs;

    // Ignore for non-users

    if (!profile) {
        callback(null);
        return;
    }

    edgeIDs = objects.map(function(object) {
        return Edge.id(profile.id, object.id);
    });

    Step(
        function() {
            Edge.readAll(edgeIDs, this);
        },
        function(err, edges) {
            if (err) {
                callback(err);
            } else {
                _.each(objects, function(object, i) {
                    var edgeID = edgeIDs[i];
                    if (!_.has(object, "pump_io")) {
                        object.pump_io = {};
                    }
                    if (_.has(edges, edgeID) && _.isObject(edges[edgeID])) {
                        object.pump_io.followed = true;
                    } else {
                        object.pump_io.followed = false;
                    }
                });
                callback(null);
            }
        }
    );
};

// finisher that adds shared flag to stuff

var addSharedFinisher = function(req, collection, callback) {

    // Ignore for non-users

    if (!req.remoteUser) {
        callback(null);
        return;
    }

    addShared(req.remoteUser.profile, _.pluck(collection.items, "object"), callback);
};

var addShared = function(profile, objects, callback) {

    var shareIDs;

    // Ignore for non-users

    if (!profile) {
        callback(null);
        return;
    }


    shareIDs = objects.map(function(object) {
        return Share.id(profile, object);
    });

    Step(
        function() {
            Share.readAll(shareIDs, this);
        },
        function(err, shares) {
            if (err) {
                callback(err);
            } else {
                _.each(objects, function(object, i) {
                    var shareID = shareIDs[i];
                    if (!_.has(object, "pump_io")) {
                        object.pump_io = {};
                    }
                    if (_.has(shares, shareID) && _.isObject(shares[shareID])) {
                        object.pump_io.shared = true;
                    } else {
                        object.pump_io.shared = false;
                    }
                });
                callback(null);
            }
        }
    );
};

// finisher that adds liked flag to stuff

var addLikedFinisher = function(req, collection, callback) {

    // Ignore for non-users

    if (!req.remoteUser) {
        callback(null);
        return;
    }

    addLiked(req.remoteUser.profile, _.pluck(collection.items, "object"), callback);
};

var addLiked = function(profile, objects, callback) {

    var faveIDs;

    // Ignore for non-users

    if (!profile) {
        callback(null);
        return;
    }

    faveIDs = objects.map(function(object) {
        return Favorite.id(profile.id, object.id);
    });

    Step(
        function() {
            Favorite.readAll(faveIDs, this);
        },
        function(err, faves) {
            if (err) {
                callback(err);
            } else {
                _.each(objects, function(object, i) {
                    var faveID = faveIDs[i];
                    if (_.has(faves, faveID) && _.isObject(faves[faveID])) {
                        object.liked = true;
                    } else {
                        object.liked = false;
                    }
                });
                callback(null);
            }
        }
    );
};

var firstFewRepliesFinisher = function(req, collection, callback) {

    var profile = (req.remoteUser) ? req.remoteUser.profile : null,
        objects = _.pluck(collection.items, "object");

    firstFewReplies(profile, objects, callback);
};

var firstFewReplies = function(profile, objs, callback) {

    var getReplies = function(obj, callback) {

        if (!_.has(obj, "replies") ||
            !_.isObject(obj.replies) ||
            (_.has(obj.replies, "totalItems") && obj.replies.totalItems === 0)) {
            callback(null);
            return;
        }

        Step(
            function() {
                obj.getRepliesStream(this);
            },
            function(err, str) {
                var filtered;
                if (err) throw err;
                if (!profile) {
                    filtered = new FilteredStream(str, objectPublicOnly);
                } else {
                    filtered = new FilteredStream(str, objectRecipientsOnly(profile));
                }
                filtered.getObjects(0, 4, this);
            },
            function(err, refs) {
                var group = this.group();
                if (err) throw err;
                _.each(refs, function(ref) {
                    ActivityObject.getObject(ref.objectType, ref.id, group());
                });
            },
            function(err, objs) {
                if (err) {
                    callback(err);
                } else {
                    obj.replies.items = objs;
                    _.each(obj.replies.items, function(item) {
                        item.sanitize();
                    });
                    callback(null);
                }
            }
        );
    };

    Step(
        function() {
            var group = this.group();
            _.each(objs, function(obj) {
                getReplies(obj, group());
            });
        },
        callback
    );
};

// finisher that adds followed flag to stuff

var addLikersFinisher = function(req, collection, callback) {

    // Ignore for non-users

    addLikers((req.remoteUser) ? req.remoteUser.profile : null,
              _.pluck(collection.items, "object"),
              callback);
};

var addLikers = function(profile, objects, callback) {

    var liked = _.filter(objects, function(object) {
        return _.has(object, "likes") &&
            _.isObject(object.likes) &&
            _.has(object.likes, "totalItems") &&
            _.isNumber(object.likes.totalItems) &&
            object.likes.totalItems > 0;
    });

    Step(
        function() {
            var group = this.group();
            
            _.each(liked, function(object) {
                object.getFavoriters(0, 4, group());
            });
        },
        function(err, likers) {
            if (err) {
                callback(err);
            } else {
                _.each(liked, function(object, i) {
                    object.likes.items = likers[i];
                });
                callback(null);
            }
        }
    );
};

var doFinishers = function(finishers) {
    return function(req, collection, callback) {
        Step(
            function() {
                var group = this.group();
                _.each(finishers, function(finisher) {
                    finisher(req, collection, group());
                });
            },
            callback
        );
    };
};

exports.addFollowedFinisher = addFollowedFinisher;
exports.addFollowed = addFollowed;
exports.addLikedFinisher = addLikedFinisher;
exports.addLiked = addLiked;
exports.firstFewRepliesFinisher = firstFewRepliesFinisher;
exports.firstFewReplies = firstFewReplies;
exports.doFinishers = doFinishers;
exports.addLikersFinisher = addLikersFinisher;
exports.addLikers = addLikers;
exports.addSharedFinisher = addSharedFinisher;
exports.addShared = addShared;
