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
    publicOnly = require("../lib/filters").publicOnly,
    objectPublicOnly = require("../lib/filters").objectPublicOnly,
    Activity = require("../lib/model/activity").Activity,
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    AccessToken = require("../lib/model/accesstoken").AccessToken,
    User = require("../lib/model/user").User,
    Collection = require("../lib/model/collection").Collection,
    mw = require("../lib/middleware"),
    he = require("../lib/httperror"),
    HTTPError = he.HTTPError,
    maybeAuth = mw.maybeAuth,
    reqUser = mw.reqUser,
    mustAuth = mw.mustAuth,
    sameUser = mw.sameUser,
    noUser = mw.noUser,
    userAuth = mw.userAuth,
    clientAuth = mw.clientAuth,
    NoSuchThingError = databank.NoSuchThingError;

var addRoutes = function(app) {

    app.get("/", showMain);

    app.get("/main/register", showRegister);

    app.get("/main/login", showLogin);
    app.post("/main/login", clientAuth, handleLogin);

    app.post("/main/logout", userAuth, handleLogout);

    app.get("/:nickname", reqUser, showStream);
    app.get("/:nickname/favorites", reqUser, showFavorites);
    app.get("/:nickname/followers", reqUser, showFollowers);
    app.get("/:nickname/following", reqUser, showFollowing);

    app.get("/:nickname/lists", reqUser, showLists);
    app.get("/:nickname/list/:uuid", reqUser, showList);

    app.get("/:nickname/activity/:uuid", reqUser, showActivity);

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
    res.render("main", {page: {title: "Welcome"}});
};

var showRegister = function(req, res, next) {
    res.render("register", {page: {title: "Register"}});
};

var showLogin = function(req, res, next) {
    res.render("login", {page: {title: "Login"}});
};

var handleLogout = function(req, res, next) {
    Step(
        function() {
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

var templates = {};

var compileTemplate = function(name, callback) {

    if (_.has(templates, name)) {
        callback(null, templates[name]);
        return;
    }

    Step(
        function() {
            var filename = path.join(__dirname, "..", "public", "template", name + ".utml");
            fs.readFile(filename, this);
        },
        function(err, data) {
            var fn;
            if (err) {
                callback(err, null);
            } else {
                try {
                    fn = _.template(data.toString());
                    templates[name] = fn;
                    callback(null, fn);
                } catch (e) {
                    callback(e, null);
                }
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
        getData = function(callback) {
            Step(
                function() {
                    req.user.getMajorOutboxStream(this.parallel());
                    req.user.getMinorOutboxStream(this.parallel());
                },
                function(err, majorStream, minorStream) {
                    if (err) throw err;
                    getFiltered(majorStream, publicOnly, 0, 20, this.parallel());
                    getFiltered(minorStream, publicOnly, 0, 20, this.parallel());
                },
                function(err, majorActivities, minorActivities) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, {major: majorActivities,
                                        minor: minorActivities,
                                        profile: req.user.profile});
                    }
                }
            );
        };

    Step(
        function() {
            getData(this);
        },
        function(err, data) {
            if (err) {
                next(err);
            } else {
                res.render("user", {page: {title: req.user.profile.displayName},
                                    data: data});
            }
        }
    );
};


var showFavorites = function(req, res, next) {

    var pump = this,
        getData = function(callback) {
            Step(
                function() {
                    req.user.favoritesStream(this);
                },
                function(err, faveStream) {
                    var filtered;
                    if (err) throw err;
                    filtered = new FilteredStream(faveStream, objectPublicOnly);
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
                        callback(null, {objects: objects,
                                        profile: req.user.profile});
                    }
                }
            );
        };

    Step(
        function() {
            getData(this);
        },
        function(err, data) {
            if (err) {
                next(err);
            } else {
                res.render("favorites", {page: {title: req.user.nickname + " favorites"},
                                         data: data});
            }
        }
    );
};

var showFollowers = function(req, res, next) {

    var pump = this,
        getData = function(callback) {
            Step(
                function() {
                    req.user.getFollowers(0, 20, this);
                },
                function(err, followers) {
                    if (err) throw err;
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, {people: followers,
                                        profile: req.user.profile});
                    }
                }
            );
        };

    Step(
        function() {
            getData(this);
        },
        function(err, data) {
            if (err) {
                next(err);
            } else {
                res.render("followers", {page: {title: req.user.nickname + " followers"},
                                         data: data});
            }
        }
    );
};

var showFollowing = function(req, res, next) {

    var pump = this,
        getData = function(callback) {
            Step(
                function() {
                    req.user.getFollowing(0, 20, this);
                },
                function(err, following) {
                    if (err) throw err;
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, {people: following,
                                        profile: req.user.profile});
                    }
                }
            );
        };

    Step(
        function() {
            getData(this.parallel());
        },
        function(err, data) {
            if (err) {
                next(err);
            } else {
                res.render("following", {page: {title: req.user.nickname + " following"},
                                         data: data});
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
            req.session.nickname = user.nickname;
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
