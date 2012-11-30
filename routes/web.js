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
    sa = require("../lib/sessionauth"),
    he = require("../lib/httperror"),
    HTTPError = he.HTTPError,
    reqUser = mw.reqUser,
    principal = sa.principal,
    setPrincipal = sa.setPrincipal,
    clearPrincipal = sa.clearPrincipal,
    clientAuth = mw.clientAuth,
    userAuth = mw.userAuth,
    NoSuchThingError = databank.NoSuchThingError;

var addRoutes = function(app) {

    app.get("/", app.session, principal, showMain);

    app.get("/main/register", app.session, principal, showRegister);

    app.get("/main/login", app.session, principal, showLogin);
    app.post("/main/login", app.session, clientAuth, handleLogin);

    app.post("/main/logout", app.session, userAuth, principal, handleLogout);

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
            if (err) {
                next(err);
            } else {
                res.render("inbox", {page: { title: "Home" },
                                     data: {user: user,
                                            profile: profile,
                                            major: major,
                                            minor: minor}});
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
            getFavorites(this);
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
            Step(
                function() {
                    req.user.getFollowers(0, 20, this);
                },
                function(err, followers) {
                    if (err) throw err;
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
            getFollowers(this);
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
            Step(
                function() {
                    req.user.getFollowing(0, 20, this);
                },
                function(err, following) {
                    if (err) throw err;
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
            getFollowing(this);
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
            user.getLists(this);
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

    var user = req.user;

    Step(
        function() {
            getAllLists(user, this);
        },
        function(err, lists) {
            if (err) {
                next(err);
            } else {
                res.render("lists", {page: {title: req.user.profile.displayName + " - Lists"},
                                     data: {user: req.user,
                                            profile: req.person,
                                            lists: lists}});
            }
        }
    );
};

var showList = function(req, res, next) {

    var user = req.user,
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
        },
        function(err, lists, list) {
            if (err) {
                next(err);
            } else {
                res.render("list", {page: {title: req.user.profile.displayName + " - Lists"},
                                     data: {user: req.user,
                                            profile: req.person,
                                            lists: lists,
                                            list: list}});
            }
        }
    );
};

exports.addRoutes = addRoutes;
