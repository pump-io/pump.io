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
    validator = require("validator"),
    path = require("path"),
    fs = require("fs"),
    mkdirp = require("mkdirp"),
    OAuth = require("oauth-evanp").OAuth,
    check = validator.check,
    sanitize = validator.sanitize,
    FilteredStream = require("../lib/filteredstream").FilteredStream,
    filters = require("../lib/filters"),
    recipientsOnly = filters.recipientsOnly,
    publicOnly = filters.publicOnly,
    objectRecipientsOnly = filters.objectRecipientsOnly,
    objectPublicOnly = filters.objectPublicOnly,
    idRecipientsOnly = filters.idRecipientsOnly,
    idPublicOnly = filters.idPublicOnly,
    version = require("../lib/version").version,
    HTTPError = require("../lib/httperror").HTTPError,
    Stamper = require("../lib/stamper").Stamper,
    Mailer = require("../lib/mailer"),
    Scrubber = require("../lib/scrubber"),
    ActivitySpam = require("../lib/activityspam"),
    Activity = require("../lib/model/activity").Activity,
    AppError = require("../lib/model/activity").AppError,
    Collection = require("../lib/model/collection").Collection,
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    Confirmation = require("../lib/model/confirmation").Confirmation,
    User = require("../lib/model/user").User,
    Person = require("../lib/model/person").Person,
    Edge = require("../lib/model/edge").Edge,
    Favorite = require("../lib/model/favorite").Favorite,
    Proxy = require("../lib/model/proxy").Proxy,
    Credentials = require("../lib/model/credentials").Credentials,
    stream = require("../lib/model/stream"),
    Stream = stream.Stream,
    NotInStreamError = stream.NotInStreamError,
    URLMaker = require("../lib/urlmaker").URLMaker,
    Distributor = require("../lib/distributor"),
    mw = require("../lib/middleware"),
    authc = require("../lib/authc"),
    omw = require("../lib/objectmiddleware"),
    randomString = require("../lib/randomstring").randomString,
    finishers = require("../lib/finishers"),
    mm = require("../lib/mimemap"),
    saveUpload = require("../lib/saveupload").saveUpload,
    reqUser = mw.reqUser,
    reqGenerator = mw.reqGenerator,
    sameUser = mw.sameUser,
    clientAuth = authc.clientAuth,
    userAuth = authc.userAuth,
    remoteUserAuth = authc.remoteUserAuth,
    remoteWriteOAuth = authc.remoteWriteOAuth,
    noneWriteOAuth = authc.noneWriteOAuth,
    userWriteOAuth = authc.userWriteOAuth,
    userReadAuth = authc.userReadAuth,
    anyReadAuth = authc.anyReadAuth,
    setPrincipal = authc.setPrincipal,
    fileContent = mw.fileContent,
    requestObject = omw.requestObject,
    authorOnly = omw.authorOnly,
    authorOrRecipient = omw.authorOrRecipient,
    NoSuchThingError = databank.NoSuchThingError,
    AlreadyExistsError = databank.AlreadyExistsError,
    NoSuchItemError = databank.NoSuchItemError,
    addFollowedFinisher = finishers.addFollowedFinisher,
    addFollowed = finishers.addFollowed,
    addLikedFinisher = finishers.addLikedFinisher,
    addLiked = finishers.addLiked,
    addLikersFinisher = finishers.addLikersFinisher,
    addLikers = finishers.addLikers,
    addSharedFinisher = finishers.addSharedFinisher,
    addShared = finishers.addShared,
    addProxyFinisher = finishers.addProxyFinisher,
    addProxy = finishers.addProxy,
    addProxyObjects = finishers.addProxyObjects,
    firstFewRepliesFinisher = finishers.firstFewRepliesFinisher,
    firstFewReplies = finishers.firstFewReplies,
    firstFewSharesFinisher = finishers.firstFewSharesFinisher,
    firstFewShares = finishers.firstFewShares,
    doFinishers = finishers.doFinishers,
    typeToClass = mm.typeToClass,
    typeToExt = mm.typeToExt,
    extToType = mm.extToType;

var getStream = function(str, args, collection, principal, callback) {

    Step(
        function() {
            str.count(this);
        },
        function(err, totalItems) {
            if (err) throw err;
            collection.totalItems = totalItems;
            if (totalItems === 0) {
                callback(null);
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
            Activity.readArray(ids, this);
        },
        function(err, activities) {
            if (err) {
                callback(err);
            } else {
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
                callback(null);
            }
        }
    );
};

var filteredFeed = function(urlmaker, titlemaker, streammaker, finisher) {

    return function(user, principal, args, callback) {

        var url = urlmaker(user),
            collection = {
                author: user.profile,
                displayName: titlemaker(user),
                id: url,
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

        Step(
            function() {
                streammaker(user, this);
            },
            function(err, results) {
                if (err) {
                    if (err.name == "NoSuchThingError") {
                        collection.totalItems = 0;
                        callback(collection);
                    } else {
                        throw err;
                    }
                } else {
                    // Skip filtering if remote user == author
                    if (principal && principal.id == user.profile.id) {
                        str = results;
                    } else if (!principal) {
                        // XXX: keep a separate stream instead of filtering
                        str = new FilteredStream(results, publicOnly);
                    } else {
                        str = new FilteredStream(results, recipientsOnly(principal));
                    }

                    getStream(str, args, collection, principal, this);
                }
            },
            function(err) {
                if (err) throw err;
                if (finisher) {
                    finisher(user, collection, this);
                } else {
                    this(null);
                }
            },
            function(err) {
                if (err) {
                    callback(err, null);
                } else {
                    collection.items.forEach(function(act) {
                        delete act.actor;
                    });
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

var userStream = filteredFeed(
    function(user) {
        return URLMaker.makeURL("api/user/" + user.nickname + "/feed");
    },
    function(user) {
        return "Activities by " + (user.profile.displayName || user.nickname);
    },
    function(user, callback) {
        user.getOutboxStream(callback);
    },
    addProxyFinisher
);

var userMajorStream = filteredFeed(
    function(user) {
        return URLMaker.makeURL("api/user/" + user.nickname + "/feed/major");
    },
    function(user) {
        return "Major activities by " + (user.profile.displayName || user.nickname);
    },
    function(user, callback) {
        user.getMajorOutboxStream(callback);
    },
    majorFinishers
);

var userMinorStream = filteredFeed(
    function(user) {
        return URLMaker.makeURL("api/user/" + user.nickname + "/feed/minor");
    },
    function(user) {
        return "Minor activities by " + (user.profile.displayName || user.nickname);
    },
    function(user, callback) {
        user.getMinorOutboxStream(callback);
    },
    addProxyFinisher
);

var userInbox = filteredFeed(
    function(user) {
        return URLMaker.makeURL("api/user/" + user.nickname + "/inbox");
    },
    function(user) {
        return "Activities for " + (user.profile.displayName || user.nickname);
    },
    function(user, callback) {
        user.getInboxStream(callback);
    },
    addProxyFinisher
);

var userMajorInbox = filteredFeed(
    function(user) {
        return URLMaker.makeURL("api/user/" + user.nickname + "/inbox/major");
    },
    function(user) {
        return "Major activities for " + (user.profile.displayName || user.nickname);
    },
    function(user, callback) {
        user.getMajorInboxStream(callback);
    },
    majorFinishers
);

var userMinorInbox = filteredFeed(
    function(user) {
        return URLMaker.makeURL("api/user/" + user.nickname + "/inbox/minor");
    },
    function(user) {
        return "Minor activities for " + (user.profile.displayName || user.nickname);
    },
    function(user, callback) {
        user.getMinorInboxStream(callback);
    },
    addProxyFinisher
);

var userDirectInbox = filteredFeed(
    function(user) {
        return URLMaker.makeURL("api/user/" + user.nickname + "/inbox/direct");
    },
    function(user) {
        return "Activities directly for " + (user.profile.displayName || user.nickname);
    },
    function(user, callback) {
        user.getDirectInboxStream(callback);
    },
    addProxyFinisher
);

var userMajorDirectInbox = filteredFeed(
    function(user) {
        return URLMaker.makeURL("api/user/" + user.nickname + "/inbox/direct/major");
    },
    function(user) {
        return "Major activities directly for " + (user.profile.displayName || user.nickname);
    },
    function(user, callback) {
        user.getMajorDirectInboxStream(callback);
    },
    majorFinishers
);

var userMinorDirectInbox = filteredFeed(
    function(user) {
        return URLMaker.makeURL("api/user/" + user.nickname + "/inbox/direct/minor");
    },
    function(user) {
        return "Minor activities directly for " + (user.profile.displayName || user.nickname);
    },
    function(user, callback) {
        user.getMinorDirectInboxStream(callback);
    },
    addProxyFinisher
);

module.exports.userStream = userStream;
module.exports.userMajorStream = userMajorStream;
module.exports.userMinorStream = userMinorStream;
module.exports.userInbox = userInbox;
module.exports.userMajorInbox = userMajorInbox;
module.exports.userMinorInbox = userMinorInbox;
module.exports.userDirectInbox = userDirectInbox;
module.exports.userMajorDirectInbox = userMajorDirectInbox;
module.exports.userMinorDirectInbox = userMinorDirectInbox;
