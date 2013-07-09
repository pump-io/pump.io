// streams.js
//
// Move the important streams to their own module
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

var databank = require("databank"),
    _ = require("underscore"),
    Step = require("step"),
    FilteredStream = require("../lib/filteredstream").FilteredStream,
    filters = require("../lib/filters"),
    recipientsOnly = filters.recipientsOnly,
    publicOnly = filters.publicOnly,
    objectRecipientsOnly = filters.objectRecipientsOnly,
    objectPublicOnly = filters.objectPublicOnly,
    idRecipientsOnly = filters.idRecipientsOnly,
    idPublicOnly = filters.idPublicOnly,
    HTTPError = require("../lib/httperror").HTTPError,
    Activity = require("../lib/model/activity").Activity,
    Collection = require("../lib/model/collection").Collection,
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    Person = require("../lib/model/person").Person,
    stream = require("../lib/model/stream"),
    NotInStreamError = stream.NotInStreamError,
    URLMaker = require("../lib/urlmaker").URLMaker,
    randomString = require("../lib/randomstring").randomString,
    finishers = require("../lib/finishers"),
    NoSuchThingError = databank.NoSuchThingError,
    addFollowedFinisher = finishers.addFollowedFinisher,
    addFollowed = finishers.addFollowed,
    addLikedFinisher = finishers.addLikedFinisher,
    addLiked = finishers.addLiked,
    addLikersFinisher = finishers.addLikersFinisher,
    addLikers = finishers.addLikers,
    addSharedFinisher = finishers.addSharedFinisher,
    addShared = finishers.addShared,
    addProxyFinisher = finishers.addProxyFinisher,
    addProxyObjects = finishers.addProxyObjects,
    firstFewRepliesFinisher = finishers.firstFewRepliesFinisher,
    firstFewReplies = finishers.firstFewReplies,
    firstFewSharesFinisher = finishers.firstFewSharesFinisher,
    firstFewShares = finishers.firstFewShares,
    doFinishers = finishers.doFinishers;

var activityFeed = function(relmaker, titlemaker, streammaker, finisher) {

    return function(context, principal, args, callback) {

        var base = relmaker(context),
            url = URLMaker.makeURL(base),
            collection = {
                displayName: titlemaker(context),
                objectTypes: ["activity"],
                url: url,
                links: {
                    first: {
                        href: url
                    },
                    self: {
                        href: url
                    }
                },
                items: []
            };

        var str, ids;

        // XXX: making assumptions about the context is probably bad

        if (context.user) {
            collection.author = context.user.profile;
        }

        // args are optional

        if (!callback) {
            callback = args;
            args = {start: 0, end: 20};
        }

        Step(
            function() {
                streammaker(context, this);
            },
            function(err, results) {
                if (err) {
                    if (err.name == "NoSuchThingError") {
                        collection.totalItems = 0;
                        collection.items      = [];
                        this(null, 0);
                    } else {
                        throw err;
                    }
                } else {
                    // Skip filtering if remote user == author
                    if (principal && collection.author && principal.id == collection.author.id) {
                        str = results;
                    } else if (!principal) {
                        // XXX: keep a separate stream instead of filtering
                        str = new FilteredStream(results, publicOnly);
                    } else {
                        str = new FilteredStream(results, recipientsOnly(principal));
                    }
                    str.count(this);
                }
            },
            function(err, totalItems) {
                if (err) throw err;
                collection.totalItems = totalItems;
                if (totalItems === 0) {
                    this(null, []);
                    return;
                }
                if (_(args).has("before")) {
                    str.getIDsGreaterThan(args.before, args.count, this);
                } else if (_(args).has("since")) {
                    str.getIDsLessThan(args.since, args.count, this);
                } else {
                    str.getIDs(args.start, args.end, this);
                }
            },
            function(err, ids) {
                if (err) {
                    if (err.name == "NotInStreamError") {
                        throw new HTTPError(err.message, 400);
                    } else {
                        throw err;
                    }
                }
                if (ids.length === 0) {
                    this(null, []);
                } else {
                    Activity.readArray(ids, this);
                }
            },
            function(err, activities) {
                if (err) throw err;
                activities.forEach(function(act) {
                    act.sanitize(principal);
                });
                collection.items = activities;
                if (activities.length > 0) {
                    collection.links.prev = {
                        href: collection.url + "?since=" + encodeURIComponent(activities[0].id)
                    };
                    if ((_(args).has("start") && args.start + activities.length < collection.totalItems) ||
                        (_(args).has("before") && activities.length >= args.count) ||
                        (_(args).has("since"))) {
                        collection.links.next = {
                            href: collection.url + "?before=" + encodeURIComponent(activities[activities.length-1].id)
                        };
                    }
                }
                if (finisher) {
                    finisher(principal, collection, this);
                } else {
                    this(null);
                }
            },
            function(err) {
                if (err) {
                    callback(err, null);
                } else {
                    if (_.has(collection, "author")) {
                        collection.author.sanitize();
                    }
                    callback(null, collection);
                }
            }
        );
    };
};

var personFeed = function(relmaker, titlemaker, streammaker, finisher) {

    return function(context, principal, args, callback) {

        var str,
            base = relmaker(context),
            url = URLMaker.makeURL(base),
            collection = {
                displayName: titlemaker(context),
                url: url,
                objectTypes: ["person"],
                items: []
            };

        if (!callback) {
            callback = args;
            args = {start: 0, end: 20};
        }

        Step(
            function() {
                streammaker(context, this);
            },
            function(err, results) {
                if (err) throw err;
                str = results;
                str.count(this);
            },
            function(err, count) {
                if (err) {
                    if (err.name == "NoSuchThingError") {
                        collection.totalItems = 0;
                        this(null, []);
                    } else {
                        throw err;
                    }
                } else {
                    collection.totalItems = count;
                    if (_(args).has("before")) {
                        str.getIDsGreaterThan(args.before, args.count, this);
                    } else if (_(args).has("since")) {
                        str.getIDsLessThan(args.since, args.count, this);
                    } else {
                        str.getIDs(args.start, args.end, this);
                    }
                }
            },
            function(err, ids) {
                if (err) throw err;
                if (ids.length === 0) {
                    this(null, []);
                } else {
                    Person.readArray(ids, this);
                }
            },
            function(err, people) {
                if (err) throw err;

                collection.items = people;

                finisher(context, principal, collection, this);
            },
            function(err) {

                if (err) {

                    callback(err, null);

                } else {

                    _.each(collection.items, function(person) {
                        person.sanitize();
                    });

                    collection.links = {
                        self: {
                            href: URLMaker.makeURL(base, {offset: args.start, count: args.count})
                        },
                        current: {
                            href: URLMaker.makeURL(base)
                        }
                    };

                    if (collection.items.length > 0)  {
                        collection.links.prev = {
                            href: URLMaker.makeURL(base,
                                                   {since: collection.items[0].id})
                        };
                        if (collection.totalItems > collection.items.length &&
                            (!_.has(args, "start") || collection.totalItems > (args.start + collection.items.length))) {
                            collection.links.next = {
                                href: URLMaker.makeURL(base,
                                                       {before: collection.items[collection.items.length - 1].id})
                            };
                        }
                    }

                    if (_.has(collection, "author")) {
                        collection.author.sanitize();
                    }

                    callback(null, collection);
                }
            }
        );
    };
};

var objectFeed = function(relmaker, titlemaker, streammaker, finisher) {

    return function(context, principal, args, callback) {

        var str,
            base = relmaker(context),
            url = URLMaker.makeURL(base),
            collection = {
                displayName: titlemaker(context),
                url: url,
                items: [],
                links: {
                    first: {
                        href: url
                    },
                    self: {
                        href: url
                    }
                }
            };

        if (!callback) {
            callback = args;
            args = {start: 0, end: 20};
        }

        Step(
            function() {
                streammaker(context, this);
            },
            function(err, results) {
                if (err) throw err;
                if (!principal) {
                    // XXX: keep a separate stream instead of filtering
                    str = new FilteredStream(results, objectPublicOnly);
                } else if (context.author && context.author.id == principal.id) {
                    str = results;
                } else {
                    str = new FilteredStream(results, objectRecipientsOnly(principal));
                }
                str.count(this.parallel());
            },
            function(err, count) {
                var type;
                if (err) throw err;
                collection.totalItems = count;
                if (count === 0) {
                    this(null, []);
                } else {
                    type = context.type;
                    if (type && _.has(args, "before")) {
                        str.getObjectsGreaterThan({id: args.before, objectType: type}, args.count, this.parallel());
                    } else if (type && _.has(args, "since")) {
                        str.getObjectsLessThan({id: args.since, objectType: type}, args.count, this.parallel());
                    } else {
                        str.getObjects(args.start, args.end, this.parallel());
                    }
                }
            },
            function(err, refs) {
                var group = this.group();
                if (err) throw err;
                _.each(refs, function(ref) {
                    ActivityObject.getObject(ref.objectType, ref.id, group());
                });
            },
            function(err, objs) {
                var group = this.group();
                if (err) throw err;
                collection.items = objs;
                _.each(collection.items, function(obj) {
                    obj.expandFeeds(group());
                });
            },
            function(err) {
                if (err) throw err;
                finisher(context, principal, collection, this);
            },
            function(err) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, collection);
                }
            }
        );
    };
};

var collectionFeed = function(relmaker, titlemaker, streammaker, finisher) {

    return function(context, principal, args, callback) {
        var base = relmaker(context),
            url = URLMaker.makeURL(base),
            collection = {
                displayName: titlemaker(context),
                objectTypes: ["collection"],
                url: url,
                links: {
                    first: {
                        href: url
                    },
                    self: {
                        href: url
                    }
                },
                items: []
            };

        if (!callback) {
            callback = args;
            args = {start: 0, end: 20};
        }

        var lists, stream;

        Step(
            function() {
                streammaker(context, this);
            },
            function(err, result) {
                if (err) throw err;
                stream = result;
                stream.count(this);
            },
            function(err, totalItems) {
                var filtered;
                if (err) throw err;
                collection.totalItems = totalItems;
                if (totalItems === 0) {
                    if (_.has(collection, "author")) {
                        collection.author.sanitize();
                    }
                    callback(null, collection);
                    return;
                }
                if (!principal) {
                    filtered = new FilteredStream(stream, idPublicOnly(Collection.type));
                } else {
                    filtered = new FilteredStream(stream, idRecipientsOnly(principal, Collection.type));
                }

                if (_(args).has("before")) {
                    filtered.getIDsGreaterThan(args.before, args.count, this);
                } else if (_(args).has("since")) {
                    filtered.getIDsLessThan(args.since, args.count, this);
                } else {
                    filtered.getIDs(args.start, args.end, this);
                }
            },
            function(err, ids) {
                if (err) {
                    if (err.name == "NotInStreamError") {
                        throw new HTTPError(err.message, 400);
                    } else {
                        throw err;
                    }
                }
                Collection.readArray(ids, this);
            },
            function(err, results) {
                var group = this.group();
                if (err) throw err;
                lists = results;
                _.each(lists, function(list) {
                    list.expandFeeds(group());
                });
            },
            function(err) {
                if (err) throw err;
                finisher(context, principal, collection, this);
            },
            function(err) {
                if (err) {
                    callback(err, null);
                } else {
                    _.each(lists, function(item) {
                        item.sanitize();
                    });
                    collection.items = lists;
                    if (lists.length > 0) {
                        collection.links.prev = {
                            href: collection.url + "?since=" + encodeURIComponent(lists[0].id)
                        };
                        if ((_(args).has("start") && args.start + lists.length < collection.totalItems) ||
                            (_(args).has("before") && lists.length >= args.count) ||
                            (_(args).has("since"))) {
                            collection.links.next = {
                                href: collection.url + "?before=" + encodeURIComponent(lists[lists.length-1].id)
                            };
                        }
                    }
                    if (_.has(collection, "author")) {
                        collection.author.sanitize();
                    }
                    callback(null, collection);
                }
            }
        );
    };
};

var majorFinishers = doFinishers([addProxyFinisher,
                                  addLikedFinisher,
                                  firstFewRepliesFinisher,
                                  addLikersFinisher,
                                  addSharedFinisher,
                                  firstFewSharesFinisher]);

var userStream = activityFeed(
    function(context) {
        var user = context.user;

        return "api/user/" + user.nickname + "/feed";
    },
    function(context) {
        var user = context.user;

        return "Activities by " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.getOutboxStream(callback);
    },
    addProxyFinisher
);

var userMajorStream = activityFeed(
    function(context) {
        var user = context.user;

        return "api/user/" + user.nickname + "/feed/major";
    },
    function(context) {
        var user = context.user;

        return "Major activities by " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.getMajorOutboxStream(callback);
    },
    majorFinishers
);

var userMinorStream = activityFeed(
    function(context) {
        var user = context.user;

        return "api/user/" + user.nickname + "/feed/minor";
    },
    function(context) {
        var user = context.user;

        return "Minor activities by " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.getMinorOutboxStream(callback);
    },
    addProxyFinisher
);

var userInbox = activityFeed(
    function(context) {
        var user = context.user;
        return "api/user/" + user.nickname + "/inbox";
    },
    function(context) {
        var user = context.user;
        return "Activities for " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.getInboxStream(callback);
    },
    addProxyFinisher
);

var userMajorInbox = activityFeed(
    function(context) {
        var user = context.user;
        return "api/user/" + user.nickname + "/inbox/major";
    },
    function(context) {
        var user = context.user;
        return "Major activities for " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.getMajorInboxStream(callback);
    },
    majorFinishers
);

var userMinorInbox = activityFeed(
    function(context) {
        var user = context.user;
        return "api/user/" + user.nickname + "/inbox/minor";
    },
    function(context) {
        var user = context.user;
        return "Minor activities for " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.getMinorInboxStream(callback);
    },
    addProxyFinisher
);

var userDirectInbox = activityFeed(
    function(context) {
        var user = context.user;
        return "api/user/" + user.nickname + "/inbox/direct";
    },
    function(context) {
        var user = context.user;
        return "Activities directly for " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.getDirectInboxStream(callback);
    },
    addProxyFinisher
);

var userMajorDirectInbox = activityFeed(
    function(context) {
        var user = context.user;
        return "api/user/" + user.nickname + "/inbox/direct/major";
    },
    function(context) {
        var user = context.user;
        return "Major activities directly for " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.getMajorDirectInboxStream(callback);
    },
    majorFinishers
);

var userMinorDirectInbox = activityFeed(
    function(context) {
        var user = context.user;
        return "api/user/" + user.nickname + "/inbox/direct/minor";
    },
    function(context) {
        var user = context.user;

        return "Minor activities directly for " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.getMinorDirectInboxStream(callback);
    },
    addProxyFinisher
);

var userFollowers = personFeed(
    function(context) {
        var user = context.user;
        return "api/user/" + user.nickname + "/followers";
    },
    function(context) {
        var user = context.user;
        return "Followers for " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.followersStream(callback);
    },
    function(context, principal, collection, callback) {
        var user = context.user;
        collection.author = user.profile;
        if (collection.author) {
            collection.author.sanitize();
        }
        addFollowed(principal, collection.items, callback);
    }
);

var userFollowing = personFeed(
    function(context) {
        var user = context.user;
        return "api/user/" + user.nickname + "/following";
    },
    function(context) {
        var user = context.user;
        return "Following for " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.followingStream(callback);
    },
    function(context, principal, collection, callback) {
        var user = context.user;
        collection.author = user.profile;
        if (collection.author) {
            collection.author.sanitize();
        }
        addFollowed(principal, collection.items, callback);
    }
);

var userFavorites = objectFeed(
    function(context) {
        var user = context.user;
        return "api/user/" + user.nickname + "/favorites";
    },
    function(context) {
        var user = context.user;
        return "Things that " + (user.profile.displayName || user.nickname) + " has favorited";
    },
    function(context, callback) {
        var user = context.user;
        user.favoritesStream(callback);
    },
    function(context, principal, collection, callback) {
        var user = context.user;
        collection.author = user.profile;
        if (collection.author) {
            collection.author.sanitize();
        }
        Step(
            function() {
                // Add the first few replies for each object
                firstFewReplies(principal, collection.items, this.parallel());

                // Add the first few replies for each object

                firstFewShares(principal, collection.items, this.parallel());

                // Add the first few "likers" for each object

                addLikers(principal, collection.items, this.parallel());

                // Add the shared flag for each object

                addShared(principal, collection.items, this.parallel());

                // Add the liked flag for each object

                addLiked(principal, collection.items, this.parallel());

                // Add the proxy URLs for each object

                addProxyObjects(principal, collection.items, this.parallel());
            },
            function(err) {
                callback(err);
            }
        );
    }
);

var userUploads = objectFeed(
    function(context) {
        var user = context.user;
        return "api/user/" + user.nickname + "/uploads";
    },
    function(context) {
        var user = context.user;
        return "Uploads by " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user;
        user.uploadsStream(callback);
    },
    function(context, principal, collection, callback) {
        callback(null);
    });

var objectLikes = personFeed(
    function(context) {
        var type = context.type,
            obj = context.obj;
        return "api/" + type + "/" + obj._uuid + "/likes";
    },
    function(context) {
        var obj = context.obj;
        return "People who like " + obj.displayName;
    },
    function(context, callback) {
        var obj = context.obj;
        obj.getFavoritersStream(callback);
    },
    function(context, principal, collection, callback) {
        callback(null);
    }
);

var objectReplies = objectFeed(
    function(context) {
        var type = context.type,
            obj = context.obj;
        return "api/" + type + "/" + obj._uuid + "/replies";
    },
    function(context) {
        var obj = context.obj;
        return "Replies to " + ((obj.displayName) ? obj.displayName : obj.id);
    },
    function(context, callback) {
        var obj = context.obj;
        obj.getRepliesStream(callback);
    },
    function(context, principal, collection, callback) {
        _.each(collection.items, function(obj) {
            delete obj.inReplyTo;
        });
        Step(
            function() {
                addLiked(principal, collection.items, this.parallel());
                addLikers(principal, collection.items, this.parallel());
            },
            callback
        );
    }
);

var objectShares = objectFeed(
    function(context) {
        var type = context.type,
            obj = context.obj;
        return "api/" + type + "/" + obj._uuid + "/shares";
    },
    function(context) {
        var obj = context.obj;
        return "Shares of " + ((obj.displayName) ? obj.displayName : obj.id);
    },
    function(context, callback) {
        var obj = context.obj;
        obj.getSharesStream(callback);
    },
    function(context, principal, collection, callback) {
        callback(null);
    }
);

var collectionMembers = objectFeed(
    function(context) {
        var coll = context.collection;
        return "/api/collection/"+coll._uuid+"/members";
    },
    function(context) {
        var coll = context.collection;
        return "Members of " + (coll.displayName || "a collection") + " by " + coll.author.displayName;
    },
    function(context, callback) {
        var coll = context.collection;
        coll.getStream(callback);
    },
    function(context, principal, collection, callback) {

        var coll = context.collection,
            base = "/api/collection/"+coll._uuid+"/members",
            prevParams,
            nextParams,
            first,
            last;

        collection.author = coll.author;

        if (collection.author) {
            collection.author.sanitize();
        }

        if (collection.items.length > 0) {

            if (!collection.links) {
                collection.links = {};
            }

            first = collection.items[0];

            prevParams = {since: first.id};

            if (!collection.objectTypes ||
                collection.objectTypes.length != 1 ||
                first.objectType != collection.objectTypes[0]) {
                prevParams.type = first.objectType;
            }

            collection.links.prev = {
                href: URLMaker.makeURL(base, prevParams)
            };

            if (collection.items.length < collection.totalItems) {

                last = collection.items[collection.items.length - 1];

                nextParams = {before: last.id};

                if (!collection.objectTypes ||
                    collection.objectTypes.length != 1 ||
                    last.objectType != collection.objectTypes[0]) {
                    nextParams.type = last.objectType;
                }

                collection.links.next = {
                    href: URLMaker.makeURL(base, nextParams)
                };
            }
        }

        Step(
            function() {
                var followable;

                // Add the first few replies for each object

                firstFewReplies(principal, collection.items, this.parallel());

                // Add the first few shares for each object

                firstFewShares(principal, collection.items, this.parallel());

                // Add the first few "likers" for each object

                addLikers(principal, collection.items, this.parallel());

                // Add whether the current user likes the items

                addLiked(principal, collection.items, this.parallel());

                // Add the followed flag to applicable objects

                followable = _.filter(collection.items, function(obj) {
                    return obj.isFollowable();
                });

                addFollowed(principal, followable, this.parallel());

                // Add proxy URLs to applicable objects
                addProxyObjects(principal, collection.items, this.parallel());
            },
            callback
        );
    }
);

var userLists = collectionFeed(
    function(context) {
        var user = context.user,
            type = context.type;
        return "api/user/" + user.nickname + "/lists/" + type;
    },
    function(context) {
        var user = context.user,
            type = context.type;
        return "Collections of " + type + "s for " + (user.profile.displayName || user.nickname);
    },
    function(context, callback) {
        var user = context.user,
            type = context.type;
        user.getLists(type, callback);
    },
    function(context, principal, collection, callback) {
        var user = context.user;
        collection.author = user.profile;
        callback(null);
    }
);

var groupMembers = personFeed(
    function(context) {
        var group = context.group;
        return "api/group/" + group._uuid + "/members";
    },
    function(context) {
        var group = context.group;
        return "Members of " + group.displayName;
    },
    function(context, callback) {
        var group = context.group;
        group.getMembersStream(callback);
    },
    function(context, principal, collection, callback) {
        callback(null);
    }
);

var groupDocuments = objectFeed(
    function(context) {
        var group = context.group;
        return "api/group/" + group._uuid + "/documents";
    },
    function(context) {
        var group = context.group;
        return "Documents of " + group.displayName;
    },
    function(context, callback) {
        var group = context.group;
        group.getDocumentsStream(callback);
    },
    function(context, principal, collection, callback) {
        Step(
            function() {
                // Add the first few replies for each object
                firstFewReplies(principal, collection.items, this.parallel());

                // Add the first few replies for each object

                firstFewShares(principal, collection.items, this.parallel());

                // Add the first few "likers" for each object

                addLikers(principal, collection.items, this.parallel());

                // Add the shared flag for each object

                addShared(principal, collection.items, this.parallel());

                // Add the liked flag for each object

                addLiked(principal, collection.items, this.parallel());

                // Add the proxy URLs for each object

                addProxyObjects(principal, collection.items, this.parallel());
            },
            function(err) {
                callback(err);
            }
        );
    }
);

var groupInbox = activityFeed(
    function(context) {
        var group = context.group;
        return "api/group/" + group._uuid + "/inbox";
    },
    function(context) {
        var group = context.group;
        return "Activities for " + (group.displayName || "a group");
    },
    function(context, callback) {
        var group = context.group;
        group.getInboxStream(callback);
    },
    majorFinishers
);

exports.userStream = userStream;
exports.userMajorStream = userMajorStream;
exports.userMinorStream = userMinorStream;
exports.userInbox = userInbox;
exports.userMajorInbox = userMajorInbox;
exports.userMinorInbox = userMinorInbox;
exports.userDirectInbox = userDirectInbox;
exports.userMajorDirectInbox = userMajorDirectInbox;
exports.userMinorDirectInbox = userMinorDirectInbox;
exports.userFollowers = userFollowers;
exports.userFollowing = userFollowing;
exports.userFavorites = userFavorites;
exports.userUploads = userUploads;
exports.objectLikes = objectLikes;
exports.objectReplies = objectReplies;
exports.objectShares = objectShares;
exports.collectionMembers = collectionMembers;
exports.userLists = userLists;
exports.groupMembers = groupMembers;
exports.groupInbox = groupInbox;
exports.groupDocuments = groupDocuments;
