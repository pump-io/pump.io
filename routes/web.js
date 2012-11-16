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

    app.get("/:nickname/activity/:uuid", reqUser, showActivity);

    // For things that you can only see if you're logged in,
    // we redirect to the login page, then let you go there

    app.get("/main/settings", loginRedirect("/main/settings"));
};

var loginRedirect = function(rel) {
    return function(req, res, next) {
        res.redirect('/main/login?continue='+rel);
    };
};

var showMain = function(req, res, next) {
    res.render("main", {title: "Welcome"});
};

var showRegister = function(req, res, next) {
    res.render("register", {title: "Register"});
};

var showLogin = function(req, res, next) {
    res.render("login", {title: "Login"});
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
                res.render("activity", {title: "Welcome",
                                        user: req.remoteUser,
                                        activity: activity});
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

var getHelpers = function(helpers, callback) {
    Step(
        function() {
            var group = this.group();
            _.each(helpers, function(templateName) {
                compileTemplate(templateName, group());
            });
        },
        function(err, functions) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, _.object(_.keys(helpers), functions));
            }
        }
    );
};

var showStream = function(req, res, next) {
    var pump = this,
        helperNames = {"profileBlock": "profile-block",
                       "majorStream": "major-stream",
                       "sidebar": "sidebar",
                       "majorActivity": "major-activity-headless",
                       "minorActivity": "minor-activity-headless"},
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
            getData(this.parallel());
            getHelpers(helperNames, this.parallel());
        },
        function(err, data, helpers) {
            if (err) {
                next(err);
            } else {
                res.render("user", _.extend({title: req.user.nickname},
                                            data,
                                            helpers));
            }
        }
    );
};


var showFavorites = function(req, res, next) {

    var pump = this,
        helperNames = {"profileBlock": "profile-block",
                       "objectStream": "object-stream",
                       "majorObject": "major-object"},
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
            getData(this.parallel());
            getHelpers(helperNames, this.parallel());
        },
        function(err, data, helpers) {
            if (err) {
                next(err);
            } else {
                res.render("favorites", _.extend({title: req.user.nickname},
                                                 data,
                                                 helpers));
            }
        }
    );
};

var showFollowers = function(req, res, next) {

    var pump = this,
        helperNames = {"profileBlock": "profile-block",
                       "peopleStream": "people-stream",
                       "majorPerson": "major-person"},
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
            getData(this.parallel());
            getHelpers(helperNames, this.parallel());
        },
        function(err, data, helpers) {
            if (err) {
                next(err);
            } else {
                res.render("followers", _.extend({title: req.user.nickname},
                                                 data,
                                                 helpers));
            }
        }
    );
};

var showFollowing = function(req, res, next) {

    var pump = this,
        helperNames = {"profileBlock": "profile-block",
                       "peopleStream": "people-stream",
                       "majorPerson": "major-person"},
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
            getHelpers(helperNames, this.parallel());
        },
        function(err, data, helpers) {
            if (err) {
                next(err);
            } else {
                res.render("following", _.extend({title: req.user.nickname},
                                                 data,
                                                 helpers));
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
            user.expand(this);
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

exports.addRoutes = addRoutes;
