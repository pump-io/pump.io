// routes/web.js
//
// Spurtin' out pumpy goodness all over your browser window
//
// Copyright 2011-2012, E14N https://e14n.com/
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
    Step = require("step"),
    _ = require("underscore"),
    validator = require("validator"),
    check = validator.check,
    Mailer = require("../lib/mailer"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    filters = require("../lib/filters"),
    Activity = require("../lib/model/activity").Activity,
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    User = require("../lib/model/user").User,
    Recovery = require("../lib/model/recovery").Recovery,
    Collection = require("../lib/model/collection").Collection,
    RemoteRequestToken = require("../lib/model/remoterequesttoken").RemoteRequestToken,
    RemoteAccessToken = require("../lib/model/remoteaccesstoken").RemoteAccessToken,
    Host = require("../lib/model/host").Host,
    mw = require("../lib/middleware"),
    omw = require("../lib/objectmiddleware"),
    authc = require("../lib/authc"),
    he = require("../lib/httperror"),
    Scrubber = require("../lib/scrubber"),
    finishers = require("../lib/finishers"),
    su = require("../lib/saveupload"),
    saveUpload = su.saveUpload,
    saveAvatar = su.saveAvatar,
    streams = require("../lib/streams"),
    api = require("./api"),
    HTTPError = he.HTTPError,
    reqUser = mw.reqUser,
    reqGenerator = mw.reqGenerator,
    principal = authc.principal,
    setPrincipal = authc.setPrincipal,
    clearPrincipal = authc.clearPrincipal,
    principalUserOnly = authc.principalUserOnly,
    clientAuth = authc.clientAuth,
    userAuth = authc.userAuth,
    someReadAuth = authc.someReadAuth,
    NoSuchThingError = databank.NoSuchThingError,
    createUser = api.createUser,
    addLiked = finishers.addLiked,
    addShared = finishers.addShared,
    addLikers = finishers.addLikers,
    firstFewReplies = finishers.firstFewReplies,
    firstFewShares = finishers.firstFewShares,
    addFollowed = finishers.addFollowed,
    requestObject = omw.requestObject,
    principalActorOrRecipient = omw.principalActorOrRecipient,
    principalAuthorOrRecipient = omw.principalAuthorOrRecipient;

var addRoutes = function(app) {

    app.get("/", app.session, principal, addMessages, showMain);

    app.get("/main/register", app.session, principal, showRegister);
    app.post("/main/register", app.session, principal, clientAuth, reqGenerator, createUser);

    app.get("/main/login", app.session, principal, addMessages, showLogin);
    app.post("/main/login", app.session, clientAuth, handleLogin);

    app.post("/main/logout", app.session, someReadAuth, handleLogout);

    app.post("/main/renew", app.session, userAuth, renewSession);

    app.get("/main/remote", app.session, principal, showRemote);
    app.post("/main/remote", app.session, handleRemote);

    if (app.config.haveEmail) {
        app.get("/main/recover", app.session, showRecover);
        app.get("/main/recover-sent", app.session, showRecoverSent);
        app.post("/main/recover", app.session, handleRecover);
        app.get("/main/recover/:code", app.session, recoverCode);
        app.post("/main/redeem-code", app.session, clientAuth, redeemCode);
    }

    app.get("/main/authorized/:hostname", app.session, reqHost, reqToken, authorized);
    
    if (app.config.uploaddir) {
        app.post("/main/upload", app.session, principal, principalUserOnly, uploadFile);
        app.post("/main/upload-avatar", app.session, principal, principalUserOnly, uploadAvatar);
    }

    app.get("/:nickname", app.session, principal, addMessages, reqUser, showStream);
    app.get("/:nickname/favorites", app.session, principal, addMessages, reqUser, showFavorites);
    app.get("/:nickname/followers", app.session, principal, addMessages, reqUser, showFollowers);
    app.get("/:nickname/following", app.session, principal, addMessages, reqUser, showFollowing);

    app.get("/:nickname/lists", app.session, principal, addMessages, reqUser, showLists);
    app.get("/:nickname/list/:uuid", app.session, principal, addMessages, reqUser, showList);

    // For things that you can only see if you're logged in,
    // we redirect to the login page, then let you go there

    app.get("/main/settings", loginRedirect("/main/settings"));
    app.get("/main/account", loginRedirect("/main/account"));
    app.get("/main/messages", loginRedirect("/main/messages"));

    app.post("/main/proxy", app.session, principal, principalNotUser, proxyActivity);

    // These are catchalls and should go at the end to prevent conflicts

    app.get("/:nickname/activity/:uuid", app.session, principal, addMessages, requestActivity, reqUser, userIsActor, principalActorOrRecipient, showActivity);

    app.get("/:nickname/:type/:uuid", app.session, principal, addMessages, requestObject, reqUser, userIsAuthor, principalAuthorOrRecipient, showObject);
};

var loginRedirect = function(rel) {
    return function(req, res, next) {
        res.redirect('/main/login?continue='+rel);
    };
};

var showMain = function(req, res, next) {
    if (req.principalUser) {
        req.log.info({msg: "Showing inbox for logged-in user", user: req.principalUser});
        showInbox(req, res, next);
    } else {
        req.log.info({msg: "Showing welcome page"});
        res.render("main", {page: {title: "Welcome", url: req.originalUrl}});
    }
};

var showInbox = function(req, res, next) {

    var user = req.principalUser;

    Step(
        function() {
            streams.userMajorInbox({user: user}, req.principal, this.parallel());
            streams.userMinorInbox({user: user}, req.principal, this.parallel());
        },
        function(err, major, minor) {
            if (err) {
                next(err);
            } else {
                res.render("inbox", {page: { title: "Home", url: req.originalUrl },
                                     major: major,
                                     minor: minor,
                                     user: user,
                                     data: {
                                         major: major,
                                         minor: minor
                                     }
                                    });
            }
        }
    );
};

var showRegister = function(req, res, next) {
    if (req.principal) {
        res.redirect("/");
    } else if (req.app.config.disableRegistration) {
        next(new HTTPError("No registration allowed.", 403));
    } else {
        res.render("register", {page: {title: "Register", url: req.originalUrl}});
    }
};

var showLogin = function(req, res, next) {
    res.render("login", {page: {title: "Login", url: req.originalUrl}});
};

var handleLogout = function(req, res, next) {

    Step(
        function() {
            clearPrincipal(req.session, this);
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                req.principalUser = null;
                req.principal = null;
                res.json("OK");
            }
        }
    );
};

var showRemote = function(req, res, next) {
    res.render("remote", {page: {title: "Remote login", url: req.originalUrl}});
};

var handleRemote = function(req, res, next) {

    var webfinger = req.body.webfinger,
        continueTo = req.body.continueTo,
        hostname,
        parts,
        host;

    try {
        check(webfinger).isEmail();
    } catch(e) {
        next(new HTTPError(e.message, 400));
        return;
    }

    // Save relative URL to return to

    if (continueTo && continueTo.length > 0) {
        req.session.continueTo = continueTo;
    }

    parts = webfinger.split("@", 2);

    if (parts.length < 2) {
        next(new HTTPError("Bad format for webfinger", 400));
        return;
    }

    hostname = parts[1];

    Step(
        function() {
            Host.ensureHost(hostname, this);
        },
        function(err, result) {
            if (err) throw err;
            host = result;
            host.getRequestToken(this);
        },
        function(err, rt) {
            if (err) {
                next(err);
            } else {
                res.redirect(host.authorizeURL(rt));
            }
        }
    );
};

var requestActivity = function(req, res, next) {

    var uuid = req.params.uuid;

    Step(
        function() {
            Activity.search({"_uuid": req.params.uuid}, this);
        },
        function(err, activities) {
            if (err) throw err;
            if (activities.length === 0) {
                throw new NoSuchThingError("activity", uuid);
            }
            if (activities.length > 1) {
                throw new Error("Too many activities with ID = " + req.params.uuid);
            }
            activities[0].expand(this);
        },
        function(err, activity) {
            if (err) {
                next(err);
            } else {
                req.activity = activity;
                next();
            }
        }
    );
};

var userIsActor = function(req, res, next) {

    var user = req.user,
        person = req.person,
        activity = req.activity,
        actor = activity.actor;

    if (person && actor && person.id == actor.id) {
        next();
    } else {
        next(new HTTPError("No " + type + " by " + user.nickname + " with uuid " + obj._uuid, 404));
        return;
    }
};

var showActivity = function(req, res, next) {

    var activity = req.activity;

    if (activity.isMajor()) {
        res.render("major-activity-page", {page: {title: activity.content, url: req.originalUrl},
                                           principal: principal,
                                           activity: activity});
    } else {
        res.render("minor-activity-page", {page: {title: activity.content, url: req.originalUrl},
                                           principal: principal,
                                           activity: activity});
    }
};

var showStream = function(req, res, next) {

    Step(
        function() {
            streams.userMajorStream({user: req.user}, req.principal, this.parallel());
            streams.userMinorStream({user: req.user}, req.principal, this.parallel());
            addFollowed(req.principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, major, minor) {
            if (err) {
                next(err);
            } else {
                res.render("user", {page: {title: req.user.profile.displayName, url: req.originalUrl},
                                    major: major,
                                    minor: minor,
                                    profile: req.user.profile,
                                    data: {
                                        major: major,
                                        minor: minor,
                                        profile: req.user.profile,
                                        headless: true
                                    }
                                   });
            }
        }
    );
};

var showFavorites = function(req, res, next) {

    Step(
        function() {
            streams.userFavorites({user: req.user}, req.principal, this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, objects) {
            if (err) {
                next(err);
            } else {
                res.render("favorites", {page: {title: req.user.nickname + " favorites", url: req.originalUrl},
                                         favorites: objects,
                                         profile: req.user.profile,
                                         data: {
                                             favorites: objects,
                                             profile: req.user.profile
                                         }
                                        });
            }
        }
    );
};

var showFollowers = function(req, res, next) {

    Step(
        function() {
            streams.userFollowers({user: req.user, author: req.user.profile}, req.principal, this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, followers) {
            if (err) {
                next(err);
            } else {
                res.render("followers", {page: {title: req.user.nickname + " followers", url: req.originalUrl},
                                         followers: followers,
                                         profile: req.user.profile,
                                         data: {
                                             profile: req.user.profile,
                                             followers: followers
                                         }
                                        });
            }
        }
    );
};

var showFollowing = function(req, res, next) {

    Step(
        function() {
            streams.userFollowing({user: req.user, author: req.user.profile}, req.principal, this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, following) {
            if (err) {
                next(err);
            } else {
                res.render("following", {page: {title: req.user.nickname + " following", url: req.originalUrl},
                                         following: following,
                                         profile: req.user.profile,
                                         data: {
                                             profile: req.user.profile,
                                             following: following
                                         }});
            }
        }
    );
};

var handleLogin = function(req, res, next) {

    var user = null;

    Step( 
        function () { 
            User.checkCredentials(req.body.nickname, req.body.password, this);
        },
        function(err, result) {
            if (err) throw err;
            if (!result) {
                throw new HTTPError("Incorrect username or password", 401);
            }
            user = result;
            setPrincipal(req.session, user.profile, this);
        },
        function(err) {
            if (err) throw err;
            user.expand(this);
        },
        function(err) {
            if (err) throw err;
            user.profile.expandFeeds(this);
        },
        function(err) {
            if (err) throw err;
            req.app.provider.newTokenPair(req.client, user, this);
        },
        function(err, pair) {
            if (err) {
                next(err);
            } else {
                user.sanitize();
                user.token = pair.access_token;
                user.secret = pair.token_secret;
                res.json(user);
            }
        }
    );
};

var showLists = function(req, res, next) {

    var user = req.user,
        principal = req.principal;

    Step(
        function() {
            streams.userLists({user: user, type: "person"}, principal, this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, lists) {
            if (err) {
                next(err);
            } else {
                res.render("lists", {page: {title: req.user.profile.displayName + " - Lists",
                                            url: req.originalUrl},
                                     profile: req.user.profile,
                                     list: null,
                                     lists: lists,
                                     data: {
                                         profile: req.user.profile,
                                         list: null,
                                         lists: lists
                                     }
                                    });
            }
        }
    );
};

var showList = function(req, res, next) {

    var user = req.user,
        principal = req.principal,
        getList = function(uuid, callback) {
            var list;
            Step(
                function() {
                    Collection.search({"_uuid": req.params.uuid}, this);
                },
                function(err, results) {
                    if (err) throw err;
                    if (results.length === 0) throw new HTTPError("Not found", 404);
                    if (results.length > 1) throw new HTTPError("Too many lists", 500);
                    list = results[0];
                    if (list.author.id != user.profile.id) {
                        throw new HTTPError("User " + user.nickname + " is not author of " + list.id, 400);
                    }
                    // Make it a real object
                    list.author = user.profile;
                    streams.collectionMembers({collection: list}, principal, this);
                },
                function(err, collection) {
                    if (err) {
                        callback(err, null);
                    } else {
                        list.members = collection;
                        callback(null, list);
                    }
                }
            );
        };

    Step(
        function() {
            streams.userLists({user: user, type: "person"}, principal, this.parallel());
            getList(req.param.uuid, this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, lists, list) {
            if (err) {
                next(err);
            } else {
                res.render("list", {page: {title: req.user.profile.displayName + " - Lists",
                                           url: req.originalUrl},
                                    profile: req.user.profile,
                                    lists: lists,
                                    list: list,
                                    members: list.members.items,
                                    data: {
                                        profile: req.user.profile,
                                        lists: lists,
                                        members: list.members.items,
                                        list: list}
                                   });
            }
        }
    );
};

// uploadFile and uploadAvatar are almost identical except for the function
// they use to save the file. So, this generator makes the two functions

// XXX: if they diverge any more, make them separate functions

var uploader = function(saver) {
    return function(req, res, next) {

        var user = req.principalUser,
            uploadDir = req.app.config.uploaddir,
            mimeType,
            fileName,
            params = {};

        if (req.xhr) {
            if (_.has(req.headers, "x-mime-type")) {
                mimeType = req.headers["x-mime-type"];
            } else {
                mimeType = req.uploadMimeType;
            }
            fileName = req.uploadFile;
            if (_.has(req.query, "title")) {
                params.title = req.query.title;
            }
            if (_.has(req.query, "description")) {
                params.description = Scrubber.scrub(req.query.description);
            }
        } else {
            mimeType = req.files.qqfile.type;
            fileName = req.files.qqfile.path;
        }

        req.log.info("Uploading " + fileName + " of type " + mimeType);

        Step(
            function() {
                saver(user, mimeType, fileName, uploadDir, params, this);
            },
            function(err, obj) {
                var data;
                if (err) {
                    req.log.error(err);
                    data = {"success": false,
                            "error": err.message};
                    res.send(JSON.stringify(data), {"Content-Type": "text/plain"}, 500);
                } else {
                    req.log.info("Upload successful");
                    obj.sanitize();
                    req.log.info(obj);
                    data = {success: true,
                            obj: obj};
                    res.send(JSON.stringify(data), {"Content-Type": "text/plain"}, 200);
                }
            }
        );
    };
};

var uploadFile = uploader(saveUpload);
var uploadAvatar = uploader(saveAvatar);

var userIsAuthor = function(req, res, next) {
    var user = req.user,
        person = req.person,
        type = req.type,
        obj = req[type],
        author = obj.author;

    if (person && author && person.id == author.id) {
        next();
    } else {
        next(new HTTPError("No " + type + " by " + user.nickname + " with uuid " + obj._uuid, 404));
        return;
    }
};

var showObject = function(req, res, next) {

    var type = req.type,
        obj = req[type],
        person = req.person,
        profile = req.principal;

    Step(
        function() {
            obj.expandFeeds(this);
        },
        function(err) {
            if (err) throw err;
            addLiked(profile, [obj], this.parallel());
            addShared(profile, [obj], this.parallel());
            addLikers(profile, [obj], this.parallel());
            firstFewReplies(profile, [obj], this.parallel());
            firstFewShares(profile, [obj], this.parallel());
            if (obj.isFollowable()) {
                addFollowed(profile, [obj], this.parallel());
            }
        },
        function(err) {
            var title;
            if (err) {
                next(err);
            } else {
                if (obj.displayName) {
                    title = obj.displayName;
                } else {
                    title = type + " by " + person.displayName;
                }
                res.render("object", {page: {title: title, url: req.originalUrl},
                                      object: obj,
                                      data: {
                                          object: obj
                                      }
                                     });
            }
        }
    );
};

var renewSession = function(req, res, next) {

    var principal = req.principal,
        user = req.principalUser;

    Step(
        function() {
            // We only need to set this if it's not already set
            setPrincipal(req.session, principal, this);
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                // principalUser is sanitized by userAuth()
                res.json(user);
            }
        }
    );
};

var reqHost = function(req, res, next) {
    var hostname = req.params.hostname;

    Step(
        function() {
            Host.get(hostname, this);
        },
        function(err, host) {
            if (err) {
                next(err);
            } else {
                req.host = host;
                next();
            }
        }
    );
};

var reqToken = function(req, res, next) {
    var token = req.query.oauth_token,
        host = req.host;

    Step(
        function() {
            RemoteRequestToken.get(RemoteRequestToken.key(host.hostname, token), this);
        },
        function(err, rt) {
            if (err) {
                next(err);
            } else {
                req.rt = rt;
                next();
            }
        }
    );
};

var authorized = function(req, res, next) {

    var rt = req.rt,
        host = req.host,
        verifier = req.query.oauth_verifier,
        principal,
        pair;

    Step(
        function() {
            host.getAccessToken(rt, verifier, this);
        },
        function(err, results) {
            if (err) throw err;
            pair = results;
            host.whoami(pair.token, pair.secret, this);
        },
        function(err, obj) {
            if (err) throw err;
            // XXX: test id and url for hostname
            ActivityObject.ensureObject(obj, this);
        },
        function(err, results) {
            var at;
            if (err) throw err;
            principal = results;
            at = new RemoteAccessToken({
                id: principal.id,
                type: principal.objectType,
                token: pair.token,
                secret: pair.secret,
                hostname: host.hostname
            });
            at.save(this);
        },
        function(err, at) {
            if (err) throw err;
            setPrincipal(req.session, principal, this);
        },
        function(err) {
            var continueTo;
            if (err) {
                next(err);
            } else if (req.session.continueTo) {
                continueTo = req.session.continueTo;
                delete req.session.continueTo;
                res.redirect(continueTo);
            } else {
                res.redirect("/");
            }
        }
    );
};

var principalNotUser = function(req, res, next) {
    if (!req.principal) {
        next(new HTTPError("No principal", 401));
    } else if (req.principalUser) {
        next(new HTTPError("Only for remote users", 401));
    } else {
        next();
    }
};

var proxyActivity = function(req, res, next) {

    var principal = req.principal,
        props = Scrubber.scrubActivity(req.body),
        activity = new Activity(props),
        at,
        host,
        oa;

    // XXX: we overwrite anything here

    activity.generator = req.generator;

    if (!_.has(principal, "links") ||
        !_.has(principal.links, "activity-outbox") ||
        !_.has(principal.links["activity-outbox"], "href")) {
        next(new Error("No activity outbox endpoint for " + principal.id, 400));
        return;
    }

    Step(
        function() {
            RemoteAccessToken.get(principal.id, this);
        },
        function(err, results) {
            if (err) throw err;
            at = results;
            Host.ensureHost(at.hostname, this);
        },
        function(err, results) {
            if (err) throw err;
            host = results;
            host.getOAuth(this);
        },
        function(err, results) {
            if (err) throw err;
            oa = results;
            oa.post(principal.links["activity-outbox"].href,
                    at.token,
                    at.secret,
                    JSON.stringify(activity),
                    "application/json",
                    this);
        },
        function(err, doc, response) {
            var act;
            if (err) {
                if (err.statusCode) {
                    next(new Error("Remote OAuth error code " + err.statusCode + ": " + err.data));
                } else {
                    next(err);
                }
            } else {
                act = new Activity(JSON.parse(doc));
                act.sanitize(principal);
                res.json(act);
            }
        }
    );
};

// Middleware to add messages to the interface

var addMessages = function(req, res, next) {

    var user = req.principalUser;

    // We only do this for registered users

    if (!user) {
        next(null);
        return;
    }

    Step(
        function() {
            streams.userMajorDirectInbox({user: user}, req.principal, this.parallel());
            streams.userMinorDirectInbox({user: user}, req.principal, this.parallel());
        },
        function(err, messages, notifications) {
            if (err) {
                next(err);
            } else {
                res.local("messages", messages);
                res.local("notifications", notifications);
                next();
            }
        }
    );
};

var showRecover = function(req, res, next) {
    res.render("recover", {page: {title: "Recover your password"}});
};

var showRecoverSent = function(req, res, next) {
    res.render("recover-sent", {page: {title: "Recovery email sent"}});
};

var handleRecover = function(req, res, next) {

    var user = null,
        recovery,
        nickname = req.body.nickname,
        force = req.body.force;

    Step( 
        function () { 
            req.log.info({nickname: nickname}, "checking for user to recover");
            User.get(nickname, this);
        },
        function(err, result) {
            if (err) {
                if (err.name == "NoSuchThingError") {
                    req.log.info({nickname: nickname}, "No such user, can't recover");
                    res.status(400);
                    res.json({sent: false, noSuchUser: true, error: "There is no user with that nickname."});
                    return;
                } else {
                    throw err;
                }
            }
            user = result;
            if (!user.email) {
                req.log.info({nickname: nickname}, "User has no email address; can't recover.");
                // Done
                res.status(400);
                res.json({sent: false, noEmail: true, error: "This user account has no email address."});
                return;
            }
            if (force) {
                req.log.info({nickname: nickname}, "Forcing recovery regardless of existing recovery records.");
                this(null, []);
            } else {
                req.log.info({nickname: nickname}, "Checking for existing recovery records.");
                // Do they have any outstanding recovery requests?
                Recovery.search({nickname: nickname, recovered: false}, this);
            }
        },
        function(err, recoveries) {
            var stillValid;
            if (err) throw err;
            if (!recoveries || recoveries.length === 0) {
                req.log.info({nickname: nickname}, "No existing recovery records; continuing.");
                this(null);
                return;
            } 
            stillValid = _.filter(recoveries, function(reco) { return Date.now() - Date.parse(reco.timestamp) < Recovery.TIMEOUT; });
            if (stillValid.length > 0) {
                req.log.info({nickname: nickname, count: stillValid.length}, "Have an existing, valid recovery record.");
                // Done
                res.status(409);
                res.json({sent: false, existing: true, error: "You already requested a password recovery."});
            } else {
                req.log.info({nickname: nickname}, "Have old recovery records but they're timed out.");
                this(null);
            }
        },
        function(err) {
            if (err) throw err;
            req.log.info({nickname: nickname}, "Creating a new recovery record.");
            Recovery.create({nickname: nickname}, this);
        },
        function(err, recovery) {
            var recoveryURL;
            if (err) throw err;
            req.log.info({nickname: nickname}, "Generating recovery email output.");
            recoveryURL = URLMaker.makeURL("/main/recover/" + recovery.code);
            res.render("recovery-email-html",
                       {principal: user.profile,
                        principalUser: user,
                        recovery: recovery,
                        recoveryURL: recoveryURL,
                        layout: false},
                       this.parallel());
            res.render("recovery-email-text",
                       {principal: user.profile,
                        principalUser: user,
                        recovery: recovery,
                        recoveryURL: recoveryURL,
                        layout: false},
                       this.parallel());
        },
        function(err, html, text) {
            if (err) throw err;
            req.log.info({nickname: nickname}, "Sending recovery email.");
            Mailer.sendEmail({to: user.email,
                              subject: "Recover password for " + req.app.config.site,
                              text: text,
                              attachment: {data: html,
                                           type: "text/html",
                                           alternative: true}},
                             this);
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                req.log.info({nickname: nickname}, "Finished with recovery");
                res.json({sent: true});
            }
        }
    );
};

var recoverCode = function(req, res, next) {
    
    var code = req.params.code;

    res.render("recover-code", {page: {title: "One moment please"},
                                code: code});
};

var redeemCode = function(req, res, next) {

    var code = req.body.code,
        recovery,
        user;

    Step(
        function() {
            Recovery.get(code, this);
        },
        function(err, results) {
            if (err) throw err;
            recovery = results;

            if (recovery.recovered) {
                throw new Error("This recovery code was already used.");
            }

            if (Date.now() - Date.parse(recovery.timestamp) > Recovery.TIMEOUT) {
                throw new Error("This recovery code is too old.");
            }

            User.get(recovery.nickname, this);
        },
        function(err, results) {
            if (err) throw err;
            user = results;
            setPrincipal(req.session, user.profile, this);
        },
        function(err) {
            if (err) throw err;
            user.expand(this);
        },
        function(err) {
            if (err) throw err;
            user.profile.expandFeeds(this);
        },
        function(err) {
            if (err) throw err;
            req.app.provider.newTokenPair(req.client, user, this);
        },
        function(err, pair) {
            if (err) throw err;

            user.token = pair.access_token;
            user.secret = pair.token_secret;

            // Now that we're done, mark this recovery code as done

            recovery.recovered = true;
            recovery.save(this);
        },
        function(err) {
            if (err) {
                req.log.error(err);
                res.status(400);
                res.json({error: err.message});
            } else {
                res.json(user);
            }
        }
    );
};

exports.addRoutes = addRoutes;
