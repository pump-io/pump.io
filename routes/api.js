// routes/api.js
//
// The beating heart of a pumpin' good time
//
// Copyright 2011-2012, StatusNet Inc.
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
    check = validator.check,
    sanitize = validator.sanitize,
    FilteredStream = require("../lib/filteredstream").FilteredStream,
    filters = require("../lib/filters"),
    recipientsOnly = filters.recipientsOnly,
    publicOnly = filters.publicOnly,
    HTTPError = require("../lib/httperror").HTTPError,
    Stamper = require("../lib/stamper").Stamper,
    Activity = require("../lib/model/activity").Activity,
    AppError = require("../lib/model/activity").AppError,
    Collection = require("../lib/model/collection").Collection,
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    User = require("../lib/model/user").User,
    Edge = require("../lib/model/edge").Edge,
    stream = require("../lib/model/stream"),
    Stream = stream.Stream,
    NotInStreamError = stream.NotInStreamError,
    URLMaker = require("../lib/urlmaker").URLMaker,
    Distributor = require("../lib/distributor"),
    mw = require("../lib/middleware"),
    reqUser = mw.reqUser,
    sameUser = mw.sameUser,
    clientAuth = mw.clientAuth,
    userAuth = mw.userAuth,
    remoteUserAuth = mw.remoteUserAuth,
    NoSuchThingError = databank.NoSuchThingError,
    AlreadyExistsError = databank.AlreadyExistsError,
    NoSuchItemError = databank.NoSuchItemError,
    DEFAULT_ITEMS = 20,
    DEFAULT_ACTIVITIES = DEFAULT_ITEMS,
    DEFAULT_FAVORITES = DEFAULT_ITEMS,
    DEFAULT_LIKES = DEFAULT_ITEMS,
    DEFAULT_REPLIES = DEFAULT_ITEMS,
    DEFAULT_FOLLOWERS = DEFAULT_ITEMS,
    DEFAULT_FOLLOWING = DEFAULT_ITEMS,
    DEFAULT_USERS = DEFAULT_ITEMS,
    DEFAULT_LISTS = DEFAULT_ITEMS,
    MAX_ITEMS = DEFAULT_ITEMS * 10,
    MAX_ACTIVITIES = MAX_ITEMS,
    MAX_FAVORITES = MAX_ITEMS,
    MAX_LIKES = MAX_ITEMS,
    MAX_REPLIES = MAX_ITEMS,
    MAX_FOLLOWERS = MAX_ITEMS,
    MAX_FOLLOWING = MAX_ITEMS,
    MAX_USERS = MAX_ITEMS,
    MAX_LISTS = MAX_ITEMS;

// Initialize the app controller

var addRoutes = function(app) {

    var i = 0, url, type, authz;

    // Users
    app.get("/api/user/:nickname", clientAuth, reqUser, getUser);
    app.put("/api/user/:nickname", userAuth, reqUser, sameUser, putUser);
    app.del("/api/user/:nickname", userAuth, reqUser, sameUser, delUser);

    // Feeds

    app.get("/api/user/:nickname/feed", clientAuth, reqUser, userStream);
    app.post("/api/user/:nickname/feed", userAuth, reqUser, sameUser, postActivity);

    app.get("/api/user/:nickname/feed/major", clientAuth, reqUser, userMajorStream);
    app.get("/api/user/:nickname/feed/minor", clientAuth, reqUser, userMinorStream);

    // Inboxen

    app.get("/api/user/:nickname/inbox", userAuth, reqUser, sameUser, userInbox);
    app.post("/api/user/:nickname/inbox", remoteUserAuth, reqUser, postToInbox);

    app.get("/api/user/:nickname/inbox/major", userAuth, reqUser, sameUser, userMajorInbox);
    app.get("/api/user/:nickname/inbox/minor", userAuth, reqUser, sameUser, userMinorInbox);
    app.get("/api/user/:nickname/inbox/direct", userAuth, reqUser, sameUser, userDirectInbox);
    app.get("/api/user/:nickname/inbox/direct/major", userAuth, reqUser, sameUser, userMajorDirectInbox);
    app.get("/api/user/:nickname/inbox/direct/minor", userAuth, reqUser, sameUser, userMinorDirectInbox);

    app.get("/api/user/:nickname/followers", clientAuth, reqUser, userFollowers);

    app.get("/api/user/:nickname/following", clientAuth, reqUser, userFollowing);
    app.post("/api/user/:nickname/following", clientAuth, reqUser, sameUser, newFollow);

    app.get("/api/user/:nickname/favorites", clientAuth, reqUser, userFavorites);
    app.post("/api/user/:nickname/favorites", clientAuth, reqUser, sameUser, newFavorite);

    app.get("/api/user/:nickname/lists", userAuth, reqUser, sameUser, userLists);

    for (i = 0; i < ActivityObject.objectTypes.length; i++) {

        type = ActivityObject.objectTypes[i];

        url = "/api/" + type + "/" + ":uuid";

        // person

        if (type === "person") {
            authz = userOnly;
        } else {
            authz = authorOnly(type);
        }

        app.get(url, clientAuth, requester(type), authorOrRecipient(type), getter(type));
        app.put(url, userAuth, requester(type), authz, putter(type));
        app.del(url, userAuth, requester(type), authz, deleter(type));

        app.get("/api/" + type + "/" + ":uuid/likes", clientAuth, requester(type), authorOrRecipient(type), likes(type));
        app.get("/api/" + type + "/" + ":uuid/replies", clientAuth, requester(type), authorOrRecipient(type), replies(type));
    }
    
    // Activities

    app.get("/api/activity/:uuid", clientAuth, reqActivity, actorOrRecipient, getActivity);
    app.put("/api/activity/:uuid", userAuth, reqActivity, actorOnly, putActivity);
    app.del("/api/activity/:uuid", userAuth, reqActivity, actorOnly, delActivity);

    // Global user list

    app.get("/api/users", clientAuth, listUsers);
    app.post("/api/users", clientAuth, createUser);
};

exports.addRoutes = addRoutes;

var requester = function(type) {

    var Cls = ActivityObject.toClass(type);

    return function(req, res, next) {
        var uuid = req.params.uuid,
            obj = null;

        Cls.search({"uuid": uuid}, function(err, results) {
            if (err) {
                next(err);
            } else if (results.length === 0) {
                next(new HTTPError("Can't find a " + type + " with ID = " + uuid, 404));
            } else if (results.length > 1) {
                next(new HTTPError("Too many " + type + " objects with ID = " + req.params.uuid, 500));
            } else {
                obj = results[0];
                if (obj.hasOwnProperty("deleted")) {
                    next(new HTTPError("Deleted", 410));
                } else {
                    obj.expand(function(err) {
                        if (err) {
                            next(err);
                        } else {
                            req[type] = obj;
                            next();
                        }
                    });
                }
            }
        });
    };
};

var userOnly = function(req, res, next) {
    var person = req.person,
        user = req.remoteUser;

    if (person && user && user.profile && person.id === user.profile.id && user.profile.objectType === "person") { 
        next();
    } else {
        next(new HTTPError("Only the user can modify this profile.", 403));
    }
};

var authorOnly = function(type) {

    return function(req, res, next) {
        var obj = req[type];

        if (obj && obj.author && obj.author.id == req.remoteUser.profile.id) {
            next();
        } else {
            next(new HTTPError("Only the author can modify this object.", 403));
        }
    };
};

var authorOrRecipient = function(type) {

    return function(req, res, next) {
        var obj = req[type],
            user = req.remoteUser,
            person = (user) ? user.profile : null;

        if (obj && obj.author && person && obj.author.id == person.id) {
            next();
        } else {
            Step(
                function() {
                    Activity.postOf(obj, this);
                },
                function(err, act) {
                    if (err) throw err;
                    act.checkRecipient(person, this);
                },
                function(err, isRecipient) {
                    if (err) {
                        next(err);
                    } else if (isRecipient) {
                        next();
                    } else {
                        next(new HTTPError("Only the author and recipients can view this object.", 403));
                    }
                }
            );
        }
    };
};

var actorOnly = function(req, res, next) {
    var act = req.activity;

    if (act && act.actor && act.actor.id == req.remoteUser.profile.id) {
        next();
    } else {
        next(new HTTPError("Only the actor can modify this object.", 403));
    }
};

var actorOrRecipient = function(req, res, next) {

    var act = req.activity,
        person = (req.remoteUser) ? req.remoteUser.profile : null;

    if (act && act.actor && person && act.actor.id == person.id) {
        next();
    } else {
        act.checkRecipient(person, function(err, isRecipient) {
            if (err) {
                next(err);
            } else if (!isRecipient) {
                next(new HTTPError("Only the actor and recipients can view this activity.", 403));
            } else {
                next();
            }
        });
    }
};

var getter = function(type) {
    return function(req, res, next) {
        var obj = req[type];
        Step(
            function() {
                obj.expandFeeds(this);
            },
            function(err) {
                if (err) {
                    next(err);
                } else {
                    res.json(obj);
                }
            }
        );
    };
};

var putter = function(type) {
    return function(req, res, next) {
        var obj = req[type],
            act = new Activity({
                actor: req.remoteUser.profile,
                verb: "update",
                object: _(obj).extend(req.body)
            });

        Step(
            function() {
                newActivity(act, req.remoteUser, this);
            },
            function(err, act) {
                var d;
                if (err) {
                    next(err);
                } else {
                    res.json(act.object);
                    d = new Distributor(act);
                    d.distribute(function(err) {});
                }
            }
        );
    };
};

var deleter = function(type) {
    return function(req, res, next) {
        var obj = req[type],
            act = new Activity({
                actor: req.remoteUser.profile,
                verb: "delete",
                object: obj
            });

        Step(
            function() {
                newActivity(act, req.remoteUser, this);
            },
            function(err, act) {
                var d;
                if (err) {
                    next(err);
                } else {
                    res.json("Deleted");
                    d = new Distributor(act);
                    d.distribute(function(err) {});
                }
            }
        );
    };
};

var likes = function(type) {
    return function(req, res, next) {
        var obj = req[type];

        var collection = {
            displayName: "People who like " + obj.displayName,
            id: URLMaker.makeURL("api/" + type + "/" + obj.uuid + "/likes"),
            items: []
        };

        var args;

        try {
            args = streamArgs(req, DEFAULT_LIKES, MAX_LIKES);
        } catch (e) {
            next(e);
            return;
        }

        Step(
            function() {
                obj.favoritersCount(this);
            },
            function(err, count) {
                if (err) {
                    if (err.name == "NoSuchThingError") {
                        collection.totalItems = 0;
                        res.json(collection);
                    } else {
                        throw err;
                    }
                }
                collection.totalItems = count;
                obj.getFavoriters(args.start, args.end, this);
            },
            function(err, likers) {
                if (err) {
                    next(err);
                } else {
                    collection.items = likers;
                    res.json(collection);
                }
            }
        );
    };
};

var replies = function(type) {
    return function(req, res, next) {
        var obj = req[type];

        var collection = {
            displayName: "Replies to " + ((obj.displayName) ? obj.displayName : obj.id),
            id: URLMaker.makeURL("api/" + type + "/" + obj.uuid + "/replies"),
            items: []
        };

        var args;

        try {
            args = streamArgs(req, DEFAULT_REPLIES, MAX_REPLIES);
        } catch (e) {
            next(e);
            return;
        }

        Step(
            function() {
                obj.repliesCount(this);
            },
            function(err, count) {
                if (err) {
                    if (err.name == "NoSuchThingError") {
                        collection.totalItems = 0;
                        res.json(collection);
                    } else {
                        throw err;
                    }
                }
                collection.totalItems = count;
                obj.getReplies(args.start, args.end, this);
            },
            function(err, replies) {
                var i = 0;
                if (err) {
                    next(err);
                } else {
                    // Trim the IRT since it's implied
                    for (i = 0; i < replies.length; i++) {
                        delete replies[i].inReplyTo;
                    }
                    collection.items = replies;
                    res.json(collection);
                }
            }
        );
    };
};

var getUser = function(req, res, next) {

    Step(
        function() {
            req.user.profile.expandFeeds(this);
        },
        function(err) {
            if (err) next(err);
            res.json(req.user);
        }
    );
};

var putUser = function(req, res, next) {

    var newUser = req.body;

    req.user.update(newUser, function(err, saved) {
        if (err) {
            next(err);
        } else {
            saved.sanitize();
            res.json(saved);
        }
    });
};

var delUser = function(req, res, next) {

    var user = req.user;

    Step(
        function() {
            user.del(this);
        },
        function(err) {
            if (err) throw err;
            usersStream(this);
        },
        function(err, str) {
            if (err) throw err;
            str.remove(user.nickname, this);
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                res.json("Deleted.");
            }
        }
    );
};

var reqActivity = function(req, res, next) {
    var act = null,
        uuid = req.params.uuid;
    Activity.search({"uuid": uuid}, function(err, results) {
        if (err) {
            next(err);
        } else if (results.length === 0) { // not found
            next(new HTTPError("Can't find an activity with id " + uuid, 404));
        } else if (results.length > 1) {
            next(new HTTPError("Too many activities with ID = " + req.params.uuid, 500));
        } else {
            act = results[0];
            if (act.hasOwnProperty("deleted")) {
                next(new HTTPError("Deleted", 410));
            } else {
                act.expand(function(err) {
                    if (err) {
                        next(err);
                    } else {
                        req.activity = act;
                        next();
                    }
                });
            }
        }
    });
};

var getActivity = function(req, res, next) {
    var user = req.remoteUser,
        act = req.activity;

    act.sanitize(user);

    res.json(act);
};

var putActivity = function(req, res, next) {
    req.activity.update(req.body, function(err, result) {
        if (err) {
            next(err);
        } else {
            res.json(result);
        }
    });
};

var delActivity = function(req, res, next) {
    var act = req.activity;
    Step(
        function() {
            act.efface(this);
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                res.json("Deleted");
            }
        }
    );
};

// Get the stream of all users

var usersStream = function(callback) {
    
    Step(
        function() {
            Stream.get("user:all", this);
        },
        function(err, str) {
            if (err) {
                if (err.name == "NoSuchThingError") {
                    Stream.create({name: "user:all"}, this);
                } else {
                    throw err;
                }
            } else {
                callback(null, str);
            }
        },
        function(err, str) {
            if (err) {
                if (err.name == "AlreadyExistsError") {
                    Stream.get("user:all", callback);
                } else {
                    callback(err);
                }
            } else {
                callback(null, str);
            }
        }
    );
};

var createUser = function(req, res, next) {

    var user;

    Step(
        function() {
            User.create(req.body, this);
        },
        function(err, value) {
            if (err) {
                // Try to be more specific
                if (err instanceof User.BadPasswordError) {
                    throw new HTTPError(err.message, 400);
                } else if (err instanceof User.BadNicknameError) {
                    throw new HTTPError(err.message, 400);
                } else if (err.name == "AlreadyExistsError") {
                    throw new HTTPError(err.message, 409); // conflict
                } else {
                    throw err;
                }
            }
            user = value;
            usersStream(this);
        },
        function(err, str) {
            if (err) throw err;
            str.deliver(user.nickname, this);
        },
        function(err) {
            if (err) throw err;
            req.app.provider.newTokenPair(req.client, user, this);
        },
        function(err, pair) {
            if (err) {
                next(err);
            } else {
                // Hide the password for output
                user.sanitize();
                user.token = pair.access_token;
                user.secret = pair.token_secret;
                res.json(user);
            }
        }
    );
};

var listUsers = function(req, res, next) {

    var url = URLMaker.makeURL("api/users"),
        collection = {
            displayName: "Users of this service",
            id: url,
            objectTypes: ["user"],
            links: {
                first: url,
                self: url
            }
        };

    var args, str;

    try {
        args = streamArgs(req, DEFAULT_USERS, MAX_USERS);
    } catch (e) {
        next(e);
        return;
    }

    Step(
        function() {
            usersStream(this);
        },
        function(err, result) {
            if (err) throw err;
            str = result;
            str.count(this);
        },
        function(err, totalUsers) {
            if (err) throw err;
            collection.totalItems = totalUsers;
            if (totalUsers === 0) {
                collection.items = [];
                res.json(collection);
                return;
            } else {
                if (_(args).has("before")) {
                    str.getIDsGreaterThan(args.before, args.count, this);
                } else if (_(args).has("since")) {
                    str.getIDsLessThan(args.since, args.count, this);
                } else {
                    str.getIDs(args.start, args.end, this);
                }
            }
        },
        function(err, userIds) {
            if (err) throw err;
            User.readArray(userIds, this);
        },
        function(err, users) {
            var i;
            if (err) throw err;

            for (i = 0; i < users.length; i++) {
                users[i].sanitize();
            }

            collection.items = users;

            if (users.length > 0) {
                collection.links.prev = {
                    href: url + "?since=" + encodeURIComponent(users[0].nickname)
                };
                if ((_(args).has("start") && args.start + users.length < collection.totalItems) ||
                    (_(args).has("before") && users.length >= args.count) ||
                    (_(args).has("since"))) {
                    collection.links.next = {
                        href: url + "?before=" + encodeURIComponent(users[users.length-1].nickname)
                    };
                }
            }

            res.json(collection);
        }
    );
};

var postActivity = function(req, res, next) {

    var activity = new Activity(req.body);

    // Add a default actor

    if (!_(activity).has("actor")) {
        activity.actor = req.user.profile;
    }

    // If the actor is incorrect, error

    if (activity.actor.id !== req.user.profile.id) {
        next(new HTTPError("Invalid actor", 400));
        return;
    }

    // Default verb

    if (!_(activity).has("verb") || _(activity.verb).isNull()) {
        activity.verb = "post";
    }
    
    Step(
        function() {
            newActivity(activity, req.user, this);
        },
        function(err, activity) {
            var d;
            if (err) {
                next(err);
            } else {
                activity.sanitize();
                // ...then show (possibly modified) results.
                res.json(activity);
                // ...then distribute.
                d = new Distributor(activity);
                d.distribute(function(err) {});
            }
        }
    );
};

var postToInbox = function(req, res, next) {

    var activity = new Activity(req.body),
        user = req.user;

    // Check for actor

    if (!_(activity).has("actor")) {
        next(new HTTPError("Invalid actor", 400));
    }

    // If the actor is incorrect, error

    if (!ActivityObject.sameID(activity.actor.id, req.webfinger)) {
        next(new HTTPError("Invalid actor", 400));
        return;
    }

    // Default verb

    if (!_(activity).has("verb") || _(activity.verb).isNull()) {
        activity.verb = "post";
    }

    // Add a received timestamp

    activity.received = Stamper.stamp();

    // TODO: return a 202 Accepted here?

    Step(
        function() {
            // First, ensure recipients
            activity.ensureRecipients(this);
        },
        function(err) {
            if (err) throw err;
            // apply the activity
            activity.apply(null, this);
        },
        function(err) {
            if (err) {
                if (err.name == "AppError") {
                    throw new HTTPError(err.message, 400);
                } else if (err.name == "NoSuchThingError") {
                    throw new HTTPError(err.message, 400);
                } else if (err.name == "AlreadyExistsError") {
                    throw new HTTPError(err.message, 400);
                } else if (err.name == "NoSuchItemError") {
                    throw new HTTPError(err.message, 400);
                } else if (err.name == "NotInStreamError") {
                    throw new HTTPError(err.message, 400);
                } else {
                    throw err;
                }
            }
            // ...then persist...
            activity.save(this);
        },
        function(err, saved) {
            if (err) throw err;
            activity = saved;
            user.addToInbox(activity, this.parallel());
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                // ...then show (possibly modified) results.
                // XXX: don't distribute
                res.json(activity);
            }
        }
    );
};

var newActivity = function(activity, user, callback) {

    Step(
        function() {
            // First, ensure recipients
            activity.ensureRecipients(this);
        },
        function(err) {
            if (err) throw err;
            // First, apply the activity
            activity.apply(user.profile, this);
        },
        function(err) {
            if (err) {
                if (err.name == "AppError") {
                    throw new HTTPError(err.message, 400);
                } else if (err.name == "NoSuchThingError") {
                    throw new HTTPError(err.message, 400);
                } else if (err.name == "AlreadyExistsError") {
                    throw new HTTPError(err.message, 400);
                } else if (err.name == "NoSuchItemError") {
                    throw new HTTPError(err.message, 400);
                } else if (err.name == "NotInStreamError") {
                    throw new HTTPError(err.message, 400);
                } else {
                    throw err;
                }
            }
            // ...then persist...
            activity.save(this);
        },
        function(err, saved) {
            if (err) throw err;
            activity = saved;
            user.addToOutbox(activity, this.parallel());
            user.addToInbox(activity, this.parallel());
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, activity);
            }
        }
    );
};

var filteredFeedRoute = function(urlmaker, titlemaker, streammaker) {

    return function(req, res, next) {

        var url = urlmaker(req),
            collection = {
                author: req.user.profile,
                displayName: titlemaker(req),
                id: url,
                objectTypes: ["activity"],
                url: url,
                links: {
                    first: url,
                    self: url
                },
                items: []
            };

        var args, str, ids;

        try {
            args = streamArgs(req, DEFAULT_ACTIVITIES, MAX_ACTIVITIES);
        } catch (e) {
            next(e);
            return;
        }

        Step(
            function() {
                streammaker(req, this);
            },
            function(err, outbox) {
                if (err) {
                    if (err.name == "NoSuchThingError") {
                        collection.totalItems = 0;
                        res.json(collection);
                    } else {
                        throw err;
                    }
                } else {
                    // Skip filtering if remote user == author
                    if (req.remoteUser && req.remoteUser.profile.id == req.user.profile.id) {
                        str = outbox;
                    } else if (!req.remoteUser) {
                        // XXX: keep a separate stream instead of filtering
                        str = new FilteredStream(outbox, publicOnly);
                    } else {
                        str = new FilteredStream(outbox, recipientsOnly(req.remoteUser.profile));
                    }

                    getStream(str, args, collection, req.remoteUser, this);
                }
            },
            function(err) {
                if (err) {
                    next(err);
                } else {
                    collection.items.forEach(function(act) {
                        delete act.actor;
                    });
                    res.json(collection);
                }
            }
        );
    };
};

var userStream = filteredFeedRoute(
    function(req) {
        return URLMaker.makeURL("api/user/" + req.user.nickname + "/feed");
    },
    function(req) {
        return "Activities by " + (req.user.profile.displayName || req.user.nickname);
    },
    function(req, callback) {
        req.user.getOutboxStream(callback);
    }
);

var userMajorStream = filteredFeedRoute(
    function(req) {
        return URLMaker.makeURL("api/user/" + req.user.nickname + "/feed/major");
    },
    function(req) {
        return "Major activities by " + (req.user.profile.displayName || req.user.nickname);
    },
    function(req, callback) {
        req.user.getMajorOutboxStream(callback);
    }
);

var userMinorStream = filteredFeedRoute(
    function(req) {
        return URLMaker.makeURL("api/user/" + req.user.nickname + "/feed/minor");
    },
    function(req) {
        return "Minor activities by " + (req.user.profile.displayName || req.user.nickname);
    },
    function(req, callback) {
        req.user.getMinorOutboxStream(callback);
    }
);

var feedRoute = function(urlmaker, titlemaker, streamgetter) {

    return function(req, res, next) {

        var url = urlmaker(req),
            collection = {
                author: req.user.profile,
                displayName: titlemaker(req),
                id: url,
                objectTypes: ["activity"],
                url: url,
                links: {
                    first: url,
                    self: url
                },
                items: []
            };

        var args, str;

        try {
            args = streamArgs(req, DEFAULT_ACTIVITIES, MAX_ACTIVITIES);
        } catch (e) {
            next(e);
            return;
        }

        Step(
            function() {
                streamgetter(req, this);
            },
            function(err, inbox) {
                if (err) {
                    if (err.name == "NoSuchThingError") {
                        collection.totalItems = 0;
                        res.json(collection);
                    } else {
                        throw err;
                    }
                } else {
                    getStream(inbox, args, collection, req.remoteUser, this);
                }
            },
            function(err) {
                if (err) {
                    next(err);
                } else {
                    res.json(collection);
                }
            }
        );
    };
};

var userInbox = feedRoute(
    function(req) {
        return URLMaker.makeURL("api/user/" + req.user.nickname + "/inbox");
    },
    function(req) {
        return "Activities for " + (req.user.profile.displayName || req.user.nickname);
    },
    function(req, callback) {
        req.user.getInboxStream(callback);
    }
);

var userMajorInbox = feedRoute(
    function(req) {
        return URLMaker.makeURL("api/user/" + req.user.nickname + "/inbox/major");
    },
    function(req) {
        return "Major activities for " + (req.user.profile.displayName || req.user.nickname);
    },
    function(req, callback) {
        req.user.getMajorInboxStream(callback);
    }
);

var userMinorInbox = feedRoute(
    function(req) {
        return URLMaker.makeURL("api/user/" + req.user.nickname + "/inbox/minor");
    },
    function(req) {
        return "Minor activities for " + (req.user.profile.displayName || req.user.nickname);
    },
    function(req, callback) {
        req.user.getMinorInboxStream(callback);
    }
);

var userDirectInbox = feedRoute(
    function(req) {
        return URLMaker.makeURL("api/user/" + req.user.nickname + "/inbox/direct");
    },
    function(req) {
        return "Activities directly for " + (req.user.profile.displayName || req.user.nickname);
    },
    function(req, callback) {
        req.user.getDirectInboxStream(callback);
    }
);

var userMajorDirectInbox = feedRoute(
    function(req) {
        return URLMaker.makeURL("api/user/" + req.user.nickname + "/inbox/direct/major");
    },
    function(req) {
        return "Major activities directly for " + (req.user.profile.displayName || req.user.nickname);
    },
    function(req, callback) {
        req.user.getMajorDirectInboxStream(callback);
    }
);

var userMinorDirectInbox = feedRoute(
    function(req) {
        return URLMaker.makeURL("api/user/" + req.user.nickname + "/inbox/direct/minor");
    },
    function(req) {
        return "Minor activities directly for " + (req.user.profile.displayName || req.user.nickname);
    },
    function(req, callback) {
        req.user.getMinorDirectInboxStream(callback);
    }
);

var getStream = function(str, args, collection, user, callback) {

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
                    act.sanitize(user);
                });
                collection.items = activities;
                if (activities.length > 0) {
                    collection.links.prev = collection.url + "?since=" + encodeURIComponent(activities[0].id);
                    if ((_(args).has("start") && args.start + activities.length < collection.totalItems) ||
                        (_(args).has("before") && activities.length >= args.count) ||
                        (_(args).has("since"))) {
                        collection.links.next = collection.url + "?before=" + encodeURIComponent(activities[activities.length-1].id);
                    }
                }
                callback(null);
            }
        }
    );
};

var userFollowers = function(req, res, next) {
    var collection = {
        author: req.user.profile,
        displayName: "Followers for " + (req.user.profile.displayName || req.user.nickname),
        id: URLMaker.makeURL("api/user/" + req.user.nickname + "/followers"),
        objectTypes: ["person"],
        items: []
    };

    var args;

    try {
        args = streamArgs(req, DEFAULT_FOLLOWERS, MAX_FOLLOWERS);
    } catch (e) {
        next(e);
        return;
    }

    Step(
        function() {
            req.user.followerCount(this);
        },
        function(err, count) {
            if (err) {
                if (err.name == "NoSuchThingError") {
                    collection.totalItems = 0;
                    res.json(collection);
                } else {
                    throw err;
                }
            } else {
                collection.totalItems = count;
                req.user.getFollowers(args.start, args.end, this);
            }
        },
        function(err, people) {
            var base = "api/user/" + req.user.nickname + "/followers";
            if (err) {
                next(err);
            } else {
                collection.items = people;
                collection.startIndex = args.start;
                collection.itemsPerPage = args.count;

                collection.links = {
                    self: {
                        href: URLMaker.makeURL(base, {offset: args.start, count: args.count})
                    },
                    current: {
                        href: URLMaker.makeURL(base)
                    }
                };

                if (args.start > 0) {
                    collection.links.prev = {
                        href: URLMaker.makeURL(base, 
                                               {offset: Math.max(args.start-args.count, 0), 
                                                count: Math.min(args.count, args.start)})
                    };
                }

                if (args.start + people.length < collection.totalItems) {
                    collection.links.next = {
                        href: URLMaker.makeURL("api/user/" + req.user.nickname + "/following", 
                                               {offset: args.start+people.length, count: args.count})
                    };
                }
                res.json(collection);
            }
        }
    );
};

var userFollowing = function(req, res, next) {
    var collection = {
        author: req.user.profile,
        displayName: "People that " + (req.user.profile.displayName || req.user.nickname) + " is following",
        id: URLMaker.makeURL("api/user/" + req.user.nickname + "/following"),
        objectTypes: ["person"],
        items: []
    };

    var args;

    try {
        args = streamArgs(req, DEFAULT_FOLLOWING, MAX_FOLLOWING);
    } catch (e) {
        next(e);
        return;
    }

    Step(
        function() {
            req.user.followingCount(this);
        },
        function(err, count) {
            if (err) {
                if (err.name == "NoSuchThingError") {
                    collection.totalItems = 0;
                    res.json(collection);
                } else {
                    throw err;
                }
            } else {
                collection.totalItems = count;
                req.user.getFollowing(args.start, args.end, this);
            }
        },
        function(err, people) {
            var base = "api/user/" + req.user.nickname + "/following";
            if (err) {
                next(err);
            } else {
                collection.items = people;

                collection.startIndex = args.start;
                collection.itemsPerPage = args.count;

                collection.links = {
                    self: {
                        href: URLMaker.makeURL(base, {offset: args.start, count: args.count})
                    },
                    current: {
                        href: URLMaker.makeURL(base)
                    }
                };

                if (args.start > 0) {
                    collection.links.prev = {
                        href: URLMaker.makeURL(base, 
                                               {offset: Math.max(args.start-args.count, 0), 
                                                count: Math.min(args.count, args.start)})
                    };
                }

                if (args.start + people.length < collection.totalItems) {
                    collection.links.next = {
                        href: URLMaker.makeURL("api/user/" + req.user.nickname + "/following", 
                                               {offset: args.start+people.length, count: args.count})
                    };
                }
                
                res.json(collection);
            }
        }
    );
};

var newFollow = function(req, res, next) {
    var act = new Activity({
            actor: req.user.profile,
            verb: "follow",
            object: req.body
        });

    Step(
        function() {
            newActivity(act, req.user, this);
        },
        function(err, act) {
            var d;
            if (err) {
                next(err);
            } else {
                res.json(act.object);
                d = new Distributor(act);
                d.distribute(function(err) {});
            }
        }
    );
};

var userFavorites = function(req, res, next) {
    var collection = {
        author: req.user.profile,
        displayName: "Things that " + (req.user.profile.displayName || req.user.nickname) + " has favorited",
        id: URLMaker.makeURL("api/user/" + req.user.nickname + "/favorites"),
        items: []
    };

    var args;

    try {
        args = streamArgs(req, DEFAULT_FAVORITES, MAX_FAVORITES);
    } catch (e) {
        next(e);
        return;
    }

    Step(
        function() {
            req.user.favoritesCount(this);
        },
        function(err, count) {
            if (err) {
                if (err.name == "NoSuchThingError") {
                    collection.totalItems = 0;
                    res.json(collection);
                } else {
                    throw err;
                }
            } else {
                collection.totalItems = count;
                req.user.getFavorites(args.start, args.end, this);
            }
        },
        function(err, objects) {
            if (err) {
                next(err);
            } else {
                collection.items = objects;
                res.json(collection);
            }
        }
    );
};

var newFavorite = function(req, res, next) {
    var act = new Activity({
            actor: req.user.profile,
            verb: "favorite",
            object: req.body
        });

    Step(
        function() {
            newActivity(act, req.user, this);
        },
        function(err, act) {
            var d;
            if (err) {
                next(err);
            } else {
                res.json(act.object);
                d = new Distributor(act);
                d.distribute(function(err) {});
            }
        }
    );
};

var userLists = function(req, res, next) {
    var url = URLMaker.makeURL("api/user/" + req.user.nickname + "/lists"),
        collection = {
            author: req.user.profile,
            displayName: "Lists for " + (req.user.profile.displayName || req.user.nickname),
            id: url,
            objectTypes: ["collection"],
            url: url,
            links: {
                first: url,
                self: url
            },
            items: []
        };

    var args, lists;

    try {
        args = streamArgs(req, DEFAULT_LISTS, MAX_LISTS);
    } catch (e) {
        next(e);
        return;
    }

    Step(
        function() {
            req.user.getLists(this);
        },
        function(err, stream) {
            if (err) throw err;
            lists = stream;
            lists.count(this);
        },
        function(err, totalItems) {
            if (err) throw err;
            collection.totalItems = totalItems;
            if (totalItems === 0) {
                res.json(collection);
                return;
            }
            if (_(args).has("before")) {
                lists.getIDsGreaterThan(args.before, args.count, this);
            } else if (_(args).has("since")) {
                lists.getIDsLessThan(args.since, args.count, this);
            } else {
                lists.getIDs(args.start, args.end, this);
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
        function(err, collections) {
            if (err) {
                next(err);
            } else {
                collection.items = collections;
                if (collections.length > 0) {
                    collection.links.prev = collection.url + "?since=" + encodeURIComponent(collections[0].id);
                    if ((_(args).has("start") && args.start + collections.length < collection.totalItems) ||
                        (_(args).has("before") && collections.length >= args.count) ||
                        (_(args).has("since"))) {
                        collection.links.next = collection.url + "?before=" + 
                            encodeURIComponent(collections[collections.length-1].id);
                    }
                }
                res.json(collection);
            }
        }
    );
};

var notYetImplemented = function(req, res, next) {
    next(new HTTPError("Not yet implemented", 500));
};


// Since most stream endpoints take the same arguments,
// consolidate validation and parsing here

var streamArgs = function(req, defaultCount, maxCount) {

    var args = {};

    try {
        if (_(maxCount).isUndefined()) {
            maxCount = 10 * defaultCount;
        }

        if (_(req.query).has("count")) {
            check(req.query.count, "Count must be between 0 and " + maxCount).isInt().min(0).max(maxCount);
            args.count = sanitize(req.query.count).toInt();
        } else {
            args.count = defaultCount;
        }

        // XXX: Check "before" and "since" for injection...?
        // XXX: Check "before" and "since" for URI...?

        if (_(req.query).has("before")) {
            check(req.query.before).notEmpty();
            args.before = sanitize(req.query.before).trim();
        }

        if (_(req.query).has("since")) {
            if (_(args).has("before")) {
                throw new Error("Can't have both 'before' and 'since' parameters");
            }
            check(req.query.since).notEmpty();
            args.since = sanitize(req.query.since).trim();
        }

        if (_(req.query).has("offset")) {
            if (_(args).has("before")) {
                throw new Error("Can't have both 'before' and 'offset' parameters");
            }
            if (_(args).has("since")) {
                throw new Error("Can't have both 'since' and 'offset' parameters");
            }
            check(req.query.offset, "Offset must be an integer greater than or equal to zero").isInt().min(0);
            args.start = sanitize(req.query.offset).toInt();
        }

        if (!_(req.query).has("offset") && !_(req.query).has("since") && !_(req.query).has("before")) {
            args.start = 0;
        }

        if (_(args).has("start")) {
            args.end = args.start + args.count;
        }

        return args;
    } catch (e) {
        throw new HTTPError(e.message, 400);
    }
};

