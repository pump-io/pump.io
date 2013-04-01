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
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    Step = require("step"),
    _ = require("underscore"),
    validator = require("validator"),
    check = validator.check,
    sanitize = validator.sanitize,
    FilteredStream = require("../lib/filteredstream").FilteredStream,
    filters = require("../lib/filters"),
    publicOnly = filters.publicOnly,
    objectPublicOnly = filters.objectPublicOnly,
    recipientsOnly = filters.recipientsOnly,
    objectRecipientsOnly = filters.objectRecipientsOnly,
    always = filters.always,
    Activity = require("../lib/model/activity").Activity,
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    AccessToken = require("../lib/model/accesstoken").AccessToken,
    User = require("../lib/model/user").User,
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
    saveUpload = require("../lib/saveupload").saveUpload,
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
    addProxy = finishers.addProxy,
    addProxyObjects = finishers.addProxyObjects,
    firstFewReplies = finishers.firstFewReplies,
    firstFewShares = finishers.firstFewShares,
    addFollowed = finishers.addFollowed,
    requestObject = omw.requestObject;

var addRoutes = function(app) {

    app.get("/", app.session, principal, addMessages, showMain);

    app.get("/main/register", app.session, principal, showRegister);
    app.post("/main/register", app.session, principal, clientAuth, reqGenerator, createUser);

    app.get("/main/login", app.session, principal, showLogin);
    app.post("/main/login", app.session, clientAuth, handleLogin);

    app.post("/main/logout", app.session, someReadAuth, handleLogout);

    app.post("/main/renew", app.session, userAuth, principal, renewSession);

    app.get("/main/remote", app.session, principal, showRemote);
    app.post("/main/remote", app.session, handleRemote);

    app.get("/main/authorized/:hostname", app.session, reqHost, reqToken, authorized);
    
    if (app.config.uploaddir) {
        app.post("/main/upload", app.session, principal, principalUserOnly, uploadFile);
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

    app.get("/:nickname/activity/:uuid", app.session, principal, addMessages, requestActivity, reqUser, userIsActor, principalActorOrRecipient, showActivity);

    app.get("/:nickname/:type/:uuid", app.session, principal, addMessages, requestObject, reqUser, userIsAuthor, principalAuthorOrRecipient, showObject);

    // expose this one file over the web

    app.get("/shared/showdown.js", sharedFile("showdown/src/showdown.js"));
    app.get("/shared/underscore.js", sharedFile("underscore/underscore.js"));
    app.get("/shared/underscore-min.js", sharedFile("underscore/underscore-min.js"));

    app.post("/main/proxy", app.session, principal, principalNotUser, proxyActivity);
};

var sharedFile = function(fname) {
    return function(req, res, next) {
        res.sendfile(path.join(__dirname, "..", "node_modules", fname));
    };
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
        res.render("main", {page: {title: "Welcome"}});
    }
};

var showInbox = function(req, res, next) {

    var pump = this,
        user = req.principalUser,
        profile = req.principal,
        getMajor = function(callback) {
            var activities;
            Step(
                function() {
                    user.getMajorInboxStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    str.getIDs(0, 20, this);
                },
                function(err, ids) {
                    if (err) throw err;
                    Activity.readArray(ids, this);
                },
                function(err, results) {
                    var objects;
                    if (err) throw err;
                    activities = results;
                    objects = _.pluck(activities, "object");
                    addLiked(profile, objects, this.parallel());
                    addShared(profile, objects, this.parallel());
                    addLikers(profile, objects, this.parallel());
                    firstFewReplies(profile, objects, this.parallel());
                    firstFewShares(profile, objects, this.parallel());
                    if (user) {
                        addProxy(activities, this.parallel());
                    }
                },
                function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, activities);
                    }
                }
            );
        },
        getMinor = function(callback) {
            Step(
                function() {
                    user.getMinorInboxStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    str.getIDs(0, 20, this);
                },
                function(err, ids) {
                    if (err) throw err;
                    Activity.readArray(ids, this);
                },
                callback
            );
        };

    Step(
        function() {
            getMajor(this.parallel());
            getMinor(this.parallel());
        },
        function(err, major, minor) {
            if (err) {
                next(err);
            } else {
                res.render("inbox", {page: { title: "Home" },
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
        res.render("register", {page: {title: "Register"}});
    }
};

var showLogin = function(req, res, next) {
    res.render("login", {page: {title: "Login"}});
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
    res.render("remote", {page: {title: "Remote login"}});
};

var handleRemote = function(req, res, next) {

    var webfinger = req.body.webfinger,
        hostname,
        parts,
        host;

    try {
        check(webfinger).isEmail();
    } catch(e) {
        next(new HTTPError(e.message, 400));
        return;
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
            Activity.search({"uuid": req.params.uuid}, this);
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

var principalActorOrRecipient = function(req, res, next) {

    var person = req.principal,
        activity = req.activity;

    if (activity && activity.actor && person && activity.actor.id == person.id) {
        next();
    } else {
        Step(
            function() {
                activity.checkRecipient(person, this);
            },
            function(err, isRecipient) {
                if (err) {
                    next(err);
                } else if (isRecipient) {
                    next();
                } else {
                    next(new HTTPError("Only the author and recipients can view this activity.", 403));
                }
            }
        );
    }
};

var showActivity = function(req, res, next) {

    var activity = req.activity;

    if (activity.isMajor()) {
        res.render("major-activity-page", {page: {title: activity.content},
                                           principal: principal,
                                           activity: activity});
    } else {
        res.render("minor-activity-page", {page: {title: activity.content},
                                           principal: principal,
                                           activity: activity});
    }
};

var getFiltered = function(stream, filter, profile, start, end, callback) {
    var filtered = new FilteredStream(stream, filter);

    filtered = new FilteredStream(stream, filter),

    Step(
        function() {
            filtered.getIDs(start, end, this);
        },
        function(err, ids) {
            if (err) throw err;
            Activity.readArray(ids, this);
        },
        function(err, activities) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, activities);
            }
        }
    );
};

var showStream = function(req, res, next) {
    var pump = this,
        principal = req.principal,
        filter,
        getMajor = function(callback) {
            var activities;
            Step(
                function() {
                    req.user.getMajorOutboxStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    getFiltered(str, filter, principal, 0, 20, this);
                },
                function(err, results) {
                    var objects;
                    activities = results;
                    objects = _.pluck(activities, "object");
                    addLiked(principal, objects, this.parallel());
                    addShared(principal, objects, this.parallel());
                    addLikers(principal, objects, this.parallel());
                    firstFewReplies(principal, objects, this.parallel());
                    firstFewShares(principal, objects, this.parallel());
                    if (req.principalUser) {
                        addProxy(activities, this.parallel());
                    }
                },
                function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, activities);
                    }
                }
            );
        },
        getMinor = function(callback) {
            var activities;
            Step(
                function() {
                    req.user.getMinorOutboxStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    getFiltered(str, filter, principal, 0, 20, this);
                },
                function(err, results) {
                    if (err) throw err;
                    activities = results;
                    if (req.principalUser) {
                        addProxy(activities, this);
                    } else {
                        this(null);
                    }
                },
                function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, activities);
                    }
                }
            );
        };

    if (principal && (principal.id == req.user.profile.id)) {
        filter = always;
    } else if (principal) {
        filter = recipientsOnly(principal);
    } else {
        filter = publicOnly;
    }

    Step(
        function() {
            getMajor(this.parallel());
            getMinor(this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, major, minor) {
            if (err) {
                next(err);
            } else {
                res.render("user", {page: {title: req.user.profile.displayName},
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

    var pump = this,
        principal = req.principal,
        filter = (principal) ? ((principal.id == req.user.profile.id) ? always : objectRecipientsOnly(principal)) : objectPublicOnly,
        getFavorites = function(callback) {
            var objects;
            Step(
                function() {
                    req.user.favoritesStream(this);
                },
                function(err, faveStream) {
                    var filtered;
                    if (err) throw err;
                    filtered = new FilteredStream(faveStream, filter);
                    filtered.getObjects(0, 20, this);
                },
                function(err, refs) {
                    var group = this.group();
                    if (err) throw err;
                    _.each(refs, function(ref) {
                        ActivityObject.getObject(ref.objectType, ref.id, group());
                    });
                },
                function(err, results) {
                    if (err) throw err;
                    objects = results;
                    if (req.principalUser) {
                        addProxyObjects(objects, this);
                    } else {
                        this(null);
                    }
                },
                function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, objects);
                    }
                }
            );
        };

    Step(
        function() {
            getFavorites(this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, objects) {
            if (err) {
                next(err);
            } else {
                res.render("favorites", {page: {title: req.user.nickname + " favorites"},
                                         objects: objects,
                                         profile: req.user.profile,
                                         data: {
                                             objects: objects,
                                             profile: req.user.profile
                                         }
                                        });
            }
        }
    );
};

var showFollowers = function(req, res, next) {

    var pump = this,
        getFollowers = function(callback) {
            var followers;
            Step(
                function() {
                    req.user.getFollowers(0, 20, this);
                },
                function(err, results) {
                    if (err) throw err;
                    followers = results;
                    addFollowed(req.principal, followers, this.parallel());
                    if (req.principalUser) {
                        addProxyObjects(followers, this.parallel());
                    }
                },
                function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, followers);
                    }
                }
            );
        };

    Step(
        function() {
            getFollowers(this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, followers) {
            if (err) {
                next(err);
            } else {
                res.render("followers", {page: {title: req.user.nickname + " followers"},
                                         people: followers,
                                         profile: req.user.profile,
                                         data: {
                                             profile: req.user.profile,
                                             people: followers
                                         }
                                        });
            }
        }
    );
};

var showFollowing = function(req, res, next) {

    var pump = this,
        getFollowing = function(callback) {
            var following;
            Step(
                function() {
                    req.user.getFollowing(0, 20, this);
                },
                function(err, results) {
                    if (err) throw err;
                    following = results;
                    addFollowed(req.principal, following, this.parallel());
                    if (req.principalUser) {
                        addProxyObjects(following, this.parallel());
                    }
                },
                function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, following);
                    }
                }
            );
        };

    Step(
        function() {
            getFollowing(this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, following) {
            if (err) {
                next(err);
            } else {
                res.render("following", {page: {title: req.user.nickname + " following"},
                                         people: following,
                                         profile: req.user.profile,
                                         data: {
                                             profile: req.user.profile,
                                             people: following
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

var getAllLists = function(user, callback) {
    var lists;

    Step(
        function() {
            user.getLists("person", this);
        },
        function(err, str) {
            if (err) throw err;
            str.getItems(0, 100, this);
        },
        function(err, ids) {
            if (err) throw err;
            Collection.readAll(ids, this);
        },
        function(err, objs) {
            var group;
            if (err) throw err;
            lists = objs;
            group = this.group();
            // XXX: Unencapsulate this and do it in 1-2 calls
            _.each(lists, function(list) {
                list.expandFeeds(group());
            });
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, lists);
            }
        }
    );
};

var showLists = function(req, res, next) {

    var user = req.user,
        principal = req.principal;

    Step(
        function() {
            getAllLists(user, this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, lists) {
            if (err) {
                next(err);
            } else {
                res.render("lists", {page: {title: req.user.profile.displayName + " - Lists"},
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
        getList = function(user, uuid, callback) {
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
                    list.expandFeeds(this);
                },
                function(err) {
                    if (err) throw err;
                    list.getStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    str.getObjects(0, 20, this);
                },
                function(err, refs) {
                    var group = this.group();
                    if (err) throw err;
                    _.each(refs, function(ref) {
                        ActivityObject.getObject(ref.objectType, ref.id, group());
                    });
                },
                function(err, objs) {
                    if (err) throw err;
                    list.members.items = objs;
                    if (req.principalUser) {
                        addProxyObjects(list.members.items, this);
                    } else {
                        this(null);
                    }
                },
                function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, list);
                    }
                }
            );
        };

    Step(
        function() {
            getAllLists(user, this.parallel());
            getList(req.user, req.param.uuid, this.parallel());
            addFollowed(principal, [req.user.profile], this.parallel());
            req.user.profile.expandFeeds(this.parallel());
        },
        function(err, lists, list) {
            if (err) {
                next(err);
            } else {
                res.render("list", {page: {title: req.user.profile.displayName + " - Lists"},
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

var uploadFile = function(req, res, next) {

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
            saveUpload(user, mimeType, fileName, uploadDir, params, this);
        },
        function(err, obj) {
            var data;
            if (err) {
                req.log.error(err);
                data = {"success": false,
                        "error": "error message to display"};
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

var principalAuthorOrRecipient = function(req, res, next) {

    var type = req.type,
        obj = req[type],
        person = req.principal;

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
                res.render("object", {page: {title: title},
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

    var principal = req.principal;

    Step(
        function() {
            // We only need to set this if it's not already set
            setPrincipal(req.session, principal, this);
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                principal.sanitize();
                res.json(principal);
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
            if (err) {
                next(err);
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

    var user = req.principalUser,
        getMessages = function(callback) {
            Step(
                function() {
                    user.getMajorDirectInboxStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    str.getItems(0, 20, this);
                },
                function(err, ids) {
                    if (err) throw err;
                    Activity.readArray(ids, this);
                },
                callback
            );
        },
        getNotifications = function(callback) {
            Step(
                function() {
                    user.getMinorDirectInboxStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    str.getItems(0, 20, this);
                },
                function(err, ids) {
                    if (err) throw err;
                    Activity.readArray(ids, this);
                },
                callback
            );
        };

    // We only do this for registered users

    if (!user) {
        next(null);
        return;
    }

    Step(
        function() {
            getMessages(this.parallel());
            getNotifications(this.parallel());
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

exports.addRoutes = addRoutes;
