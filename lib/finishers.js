// lib/finishers.js
//
// Functions for adding extra flags and stream data to API output
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

var _ = require("underscore"),
    Step = require("step"),
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    Edge = require("../lib/model/edge").Edge,
    Proxy = require("../lib/model/proxy").Proxy,
    Favorite = require("../lib/model/favorite").Favorite,
    Share = require("../lib/model/share").Share,
    FilteredStream = require("../lib/filteredstream").FilteredStream,
    filters = require("../lib/filters"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    urlparse = require("url").parse,
    recipientsOnly = filters.recipientsOnly,
    objectRecipientsOnly = filters.objectRecipientsOnly,
    objectPublicOnly = filters.objectPublicOnly,
    publicOnly = filters.publicOnly;

// finisher that adds followed flag to stuff

var addFollowedFinisher = function(principal, collection, callback) {

    // Ignore for non-users

    if (!principal) {
        callback(null);
        return;
    }

    addFollowed(principal, _.pluck(collection.items, "object"), callback);
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

var addSharedFinisher = function(principal, collection, callback) {

    // Ignore for non-users

    if (!principal) {
        callback(null);
        return;
    }

    addShared(principal, _.pluck(collection.items, "object"), callback);
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

var addLikedFinisher = function(principal, collection, callback) {

    // Ignore for non-users

    if (!principal) {
        callback(null);
        return;
    }

    addLiked(principal, _.pluck(collection.items, "object"), callback);
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

var firstFewRepliesFinisher = function(principal, collection, callback) {

    var profile = principal,
        objects = _.pluck(collection.items, "object");

    firstFewReplies(profile, objects, callback);
};

var firstFewReplies = function(profile, objs, callback) {

    var getReplies = function(obj, callback) {

        var objs;

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
            function(err, results) {
                var group = this.group();
                if (err) throw err;
                objs = results;
                _.each(objs, function(obj) {
                    obj.expandFeeds(group());
                });
            },
            function(err) {
                if (err) throw err;
                addLiked(profile, objs, this.parallel());
                addLikers(profile, objs, this.parallel());
            },
            function(err) {
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

var firstFewSharesFinisher = function(principal, collection, callback) {

    var profile = principal,
        objects = _.pluck(collection.items, "object");

    firstFewShares(profile, objects, callback);
};

var firstFewShares = function(profile, objs, callback) {

    var getShares = function(obj, callback) {

        if (!_.has(obj, "shares") ||
            !_.isObject(obj.shares) ||
            (_.has(obj.shares, "totalItems") && obj.shares.totalItems === 0)) {
            callback(null);
            return;
        }

        Step(
            function() {
                obj.getSharesStream(this);
            },
            function(err, str) {
                if (err) throw err;
                str.getObjects(0, 4, this);
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
                    obj.shares.items = objs;
                    _.each(obj.shares.items, function(item) {
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
                getShares(obj, group());
            });
        },
        callback
    );
};

// finisher that adds followed flag to stuff

var addLikersFinisher = function(principal, collection, callback) {

    // Ignore for non-users

    addLikers(principal,
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

// finisher that adds proxy URLs for remote URLs

var addProxyFinisher = function(principal, collection, callback) {

    var op = ['actor',
              'object',
              'target',
              'generator',
              'provider',
              'context',
              'source'],
        ap = ['to',
              'cc',
              'bto',
              'bcc'],
        objects = [],
        activities = collection.items;

    if (!principal) {
        callback(null);
        return;
    }

    // Get all the objects that are parts of these activities

    _.each(op, function(prop) {
        objects = objects.concat(_.pluck(activities, prop));
    });

    _.each(ap, function(prop) {
        var values = _.pluck(activities, prop);
        _.each(values, function(value) {
            objects = objects.concat(value);
        });
    });

    objects = _.compact(objects);

    addProxyObjects(principal, objects, callback);
};

var addProxyObjects = function(principal, objects, callback) {

    var mp = ['image',
              'stream',
              'fullImage'],
        cp = ['members',
              'followers',
              'following',
              'lists',
              'likes',
              'replies',
              'shares'],
        props = [],
        selves = [],
        urls;

    if (!principal) {
        callback(null);
        return;
    }

    // Get all the media stream properties that we know have urls and are parts of these objects

    _.each(mp, function(prop) {
        props = props.concat(_.pluck(objects, prop));
    });

    // Get all the collection properties that we know have urls and are parts of these objects

    _.each(cp, function(prop) {
        props = props.concat(_.pluck(objects, prop));
    });

    // Squish them down so we only have the ones we need

    props = _.compact(props);

    urls = _.compact(_.pluck(props, "url"));

    // Get all the self-links

    _.each(objects, function(obj) {
        if (obj.links && obj.links.self && obj.links.self.href) {
            urls.push(obj.links.self.href);
        }
    });

    // Uniquify the whole set of URLs

    urls = _.uniq(urls);

    // Throw out anything that's not a string

    urls = _.filter(urls, function(url) {
        return _.isString(url);
    });

    // Only need proxies for remote URLs

    urls = _.filter(urls, function(url) {
        var parts = urlparse(url);
        return (parts.hostname != URLMaker.hostname && (!Proxy.whitelist || Proxy.whitelist.indexOf(parts.hostname) == -1));
    });

    Step(
        function() {
            var User = require("./model/user").User;
            User.fromPerson(principal.id, this);
        },
        function(err, user) {
            if (err) {
                throw err;
            } else if (!user) {
                // Don't add proxy urls for non-users
                callback(null);
                return;
            } else {
                Proxy.ensureAll(urls, this);
            }
        },
        function(err, utp) {
            if (err) {
                callback(err);
                return;
            }
            _.each(props, function(prop) {
                if (_.has(utp, prop.url)) {
                    if (!prop.pump_io) {
                        prop.pump_io = {};
                    }
                    prop.pump_io.proxyURL = URLMaker.makeURL("/api/proxy/"+utp[prop.url].id);
                }
            });
            _.each(objects, function(obj) {
                if (obj.links && obj.links.self && obj.links.self.href) {
                    if (_.has(utp, obj.links.self.href)) {
                        if (!obj.pump_io) {
                            obj.pump_io = {};
                        }
                        obj.pump_io.proxyURL = URLMaker.makeURL("/api/proxy/"+utp[obj.links.self.href].id);
                    }
                }
            });
            callback(null);
        }
    );
};

var doFinishers = function(finishers) {
    return function(principal, collection, callback) {
        Step(
            function() {
                var group = this.group();
                _.each(finishers, function(finisher) {
                    finisher(principal, collection, group());
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
exports.firstFewSharesFinisher = firstFewSharesFinisher;
exports.firstFewShares = firstFewShares;
exports.doFinishers = doFinishers;
exports.addLikersFinisher = addLikersFinisher;
exports.addLikers = addLikers;
exports.addSharedFinisher = addSharedFinisher;
exports.addShared = addShared;
exports.addProxyFinisher = addProxyFinisher;
exports.addProxyObjects = addProxyObjects;
