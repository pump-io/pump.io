// routes/api.js
//
// The beating heart of a pumpin' good time
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

// Adds to globals
require("set-immediate");

var databank = require("databank"),
    _ = require("underscore"),
    Step = require("step"),
    validator = require("validator"),
    OAuth = require("oauth-evanp").OAuth,
    check = validator.check,
    sanitize = validator.sanitize,
    filters = require("../lib/filters"),
    version = require("../lib/version").version,
    HTTPError = require("../lib/httperror").HTTPError,
    Stamper = require("../lib/stamper").Stamper,
    Mailer = require("../lib/mailer"),
    Scrubber = require("../lib/scrubber"),
    ActivitySpam = require("../lib/activityspam"),
    Activity = require("../lib/model/activity").Activity,
    AppError = require("../lib/model/activity").AppError,
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    Confirmation = require("../lib/model/confirmation").Confirmation,
    User = require("../lib/model/user").User,
    Person = require("../lib/model/person").Person,
    Proxy = require("../lib/model/proxy").Proxy,
    Credentials = require("../lib/model/credentials").Credentials,
    stream = require("../lib/model/stream"),
    Stream = stream.Stream,
    NotInStreamError = stream.NotInStreamError,
    URLMaker = require("../lib/urlmaker").URLMaker,
    Distributor = require("../lib/distributor"),
    Schlock = require("schlock"),
    mw = require("../lib/middleware"),
    authc = require("../lib/authc"),
    omw = require("../lib/objectmiddleware"),
    randomString = require("../lib/randomstring").randomString,
    finishers = require("../lib/finishers"),
    mm = require("../lib/mimemap"),
    saveUpload = require("../lib/saveupload").saveUpload,
    streams = require("../lib/streams"),
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
    addFollowed = finishers.addFollowed,
    addLiked = finishers.addLiked,
    addLikers = finishers.addLikers,
    addShared = finishers.addShared,
    firstFewReplies = finishers.firstFewReplies,
    firstFewShares = finishers.firstFewShares,
    DEFAULT_ITEMS = 20,
    MAX_ITEMS = DEFAULT_ITEMS * 10;

// Initialize the app controller

var addRoutes = function(app) {

    var smw = (app.session) ? [app.session] : [];

    // Proxy to a remote server

    app.get("/api/proxy/:uuid", smw, userReadAuth, reqProxy, proxyRequest);

    // Users
    app.get("/api/user/:nickname", smw, anyReadAuth, reqUser, getUser);
    app.put("/api/user/:nickname", userWriteOAuth, reqUser, sameUser, putUser);
    app.del("/api/user/:nickname", userWriteOAuth, reqUser, sameUser, delUser);

    app.get("/api/user/:nickname/profile", smw, anyReadAuth, reqUser, personType, getObject);
    app.put("/api/user/:nickname/profile", userWriteOAuth, reqUser, sameUser, personType, reqGenerator, putObject);

    // Feeds

    app.get("/api/user/:nickname/feed", smw, anyReadAuth, reqUser, userStream);
    app.post("/api/user/:nickname/feed", userWriteOAuth, reqUser, sameUser, reqGenerator, postActivity);

    app.get("/api/user/:nickname/feed/major", smw, anyReadAuth, reqUser, userMajorStream);
    app.get("/api/user/:nickname/feed/minor", smw, anyReadAuth, reqUser, userMinorStream);

    app.post("/api/user/:nickname/feed/major", userWriteOAuth, reqUser, sameUser, isMajor, reqGenerator, postActivity);
    app.post("/api/user/:nickname/feed/minor", userWriteOAuth, reqUser, sameUser, isMinor, reqGenerator, postActivity);

    // Inboxen

    app.get("/api/user/:nickname/inbox", smw, userReadAuth, reqUser, sameUser, userInbox);
    app.post("/api/user/:nickname/inbox", remoteWriteOAuth, reqUser, postToInbox);

    app.get("/api/user/:nickname/inbox/major", smw, userReadAuth, reqUser, sameUser, userMajorInbox);
    app.get("/api/user/:nickname/inbox/minor", smw, userReadAuth, reqUser, sameUser, userMinorInbox);
    app.get("/api/user/:nickname/inbox/direct", smw, userReadAuth, reqUser, sameUser, userDirectInbox);
    app.get("/api/user/:nickname/inbox/direct/major", smw, userReadAuth, reqUser, sameUser, userMajorDirectInbox);
    app.get("/api/user/:nickname/inbox/direct/minor", smw, userReadAuth, reqUser, sameUser, userMinorDirectInbox);

    // Followers

    app.get("/api/user/:nickname/followers", smw, anyReadAuth, reqUser, userFollowers);

    // Following

    app.get("/api/user/:nickname/following", smw, anyReadAuth, reqUser, userFollowing);
    app.post("/api/user/:nickname/following", userWriteOAuth, reqUser, sameUser, reqGenerator, newFollow);

    // Favorites

    app.get("/api/user/:nickname/favorites", smw, anyReadAuth, reqUser, userFavorites);
    app.post("/api/user/:nickname/favorites", userWriteOAuth, reqUser, sameUser, reqGenerator, newFavorite);

    // Lists

    app.get("/api/user/:nickname/lists/:type", smw, anyReadAuth, reqUser, userLists);

    if (app.config.uploaddir) {

        // Uploads

        app.get("/api/user/:nickname/uploads", smw, userReadAuth, reqUser, sameUser, userUploads);
        app.post("/api/user/:nickname/uploads", userWriteOAuth, reqUser, sameUser, fileContent, newUpload);
    }

    // Activities

    app.get("/api/activity/:uuid", smw, anyReadAuth, reqActivity, actorOrRecipient, getActivity);
    app.put("/api/activity/:uuid", userWriteOAuth, reqActivity, actorOnly, putActivity);
    app.del("/api/activity/:uuid", userWriteOAuth, reqActivity, actorOnly, delActivity);

    // Other objects

    app.get("/api/:type/:uuid", smw, anyReadAuth, requestObject, authorOrRecipient, getObject);
    app.put("/api/:type/:uuid", userWriteOAuth, requestObject, authorOnly, reqGenerator, putObject);
    app.del("/api/:type/:uuid", userWriteOAuth, requestObject, authorOnly, reqGenerator, deleteObject);

    app.get("/api/:type/:uuid/likes", smw, anyReadAuth, requestObject, authorOrRecipient, objectLikes);
    app.get("/api/:type/:uuid/replies", smw, anyReadAuth, requestObject, authorOrRecipient, objectReplies);
    app.get("/api/:type/:uuid/shares", smw, anyReadAuth, requestObject, authorOrRecipient, objectShares);

    // Global user list

    app.get("/api/users", smw, anyReadAuth, listUsers);
    app.post("/api/users", noneWriteOAuth, reqGenerator, createUser);

    // Collection members

    app.get("/api/collection/:uuid/members", smw, anyReadAuth, requestCollection, authorOrRecipient, collectionMembers);
    app.post("/api/collection/:uuid/members", userWriteOAuth, requestCollection, authorOnly, reqGenerator, newMember);

    // Group feeds (members and inbox)

    app.get("/api/group/:uuid/members", smw, anyReadAuth, requestGroup, authorOrRecipient, groupMembers);
    app.get("/api/group/:uuid/inbox", smw, anyReadAuth, requestGroup, authorOrRecipient, groupInbox);
    app.get("/api/group/:uuid/documents", smw, anyReadAuth, requestGroup, authorOrRecipient, groupDocuments);
    app.post("/api/group/:uuid/inbox", remoteWriteOAuth, requestGroup, postToGroupInbox);

    // Info about yourself

    app.get("/api/whoami", smw, userReadAuth, whoami);
};

// XXX: use a common function instead of faking up params

var requestCollection = function(req, res, next) {
    req.params.type = "collection";
    requestObject(req, res, next);
};

var requestGroup = function(req, res, next) {
    req.params.type = "group";
    requestObject(req, res, next);
};

var personType = function(req, res, next) {
    req.type = "person";
    next();
};

var isMajor = function(req, res, next) {
    var props = Scrubber.scrubActivity(req.body),
        activity = new Activity(props);

    if (activity.isMajor()) {
        next();
    } else {
        next(new HTTPError("Only major activities to this feed.", 400));
    }
};

var isMinor = function(req, res, next) {
    var props = Scrubber.scrubActivity(req.body),
        activity = new Activity(props);

    if (!activity.isMajor()) {
        next();
    } else {
        next(new HTTPError("Only minor activities to this feed.", 400));
    }
};

var userOnly = function(req, res, next) {
    var person = req.person,
        principal = req.principal;

    if (person && principal && person.id === principal.id && principal.objectType === "person") {
        next();
    } else {
        next(new HTTPError("Only the user can modify this profile.", 403));
    }
};

var actorOnly = function(req, res, next) {
    var act = req.activity;

    if (act && act.actor && act.actor.id == req.principal.id) {
        next();
    } else {
        next(new HTTPError("Only the actor can modify this object.", 403));
    }
};

var actorOrRecipient = function(req, res, next) {

    var act = req.activity,
        person = req.principal;

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

var getObject = function(req, res, next) {

    var type = req.type,
        obj = req[type],
        profile = req.principal;

    Step(
        function() {
            finishObject(profile, obj, this);
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                obj.sanitize();
                res.json(obj);
            }
        }
    );
};

var putObject = function(req, res, next) {

    var type = req.type,
        obj = req[type],
        updates = Scrubber.scrubObject(req.body),
        act = new Activity({
            actor: req.principal,
            generator: req.generator,
            verb: "update",
            object: _(obj).extend(updates)
        });

    Step(
        function() {
            newActivity(act, req.principalUser, this);
        },
        function(err, act) {
            var d;
            if (err) {
                next(err);
            } else {
                act.object.sanitize();
                res.json(act.object);
                d = new Distributor(act);
                d.distribute(function(err) {});
            }
        }
    );
};

var deleteObject = function(req, res, next) {

    var type = req.type,
        obj = req[type],
        act = new Activity({
            actor: req.principal,
            verb: "delete",
            generator: req.generator,
            object: obj
        });

    Step(
        function() {
            newActivity(act, req.principalUser, this);
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

var contextEndpoint = function(contextifier, streamCreator) {

    return function(req, res, next) {

        var args;

        try {
            args = streamArgs(req, DEFAULT_ITEMS, MAX_ITEMS);
        } catch (e) {
            next(e);
            return;
        }

        streamCreator(contextifier(req), req.principal, args, function(err, collection) {
            if (err) {
                next(err);
            } else {
                res.json(collection);
            }
        });
    };
};

var objectReplies = contextEndpoint(
    function(req) {
        var type = req.type;
        return {type: type,
                obj: req[type]};
    },
    streams.objectReplies
);

// Feed of actors (usually persons) who have shared the object
// It's stored as a stream, so we get those

var objectShares = contextEndpoint(
    function(req) {
        var type = req.type;
        return {type: type,
                obj: req[type]};
    },
    streams.objectShares
);

// Feed of actors (usually persons) who have liked the object
// It's stored as a stream, so we get those

var objectLikes = contextEndpoint(
    function(req) {
        var type = req.type;
        return {type: type,
                obj: req[type]};
    },
    streams.objectLikes
);

var getUser = function(req, res, next) {

    Step(
        function() {
            req.user.profile.expandFeeds(this);
        },
        function(err) {
            if (err) throw err;
            if (!req.principal) {
                // skip
                this(null);
            } else if (req.principal.id == req.user.profile.id) {
                // same user
                req.user.profile.pump_io = {
                    followed: false
                };
                // skip
                this(null);
            } else {
                addFollowed(req.principal, [req.user.profile], this);
            }
        },
        function(err) {
            if (err) next(err);
            // If no user, or different user, hide email
            if (!req.principal || (req.principal.id != req.user.profile.id)) {
                delete req.user.email;
            }
            req.user.sanitize();
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
    Activity.search({"_uuid": uuid}, function(err, results) {
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
    var principal = req.principal,
        act = req.activity;

    act.sanitize(principal);

    res.json(act);
};

var putActivity = function(req, res, next) {
    var update = Scrubber.scrubActivity(req.body);

    req.activity.update(update, function(err, result) {
        if (err) {
            next(err);
        } else {
            result.sanitize(req.principal);
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

var thisService = function(app) {
    var Service = require("../lib/model/service").Service;
    return new Service({
        objectType: Service.type,
        url: URLMaker.makeURL("/"),
        displayName: app.config.site || "pump.io"
    });
};

var createUser = function(req, res, next) {

    var user,
        props = req.body,
        email,
        registrationActivity = function(user, svc, callback) {
            var act = new Activity({
                actor: user.profile,
                verb: Activity.JOIN,
                object: svc,
                generator: req.generator
            });
            newActivity(act, user, callback);
        },
        welcomeActivity = function(user, svc, callback) {
            Step(
                function() {
                    res.render("welcome",
                               {page: {title: "Welcome"},
                                profile: user.profile,
                                service: svc,
                                layout: false},
                               this);
                },
                function(err, text) {
                    if (err) throw err;
                    var act = new Activity({
                        actor: svc,
                        verb: Activity.POST,
                        to: [user.profile],
                        object: {
                            objectType: ActivityObject.NOTE,
                            displayName: "Welcome to " + svc.displayName,
                            content: text
                        }
                    });
                    initActivity(act, this);
                },
                function(err, act) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, act);
                    }
                }
            );
        },
        sendConfirmationEmail = function(user, email, callback) {
            Step(
                function() {
                    Confirmation.create({nickname: user.nickname,
                                         email: email},
                                        this);
                },
                function(err, confirmation) {
                    var confirmationURL;
                    if (err) throw err;
                    confirmationURL = URLMaker.makeURL("/main/confirm/" + confirmation.code);
                    res.render("confirmation-email-html",
                               {principal: user.profile,
                                principalUser: user,
                                confirmation: confirmation,
                                confirmationURL: confirmationURL,
                                layout: false},
                               this.parallel());
                    res.render("confirmation-email-text",
                               {principal: user.profile,
                                principalUser: user,
                                confirmation: confirmation,
                                confirmationURL: confirmationURL,
                                layout: false},
                               this.parallel());
                },
                function(err, html, text) {
                    if (err) throw err;
                    Mailer.sendEmail({to: email,
                                      subject: "Confirm your email address for " + req.app.config.site,
                                      text: text,
                                      attachment: {data: html,
                                                   type: "text/html",
                                                   alternative: true}},
                                     this);
                },
                function(err, message) {
                    callback(err);
                }
            );
        },
        defaultLists = function(user, callback) {
            Step(
                function(err, str) {
                    var lists = ["Friends", "Family", "Acquaintances", "Coworkers"],
                        group = this.group();

                    if (err) throw err;

                    _.each(lists, function(list) {
                        var act = new Activity({
                            verb: Activity.CREATE,
                            to: [{objectType: ActivityObject.COLLECTION,
                                  id: user.profile.followers.url}],
                            object: {
                                objectType: ActivityObject.COLLECTION,
                                displayName: list,
                                objectTypes: ["person"]
                            }
                        });
                        newActivity(act, user, group());
                    });
                },
                callback
            );
        };

    if (req.app.config.disableRegistration) {
        next(new HTTPError("No registration allowed.", 403));
        return;
    }

    // Email validation

    if (req.app.config.requireEmail) {
        if (!_.has(props, "email") ||
            !_.isString(props.email) ||
            props.email.length === 0) {
            next(new HTTPError("No email address", 400));
            return;
        } else {
            try {
                check(props.email).isEmail();
                email = props.email;
                delete props.email;
            } catch(e) {
                next(new HTTPError(e.message, 400));
                return;
            }
        }
    }

    Step(
        function() {
            User.create(props, this);
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
            user.expand(this);
        },
        function(err) {
            if (err) throw err;
            if (req.app.config.requireEmail) {
                sendConfirmationEmail(user, email, this);
            } else {
                // skip if we don't require email
                this(null);
            }
        },
        function(err) {
            var svc;
            if (err) throw err;
            svc = thisService(req.app);
            registrationActivity(user, svc, this.parallel());
            welcomeActivity(user, svc, this.parallel());
            defaultLists(user, this.parallel());
        },
        function(err, reg, welcome, lists) {
            var rd, wd, group = this.group();
            if (err) throw err;
            rd = new Distributor(reg);
            rd.distribute(group());
            wd = new Distributor(welcome);
            wd.distribute(group());
            _.each(lists, function(list) {
                var d = new Distributor(list);
                d.distribute(group());
            });
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
                // If called as /main/register; see ./web.js
                // XXX: Bad hack
                if (req.session) {
                    setPrincipal(req.session, user.profile, function(err) {
                        if (err) {
                            next(err);
                        } else {
                            res.json(user);
                        }
                    });
                } else {
                    res.json(user);
                }
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
                first: {
                    href: url
                },
                self: {
                    href: url
                }
            }
        };

    var args, str;

    try {
        args = streamArgs(req, DEFAULT_ITEMS, MAX_ITEMS);
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

            _.each(users, function(user) {
                user.sanitize();
                if (!req.principal || req.principal.id != user.profile.id) {
                    delete user.email;
                }
            });

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

    var props = Scrubber.scrubActivity(req.body),
        activity = new Activity(props),
        finishAndSend = function(profile, activity, callback) {
            
            var dupe = new Activity(_.clone(activity));

            Step(
                function() {
                    finishProperty(profile, dupe, "object", this.parallel());
                    finishProperty(profile, dupe, "target", this.parallel());
                },
                function(err, object, target) {
                    if (err) {
                        callback(err);
                    } else {
                        dupe.sanitize(req.principal);
                        // ...then show (possibly modified) results.
                        res.json(dupe);
                        callback(null);
                    }
                }
            );
        },
        distributeActivity = function(activity, callback) {
            var dupe = new Activity(_.clone(activity)),
                d = new Distributor(dupe);

            d.distribute(callback);
        };

    // Add a default actor

    if (!_(activity).has("actor")) {
        activity.actor = req.user.profile;
    }

    // If the actor is incorrect, error

    if (activity.actor.id !== req.user.profile.id) {
        next(new HTTPError("Invalid actor", 400));
        return;
    }

    // XXX: we overwrite anything here

    activity.generator = req.generator;

    // Default verb

    if (!_(activity).has("verb") || _(activity.verb).isNull()) {
        activity.verb = "post";
    }

    Step(
        function() {
            newActivity(activity, req.user, this);
        },
        function(err, results) {
            if (err) throw err;
            activity = results;
            finishAndSend(req.principal, activity, this.parallel());
            distributeActivity(activity, this.parallel());
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                // Done!
            }
        }
    );
};


var remotes = new Schlock();

var ensureRemoteActivity = function(principal, props, retries, callback) {

    var act,
        lastErr;

    if (!callback) {
        callback = retries;
        retries  = 0;
    }

    Step(
        function() {
            remotes.writeLock(props.id, this);
        },
        function(err) {
            if (err) {
                // If we can't lock, leave here
                callback(err);
                return;
            }
            Activity.get(props.id, this);
        },
        function(err, activity) {
            if (err && err.name == "NoSuchThingError") {
                newRemoteActivity(principal, props, this);
            } else if (!err) {
                this(null, activity);
            }
        },
        function(err, activity) {
            lastErr = err;
            act = activity;
            remotes.writeUnlock(props.id, this);
        },
        function(err) {
            // Ignore err; unlock errors don't matter
            if (lastErr) {
                if (retries === 0) {
                    ensureRemoteActivity(principal, props, retries + 1, callback);
                } else {
                    callback(lastErr, null);
                }
            } else {
                callback(null, act);
            }
        }
    );
};

var newRemoteActivity = function(principal, props, callback) {

    var activity = new Activity(props);

    Step(
        function() {
            // Default verb

            if (!_(activity).has("verb") || _(activity.verb).isNull()) {
                activity.verb = "post";
            }

            // Add a received timestamp

            activity.received = Stamper.stamp();

            // TODO: return a 202 Accepted here?

            // First, ensure recipients
            activity.ensureRecipients(this);
        },
        function(err) {
            if (err) throw err;
            // apply the activity
            activity.apply(principal, this);
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
        callback
    );
};

var validateActor = function(client, principal, actor) {

    if (client.webfinger) {
        if (ActivityObject.canonicalID(actor.id) != ActivityObject.canonicalID(principal.id)) {
            throw new HTTPError("Actor is invalid since " + actor.id + " is not " + principal.id, 400);
        }
    } else if (client.hostname) {
        if (ActivityObject.canonicalID(actor.id) != "https://" + client.hostname + "/" &&
            ActivityObject.canonicalID(actor.id) != "http://" + client.hostname + "/") {
            throw new HTTPError("Actor is invalid since " + actor.id + " is not " + principal.id, 400);
        }
    }

    return true;
};

var postToInbox = function(req, res, next) {

    var props = Scrubber.scrubActivity(req.body),
        act,
        user = req.user;

    // Check for actor

    if (!_(props).has("actor")) {
        next(new HTTPError("Invalid actor", 400));
    }

    try {
        validateActor(req.client, req.principal, props.actor);
    } catch (err) {
        next(err);
        return;
    }

    Step(
        function() {
            ensureRemoteActivity(req.principal, props, this);
        },
        function(err, activity) {
            if (err) throw err;
            act = activity;
            // throws on mismatch
            validateActor(req.client, req.principal, act.actor);
            user.addToInbox(activity, this);
        },
        function(err) {
            if (err) throw err;
            act.checkRecipient(user.profile, this);
        },
        function(err, isRecipient) {
            if (err) throw err;
            if (isRecipient) {
                this(null);
            } else {
                act.addReceived(user.profile, this);
            }
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                act.sanitize(req.principal);
                // ...then show (possibly modified) results.
                // XXX: don't distribute
                res.json(act);
            }
        }
    );
};

var validateGroupRecipient = function(group, act) {

    var props = ["to", "cc", "bto", "bcc"],
        recipients = [];

    props.forEach(function(prop) {
        if (_(act).has(prop) && _(act[prop]).isArray()) {
            recipients = recipients.concat(act[prop]);
        }
    });

    if (!_.some(recipients, function(item) { return item.id == group.id && item.objectType == group.objectType; })) {
        throw new HTTPError("Group " + group.id + " is not a recipient of activity " + act.id, 400);
    }

    return true;
};

var postToGroupInbox = function(req, res, next) {

    var props = Scrubber.scrubActivity(req.body),
        act,
        group = req.group;

    // Check for actor

    if (!_(props).has("actor")) {
        next(new HTTPError("Invalid actor", 400));
    }

    try {
        validateActor(req.client, req.principal, props.actor);
        validateGroupRecipient(req.group, props);
    } catch (err) {
        next(err);
        return;
    }

    Step(
        function() {
            ensureRemoteActivity(req.principal, props, this);
        },
        function(err, activity) {
            // These throw on invalid input
            validateActor(req.client, req.principal, activity.actor);
            validateGroupRecipient(req.group, activity);
            this(null, activity);
        },
        function(err, act) {
            var d;
            if (err) {
                next(err);
            } else {
                act.sanitize(req.principal);
                // ...then show (possibly modified) results.
                // XXX: don't distribute
                res.json(act);
                d = new Distributor(act);
                d.toLocalGroup(req.group, function(err) {
                    req.log.error(err);
                });
            }
        }
    );
};

var initActivity = function(activity, callback) {

    Step(
        function() {
            // First, ensure recipients
            activity.ensureRecipients(this);
        },
        function(err) {
            if (err) throw err;
            ActivitySpam.test(activity, this);
        },
        function(err, isSpam, probability) {
            if (err) throw err;
            if (isSpam) {
                // XXX: do some social trust metrics
                throw new HTTPError("Looks like spam", 400);
            }
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
            if (err) {
                callback(err, null);
            } else {
                callback(null, activity);
            }
        }
    );
};

var newActivity = function(activity, user, callback) {

    if (!_(activity).has("actor")) {
        activity.actor = user.profile;
    }

    Step(
        function() {
            initActivity(activity, this);
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

var streamEndpoint = function(streamCreator) {

    return function(req, res, next) {

        var args;

        try {
            args = streamArgs(req, DEFAULT_ITEMS, MAX_ITEMS);
        } catch (e) {
            next(e);
            return;
        }

        streamCreator({user: req.user}, req.principal, args, function(err, collection) {
            if (err) {
                next(err);
            } else {
                res.json(collection);
            }
        });
    };
};

var userStream = streamEndpoint(streams.userStream);
var userMajorStream = streamEndpoint(streams.userMajorStream);
var userMinorStream = streamEndpoint(streams.userMinorStream);
var userInbox = streamEndpoint(streams.userInbox);
var userMajorInbox = streamEndpoint(streams.userMajorInbox);
var userMinorInbox = streamEndpoint(streams.userMinorInbox);
var userDirectInbox = streamEndpoint(streams.userDirectInbox);
var userMajorDirectInbox = streamEndpoint(streams.userMajorDirectInbox);
var userMinorDirectInbox = streamEndpoint(streams.userMinorDirectInbox);

var userFollowers = contextEndpoint(
    function(req) {
        return {user: req.user, author: req.person};
    },
    streams.userFollowers
);

var userFollowing = contextEndpoint(
    function(req) {
        return {user: req.user, author: req.person};
    },
    streams.userFollowing
);

var userFavorites = contextEndpoint(
    function(req) {
        return {user: req.user, author: req.person};
    },
    streams.userFavorites
);

var userUploads = contextEndpoint(
    function(req) {
        return {user: req.user, author: req.person};
    },
    streams.userUploads
);

var userLists = contextEndpoint(
    function(req) {
        return {
            user: req.user,
            type: req.params.type
        };
    },
    streams.userLists
);

var newFollow = function(req, res, next) {
    var obj = Scrubber.scrubObject(req.body),
        act = new Activity({
            actor: req.user.profile,
            verb: "follow",
            object: obj,
            generator: req.generator
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
                act.object.sanitize();
                res.json(act.object);
                d = new Distributor(act);
                d.distribute(function(err) {});
            }
        }
    );
};

var newFavorite = function(req, res, next) {
    var obj = Scrubber.scrubObject(req.body),
        act = new Activity({
            actor: req.user.profile,
            verb: "favorite",
            object: obj,
            generator: req.generator
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
                act.object.sanitize();
                res.json(act.object);
                d = new Distributor(act);
                d.distribute(function(err) {});
            }
        }
    );
};

var newUpload = function(req, res, next) {

    var user = req.principalUser,
        mimeType = req.uploadMimeType,
        fileName = req.uploadFile,
        uploadDir = req.app.config.uploaddir;

    Step(
        function() {
            saveUpload(user, mimeType, fileName, uploadDir, this);
        },
        function(err, obj) {
            if (err) {
                next(err);
            } else {
                obj.sanitize();
                res.json(obj);
            }
        }
    );
};

var collectionMembers = contextEndpoint(
    function(req) {
        var context = {collection: req.collection, author: req.collection.author};
        if (req.query.type) {
            context.type = req.query.type;
        } else if (req.collection.objectTypes && req.collection.objectTypes.length > 0) {
            context.type = req.collection.objectTypes[0];
        }
        return context;
    },
    streams.collectionMembers
);

var groupMembers = contextEndpoint(
    function(req) {
        var context = {group: req.group, author: req.group.author};
        return context;
    },
    streams.groupMembers
);

var groupInbox = contextEndpoint(
    function(req) {
        var context = {group: req.group};
        return context;
    },
    streams.groupInbox
);

var groupDocuments = contextEndpoint(
    function(req) {
        var context = {group: req.group, author: req.group.author};
        return context;
    },
    streams.groupDocuments
);

var newMember = function(req, res, next) {

    var coll = req.collection,
        obj = Scrubber.scrubObject(req.body),
        act = new Activity({
            verb: "add",
            object: obj,
            target: coll,
            generator: req.generator
        });

    Step(
        function() {
            newActivity(act, req.principalUser, this);
        },
        function(err, act) {
            var d;
            if (err) {
                next(err);
            } else {
                act.object.sanitize();
                res.json(act.object);
                d = new Distributor(act);
                d.distribute(function(err) {});
            }
        }
    );
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

var whoami = function(req, res, next) {
    res.redirect("/api/user/"+req.principalUser.nickname+"/profile", 302);
};

var reqProxy = function(req, res, next) {
    var id = req.params.uuid;

    Step(
        function() {
            Proxy.search({id: id}, this);
        },
        function(err, proxies) {
            if (err) {
                next(err);
            } else if (!proxies || proxies.length === 0) {
                next(new HTTPError("No such proxy", 404));
            } else if (proxies.length > 1) {
                next(new HTTPError("Too many proxies", 500));
            } else {
                req.proxy = proxies[0];
                next();
            }
        }
    );
};

var proxyRequest = function(req, res, next) {

    var principal = req.principal,
        proxy = req.proxy;

    req.log.info({url: proxy.url, principal: principal.id}, "Getting object through proxy.");

    // XXX: check local cache first

    Step(
        function() {
            Credentials.getFor(principal.id, proxy.url, this);
        },
        function(err, cred) {
            var oa, headers;
            if (err) throw err;

            headers = {"User-Agent": "pump.io/"+version};

            if (req.headers["if-modified-since"]) {
                headers["If-Modified-Since"] = req.headers["if-modified-since"];
            }

            if (req.headers["if-none-match"]) {
                headers["If-None-Match"] = req.headers["if-none-match"];
            }

            oa = new OAuth(null,
                           null,
                           cred.client_id,
                           cred.client_secret,
                           "1.0",
                           null,
                           "HMAC-SHA1",
                           null, // nonce size; use default
                           headers);

            oa.get(proxy.url, null, null, this);
        },
        function(err, pbody, pres) {
            var toCopy;
            if (err) {
                if (err.statusCode == 304) {
                    res.statusCode = 304;
                    res.end();
                } else {
                    next(new HTTPError("Unable to retrieve proxy data", 500));
                }
            } else {
                if (pres.headers["content-type"]) {
                    res.setHeader("Content-Type", pres.headers["content-type"]);
                }
                if (pres.headers["last-modified"]) {
                    res.setHeader("Last-Modified", pres.headers["last-modified"]);
                }
                if (pres.headers["etag"]) {
                    res.setHeader("ETag", pres.headers["etag"]);
                }
                if (pres.headers["expires"]) {
                    res.setHeader("Expires", pres.headers["expires"]);
                }
                if (pres.headers["cache-control"]) {
                    res.setHeader("Cache-Control", pres.headers["cache-control"]);
                }
                // XXX: save to local cache
                req.log.info({headers: pres.headers}, "Received object");
                res.send(pbody);
            }
        }
    );
};

var finishProperty = function(profile, obj, prop, callback) {
    if (!obj[prop]) {
        setImmediate(function() {
            callback(null);
        });
        return;
    }

    Step(
        function() {
            finishObject(profile, obj[prop], this);
        },
        callback
    );
};

var finishObject = function(profile, obj, callback) {

    Step(
        function() {
            obj.expandFeeds(this);
        },
        function(err) {
            if (err) throw err;
            addLiked(profile, [obj], this.parallel());
            addLikers(profile, [obj], this.parallel());
            addShared(profile, [obj], this.parallel());
            firstFewReplies(profile, [obj], this.parallel());
            firstFewShares(profile, [obj], this.parallel());
            if (obj.isFollowable()) {
                addFollowed(profile, [obj], this.parallel());
            }
        },
        function(err) {
            callback(err);
        }
    );
};

exports.addRoutes = addRoutes;
exports.createUser = createUser;
