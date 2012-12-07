// routes/web.js
//
// Spurtin' out pumpy goodness all over your browser window
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
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    Step = require("step"),
    _ = require("underscore"),
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
    mw = require("../lib/middleware"),
    omw = require("../lib/objectmiddleware"),
    sa = require("../lib/sessionauth"),
    he = require("../lib/httperror"),
    Scrubber = require("../lib/scrubber"),
    finishers = require("../lib/finishers"),
    saveUpload = require("../lib/saveupload").saveUpload,
    api = require("./api"),
    HTTPError = he.HTTPError,
    reqUser = mw.reqUser,
    principal = sa.principal,
    setPrincipal = sa.setPrincipal,
    clearPrincipal = sa.clearPrincipal,
    principalUserOnly = sa.principalUserOnly,
    clientAuth = mw.clientAuth,
    userAuth = mw.userAuth,
    NoSuchThingError = databank.NoSuchThingError,
    createUser = api.createUser,
    addLiked = finishers.addLiked,
    addLikers = finishers.addLikers,
    firstFewReplies = finishers.firstFewReplies,
    addFollowed = finishers.addFollowed,
    requestObject = omw.requestObject;

var addRoutes = function(app) {

    app.get("/", app.session, principal, showMain);

    app.get("/main/register", app.session, principal, showRegister);
    app.post("/main/register", app.session, principal, clientAuth, createUser);

    app.get("/main/login", app.session, principal, showLogin);
    app.post("/main/login", app.session, clientAuth, handleLogin);

    app.post("/main/logout", app.session, userAuth, principal, handleLogout);

    if (app.config.uploaddir) {
        app.post("/main/upload", app.session, principal, principalUserOnly, uploadFile);
    }

    app.get("/:nickname", app.session, principal, reqUser, showStream);
    app.get("/:nickname/favorites", app.session, principal, reqUser, showFavorites);
    app.get("/:nickname/followers", app.session, principal, reqUser, showFollowers);
    app.get("/:nickname/following", app.session, principal, reqUser, showFollowing);

    app.get("/:nickname/lists", app.session, principal, reqUser, showLists);
    app.get("/:nickname/list/:uuid", app.session, principal, reqUser, showList);

    // For things that you can only see if you're logged in,
    // we redirect to the login page, then let you go there

    app.get("/main/settings", loginRedirect("/main/settings"));
    app.get("/main/account", loginRedirect("/main/account"));
    app.get("/main/avatar", loginRedirect("/main/avatar"));

    app.get("/:nickname/:type/:uuid", app.session, principal, requestObject, reqUser, userIsAuthor, principalAuthorOrRecipient, showObject);

    // expose this one file over the web

    app.get("/shared/showdown.js", sharedFile("showdown/src/showdown.js"));
    app.get("/shared/underscore.js", sharedFile("underscore/underscore.js"));
    app.get("/shared/underscore-min.js", sharedFile("underscore/underscore-min.js"));
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
                    addLikers(profile, objects, this.parallel());
                    firstFewReplies(profile, objects, this.parallel());
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
                callback
            );
        };

    Step(
        function() {
            getMajor(this.parallel());
            getMinor(this.parallel());
        },
        function(err, major, minor) {
            var data;
            if (err) {
                next(err);
            } else {
                data = {major: major,
                        minor: minor};
                if (user) {
                    data.user = user;
                }
                res.render("inbox", {page: { title: "Home" },
                                     data: data});
            }
        }
    );
};

var showRegister = function(req, res, next) {
    if (req.principal) {
        res.redirect("/");
    } else {
        res.render("register", {page: {title: "Register"}});
    }
};

var showLogin = function(req, res, next) {
    if (req.principal) {
        res.redirect("/");
    } else {
        res.render("login", {page: {title: "Login"}});
    }
};

var handleLogout = function(req, res, next) {
    Step(
        function() {
            clearPrincipal(req.session, this);
        },
        function(err) {
            if (err) throw err;
            AccessToken.search({"consumer_key": req.client.consumer_key,
                                "username": req.remoteUser.nickname},
                               this);
        },
        function(err, tokens) {
            var i, group = this.group();
            if (err) throw err;
            for (i = 0; i < tokens.length; i++) {
                // XXX: keep for auditing?
                tokens[i].del(group());
            }
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                req.remoteUser = null;
                res.json("OK");
            }
        }
    );
};

var showActivity = function(req, res, next) {
    var uuid = req.params.uuid,
        user = req.user;

    Step(
        function() {
            Activity.search({"uuid": req.params.uuid}, this);
        },
        function(err, activities) {
            if (err) throw err;
            if (activities.length === 0) {
                next(new NoSuchThingError("activity", uuid));
            }
            if (activities.length > 1) {
                next(new Error("Too many activities with ID = " + req.params.uuid));
            }
            activities[0].expand(this);
        },
        function(err, activity) {
            if (err) {
                next(err);
            } else {
                res.render("activity", {page: {title: "Welcome"},
                                        data: {user: req.remoteUser,
                                               activity: activity}});
            }
        }
    );
};

var getFiltered = function(stream, filter, start, end, callback) {
    var filtered = new FilteredStream(stream, filter);
    Step(
        function() {
            filtered.getIDs(0, 20, this);
        },
        function(err, ids) {
            if (err) throw err;
            Activity.readAll(ids, this);
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
        filter = (principal) ? 
            ((principal.id == req.user.id) ? always : recipientsOnly(principal)) : publicOnly,
        getMajor = function(callback) {
            Step(
                function() {
                    req.user.getMajorOutboxStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    getFiltered(str, filter, 0, 20, this.parallel());
                },
                callback
            );
        },
        getMinor = function(callback) {
            Step(
                function() {
                    req.user.getMajorOutboxStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    getFiltered(str, filter, 0, 20, this.parallel());
                },
                callback
            );
        };

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
                                    data: {major: major,
                                           minor: minor,
                                           profile: req.user.profile,
                                           user: req.principalUser}});
            }
        }
    );
};

var showFavorites = function(req, res, next) {

    var pump = this,
        principal = req.principal,
        filter = (principal) ? ((principal.id == req.user.profile.id) ? always : objectRecipientsOnly(principal)) : objectPublicOnly,
        getFavorites = function(callback) {
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
                function(err, objects) {
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
                                         data: {objects: objects,
                                                user: req.principalUser,
                                                profile: req.user.profile}});
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
                    addFollowed(req.principal, followers, this);
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
                                         data: {people: followers,
                                                user: req.principalUser,
                                                profile: req.user.profile}});
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
                    addFollowed(req.principal, following, this);
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
                                         data: {people: following,
                                                user: req.principalUser,
                                                profile: req.user.profile}});
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
        callback
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
                                     data: {user: req.principalUser,
                                            profile: req.user.profile,
                                            lists: lists}});
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
                    list = results;
                    list.expandFeeds(this);
                },
                function(err) {
                    if (err) throw err;
                    list.getStream(this);
                },
                function(err, str) {
                    if (err) throw err;
                    str.getObjects(0, 100, this);
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
                        callback(err, null);
                    } else {
                        list.members.items = objs;
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
                                    data: {user: req.principalUser,
                                           profile: req.user.profile,
                                           lists: lists,
                                           list: list}});
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
        user = req.principalUser,
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
            addLikers(profile, [obj], this.parallel());
            firstFewReplies(profile, [obj], this.parallel());
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
                                      data: {user: req.principalUser,
                                             object: obj}});
            }
        }
    );
};

exports.addRoutes = addRoutes;
