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

var databank = require('databank'),
    _ = require('underscore'),
    Step = require('step'),
    validator = require('validator'),
    check = validator.check,
    sanitize = validator.sanitize,
    HTTPError = require('../lib/httperror').HTTPError,
    Activity = require('../lib/model/activity').Activity,
    ActivityObject = require('../lib/model/activityobject').ActivityObject,
    User = require('../lib/model/user').User,
    Edge = require('../lib/model/edge').Edge,
    Stream = require('../lib/model/stream').Stream,
    Client = require('../lib/model/client').Client,
    Tombstone = require('../lib/model/tombstone').Tombstone,
    mw = require('../lib/middleware'),
    URLMaker = require('../lib/urlmaker').URLMaker,
    reqUser = mw.reqUser,
    sameUser = mw.sameUser,
    NoSuchThingError = databank.NoSuchThingError,
    AlreadyExistsError = databank.AlreadyExistsError,
    DEFAULT_ITEMS = 20,
    DEFAULT_ACTIVITIES = DEFAULT_ITEMS,
    DEFAULT_FAVORITES = DEFAULT_ITEMS,
    DEFAULT_LIKES = DEFAULT_ITEMS,
    DEFAULT_FOLLOWERS = DEFAULT_ITEMS,
    DEFAULT_FOLLOWING = DEFAULT_ITEMS,
    DEFAULT_USERS = DEFAULT_ITEMS,
    MAX_ITEMS = DEFAULT_ITEMS * 10,
    MAX_ACTIVITIES = MAX_ITEMS,
    MAX_FAVORITES = MAX_ITEMS,
    MAX_LIKES = MAX_ITEMS,
    MAX_FOLLOWERS = MAX_ITEMS,
    MAX_FOLLOWING = MAX_ITEMS,
    MAX_USERS = MAX_ITEMS;

// Initialize the app controller

var addRoutes = function(app) {

    var i = 0, url, type, authz;

    // Users
    app.get('/api/user/:nickname', clientAuth, reqUser, getUser);
    app.put('/api/user/:nickname', userAuth, reqUser, sameUser, putUser);
    app.del('/api/user/:nickname', userAuth, reqUser, sameUser, delUser);

    // Feeds

    app.post('/api/user/:nickname/feed', userAuth, reqUser, sameUser, postActivity);
    // XXX: privileged access when authenticated
    app.get('/api/user/:nickname/feed', clientAuth, reqUser, userStream);

    // Inboxen

    app.get('/api/user/:nickname/inbox', userAuth, reqUser, sameUser, userInbox);
    app.post('/api/user/:nickname/inbox', notYetImplemented);

    app.get('/api/user/:nickname/followers', clientAuth, reqUser, userFollowers);
    app.get('/api/user/:nickname/following', clientAuth, reqUser, userFollowing);

    app.get('/api/user/:nickname/favorites', clientAuth, reqUser, userFavorites);

    for (i = 0; i < ActivityObject.objectTypes.length; i++) {

        type = ActivityObject.objectTypes[i];

        url = '/api/' + type + '/' + ':uuid';

        // person

        if (type === 'person') {
            authz = userOnly;
        } else {
            authz = authorOnly(type);
        }

        app.get(url, clientAuth, requester(type), getter(type));
        app.put(url, userAuth, requester(type), authz, putter(type));
        app.del(url, userAuth, requester(type), authz, deleter(type));

        app.get('/api/' + type + '/' + ':uuid/likes', clientAuth, requester(type), likes(type));
    }
    
    // Activities

    app.get('/api/activity/:uuid', clientAuth, reqActivity, getActivity);
    app.put('/api/activity/:uuid', userAuth, reqActivity, actorOnly, putActivity);
    app.del('/api/activity/:uuid', userAuth, reqActivity, actorOnly, delActivity);

    // Global user list

    app.get('/api/users', clientAuth, listUsers);
    app.post('/api/users', clientAuth, createUser);

    // Client registration

    app.post('/api/client/register', clientReg);
};

exports.addRoutes = addRoutes;

var bank = null;

var setBank = function(newBank) {
    bank = newBank;
};

exports.setBank = setBank;

// Accept either 2-legged or 3-legged OAuth

var clientAuth = function(req, res, next) {

    req.client = null;
    res.local('client', null); // init to null

    if (hasToken(req)) {
        userAuth(req, res, next);
        return;
    }

    req.authenticate(['client'], function(error, authenticated) { 

        if (error) {
            next(error);
            return;
        }

        if (!authenticated) {
            return;
        }
        
        req.client = req.getAuthDetails().user.client;
        res.local('client', req.client); // init to null

        next();
    });
};

var hasToken = function(req) {
    return (req &&
            (_(req.headers).has('authorization') && req.headers.authorization.match(/oauth_token/)) ||
            (req.query && req.query.oauth_token) ||
            (req.body && req.headers['content-type'] === 'application/x-www-form-urlencoded' && req.body.oauth_token));
};

// Accept only 3-legged OAuth
// XXX: It would be nice to merge these two functions

var userAuth = function(req, res, next) {

    req.remoteUser = null;
    res.local('remoteUser', null); // init to null
    req.client = null;
    res.local('client', null); // init to null

    req.authenticate(['user'], function(error, authenticated) { 

        if (error) {
            next(error);
            return;
        }

        if (!authenticated) {
            return;
        }

        req.remoteUser = req.getAuthDetails().user.user;
        res.local('remoteUser', req.remoteUser);

        req.client = req.getAuthDetails().user.client;
        res.local('client', req.client);

        next();
    });
};

var requester = function(type) {

    var Cls = ActivityObject.toClass(type);

    return function(req, res, next) {
        var uuid = req.params.uuid,
            obj = null;

        Cls.search({'uuid': uuid}, function(err, results) {
            if (err) {
                next(err);
            } else if (results.length === 0) {
                Tombstone.lookup(type, uuid, function(err, ts) {
                    if (err instanceof NoSuchThingError) {
                        next(new HTTPError("Can't find a " + type + " with ID = " + uuid, 404));
                    } else {
                        next(new HTTPError("The " + type + " with ID = " + uuid + " was deleted", 410));
                    }
                });
            } else if (results.length > 1) {
                next(new HTTPError("Too many " + type + " objects with ID = " + req.params.uuid, 500));
            } else {
                obj = results[0];
                obj.expand(function(err) {
                    if (err) {
                        next(err);
                    } else {
                        req[type] = obj;
                        next();
                    }
                });
            }
        });
    };
};

var userOnly = function(req, res, next) {
    var person = req.person,
        user = req.remoteUser;

    if (person && user && user.profile && person.id === user.profile.id && user.profile.objectType === 'person') { 
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

var actorOnly = function(req, res, next) {
    var act = req.activity;

    if (act && act.actor && act.actor.id == req.remoteUser.profile.id) {
        next();
    } else {
        next(new HTTPError("Only the actor can modify this object.", 403));
    }
};

var getter = function(type) {
    return function(req, res, next) {
        res.json(req[type]);
    };
};

var putter = function(type) {
    return function(req, res, next) {
        var obj = req[type];
        obj.update(req.body, function(err, result) {
            if (err) {
                next(err);
            } else {
                res.json(result);
            }
        });
    };
};

var deleter = function(type) {
    return function(req, res, next) {
        var obj = req[type];
        Step(
            function() {
                obj.del(this);
            },
            function(err) {
                if (err) throw err;
                Tombstone.mark(obj, this);
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
                    if (err instanceof NoSuchThingError) {
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

var getUser = function(req, res, next) {
    res.json(req.user);
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
    req.user.del(function(err) {
        if (err instanceof NoSuchThingError) { // unusual
            next(new HTTPError(err.message, 404));
        } else if (err) {
            next(err);
        } else {
            bank.decr('usercount', 0, function(err, value) {
                if (err) {
                    next(err);
                } else {
                    res.json("Deleted");
                }
            });
        }
    });
};

var reqActivity = function(req, res, next) {
    var act = null,
        uuid = req.params.uuid;
    Activity.search({'uuid': uuid}, function(err, results) {
        if (err) {
            next(err);
        } else if (results.length === 0) { // not found
            Tombstone.lookup('activity', uuid, function(err, ts) {
                if (err instanceof NoSuchThingError) {
                    next(new HTTPError("Can't find an activity with id " + uuid, 404));
                } else {
                    // Last-Modified?
                    next(new HTTPError("That activity was deleted.", 410));
                }
            });
        } else if (results.length > 1) {
            next(new HTTPError("Too many activities with ID = " + req.params.uuid, 500));
        } else {
            act = results[0];
            act.expand(function(err) {
                if (err) {
                    next(err);
                } else {
                    req.activity = act;
                    next();
                }
            });
        }
    });
};

var getActivity = function(req, res, next) {
    res.json(req.activity);
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
            act.del(this);
        },
        function(err) {
            if (err) throw err;
            Tombstone.markFull(act, 'activity', act.uuid, this);
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

var createUser = function (req, res, next) {

    var user;

    Step(
        function () {
            User.create(req.body, this);
        },
        function (err, value) {
            if (err) throw err;
            user = value;
            bank.prepend('userlist', 0, user.nickname, this);
        },
        function (err, userList) {
            if (err) throw err;
            bank.incr('usercount', 0, this);
        },
        function (err, userCount) {
            if (err) {
                next(err);
            } else {
                // Hide the password for output
                user.sanitize();
                res.json(user);
            }
        }
    );
};

var listUsers = function(req, res, next) {

    var collection = {
        displayName: "Users of this service",
        id: URLMaker.makeURL("api/users"),
        objectTypes: ["user"]
    };

    var args;

    try {
        args = streamArgs(req, DEFAULT_USERS, MAX_USERS);
    } catch (e) {
        next(e);
        return;
    }

    Step(
        function () {
            bank.read('usercount', 0, this);
        },
        function(err, totalUsers) {
            if (err) throw err;
            collection.totalItems = totalUsers;
            bank.slice('userlist', 0, args.start, args.end, this);
        },
        function(err, userIds) {
            if (err) {
                if (err instanceof NoSuchThingError) { // may catch err in prev func
                    collection.totalItems = 0;
                    collection.items = [];
                    res.json(collection);
                } else {
                    throw err;
                }
            } else if (userIds.length === 0) {
                collection.items = [];
                res.json(collection);
            } else {
                bank.readAll('user', userIds, this);
            }
        },
        function(err, userMap) {
            var users = [], id, user;
            if (err) throw err;

            for (id in userMap) {
                user = new User(userMap[id]);
                user.sanitize();
                users.push(user);
            }
            users.sort(function(a, b) {  
                if (a.published > b.published) {
                    return -1;  
                } else if (a.published < b.published) {
                    return 1;  
                } else {
                    return 0;  
                }
            });
            collection.items = users;
            res.json(collection);
        }
    );
};

var postActivity = function(req, res, next) {

    var activity = new Activity(req.body);

    // Add a default actor

    if (!_(activity).has('actor')) {
        activity.actor = req.user.profile;
    }

    // If the actor is incorrect, error

    if (activity.actor.id !== req.user.profile.id) {
        next(new HTTPError("Invalid actor", 400));
        return;
    }

    // Default verb

    if (!_(activity).has('verb') || _(activity.verb).isNull()) {
        activity.verb = "post";
    }

    Step(
        function() {
            // First, apply the activity
            activity.apply(req.user.profile, this);
        },
        function(err) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    throw new HTTPError(err.message, 400);
                } else if (err instanceof AlreadyExistsError) {
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
            req.user.addToOutbox(activity, this.parallel());
            req.user.addToInbox(activity, this.parallel());
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                // ...then show (possibly modified) results.
                res.json(activity);
                // ...then distribute.
                process.nextTick(function() {
                    distribute(activity, function(err) {});
                });
            }
        }
    );
};

var userStream = function(req, res, next) {

    var url = URLMaker.makeURL("api/user/" + req.user.nickname + "/feed"),
        collection = {
            author: req.user.profile,
            displayName: "Activities by " + (req.user.profile.displayName || req.user.nickname),
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
            // XXX: stuff this into User
            req.user.getOutboxStream(this);
        },
        function(err, outbox) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    collection.totalItems = 0;
                    res.json(collection);
                } else {
                    throw err;
                }
            } else {
                str = outbox;
                str.count(this);
            }
        },
        function(err, totalItems) {
            if (err) throw err;
            collection.totalItems = totalItems;
            if (totalItems === 0) {
                res.json(collection);
                return;
            }
            if (_(args).has('before')) {
                str.getIDsGreaterThan(args.before, args.count, this);
            } else if (_(args).has('since')) {
                str.getIDsLessThan(args.since, args.count, this);
            } else {
                str.getIDs(args.start, args.end, this);
            }
        },
        function(err, results) {
            if (err) throw err;
            ids = results;
            Activity.readArray(ids, this);
        },
        function(err, activities) {
            if (err) {
                next(err);
            } else {
                activities.forEach(function(el) {
                    delete el.actor;
                    delete el.uuid;
                });
                collection.items = activities;
                if (activities.length > 0) {
                    if ((_(args).has('start') && args.start > 0) ||
                        (_(args).has('before')) ||
                        (_(args).has('since'))) {
                        collection.links.prev = collection.url + "?since=" + encodeURIComponent(activities[0].id);
                    }
                    if ((_(args).has('start') && args.start + activities.length < collection.totalItems) ||
                        (_(args).has('before')) ||
                        (_(args).has('since'))) {
                        collection.links.next = collection.url + "?before=" + encodeURIComponent(activities[activities.length].id);
                    }
                }
                res.json(collection);
            }
        }
    );
};

var userInbox = function(req, res, next) {

    var url = URLMaker.makeURL("api/user/" + req.user.nickname + "/inbox"),
        collection = {
            author: req.user.profile,
            displayName: "Activities for " + (req.user.profile.displayName || req.user.nickname),
            id: url,
            objectTypes: ["activity"],
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
            // XXX: stuff this into User
            req.user.getInboxStream(this);
        },
        function(err, inbox) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    collection.totalItems = 0;
                    res.json(collection);
                } else {
                    throw err;
                }
            } else {
                str = inbox;
                str.count(this);
            }
        },
        function(err, totalItems) {
            if (err) throw err;
            collection.totalItems = totalItems;
            if (totalItems === 0) {
                res.json(collection);
                return;
            }
            if (_(args).has('before')) {
                str.getIDsGreaterThan(args.before, args.count, this);
            } else if (_(args).has('since')) {
                str.getIDsLessThan(args.since, args.count, this);
            } else {
                str.getIDs(args.start, args.end, this);
            }
        },
        function(err, ids) {
            if (err) throw err;
            Activity.readArray(ids, this);
        },
        function(err, activities) {
            if (err) {
                next(err);
            } else {
                activities.forEach(function(el) {
                    delete el.uuid;
                });
                collection.items = activities;
                if (activities.length > 0) {
                    if ((_(args).has('start') && args.start > 0) ||
                        (_(args).has('before')) ||
                        (_(args).has('since'))) {
                        collection.links.prev = collection.url + "?since=" + encodeURIComponent(activities[0].id);
                    }
                    if ((_(args).has('start') && args.start + activities.length < collection.totalItems) ||
                        (_(args).has('before')) ||
                        (_(args).has('since'))) {
                        collection.links.next = collection.url + "?before=" + encodeURIComponent(activities[activities.length].id);
                    }
                }
                res.json(collection);
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
                if (err instanceof NoSuchThingError) {
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
            if (err) {
                next(err);
            } else {
                collection.items = people;
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
                if (err instanceof NoSuchThingError) {
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
            if (err) {
                next(err);
            } else {
                collection.items = people;
                res.json(collection);
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
                if (err instanceof NoSuchThingError) {
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

var notYetImplemented = function(req, res, next) {
    next(new HTTPError("Not yet implemented", 500));
};

var distribute = function(activity, callback) {

    Step(
        function() {
            Edge.search({'to.id': activity.actor.id}, this);
        },
        function(err, follows) {
            if (err) throw err;
            var i, id, group = this.group();
            // Not all profiles are users, so we gotta get em
            for (i = 0; i < follows.length; i++) {
                id = follows[i].from.id;
                User.fromPerson(id, group());
            }
        },
        function(err, users) {
            var i, user, group = this.group();

            if (err) throw err;
            
            for (i = 0; i < users.length; i++) {
                user = users[i];
                if (user) {
                    user.addToInbox(activity, group);
                }
            }
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

var clientReg = function (req, res, next) {

    var params = req.body,
        props = {},
        type;

    if (!_(params).has('type')) {
        next(new HTTPError("No registration type provided", 400));
        return;
    }

    type = params.type;
    
    if (_(params).has('client_id')) {
        if (type !== 'client_update') {
            // XXX: log this
            next(new HTTPError("Only set client_id for update.", 400));
            return;
        }
        props.consumer_key = params.client_id;
    }

    if (_(params).has('access_token')) {
        next(new HTTPError("access_token not needed for registration.", 400));
        return;
    }

    if (_(params).has('client_secret')) {
        if (type !== 'client_update') {
            // XXX: log this
            next(new HTTPError("Only set client_secret for update.", 400));
            return;
        }
        props.secret = params.client_secret;
    }

    if (_(params).has('contacts')) {
        props.contacts = params.contacts.split(" ");
        if (!props.contacts.every(function(contact) {
                try {
                    check(contact).isEmail();
                    return true;
                } catch (err) {
                    return false;
                }
            })) {
            next(new HTTPError("contacts must be space-separate email addresses.", 400));
            return;
        }
    }

    if (_(params).has('application_type')) {
        if (params.application_type !== 'web' && params.application_type !== 'native') {
            next(new HTTPError("Unknown application_type.", 400));
            return;
        }
        props.type = params.application_type;
    } else {
        props.type = null;
    }

    if (_(params).has('application_name')) {
        props.title = params.application_name;
    }

    if (_(params).has('logo_url')) {
        try {
            check(params.logo_url).isUrl();
            props.logo_url = params.logo_url;
        } catch (e) {
            next(new HTTPError("Invalid logo_url.", 400));
            return;
        }
    }

    if (_(params).has('redirect_uris')) {
        props.redirect_uris = params.redirect_uris.split(" ");
        if (!props.redirect_uris.every(function(uri) {
                try {
                    check(uri).isUrl();
                    return true;
                } catch (err) {
                    return false;
                }
            })) {
            next(new HTTPError("redirect_uris must be space-separated URLs.", 400));
            return;
        }
    }

    if (type === 'client_associate') {
        Client.create(props, function(err, client) {
            if (err) {
                next(err);
            } else {
                res.json({client_id: client.consumer_key,
                          client_secret: client.secret,
                          expires_at: 0});
            }
        });
    } else if (type === 'client_update') {
        Client.get(props.consumer_key, function(err, client) {
            if (err) {
                next(err);
            } else if (client.secret !== props.secret) {
                // XXX: log this
                next(new HTTPError("Unauthorized", 403));
            } else {
                client.update(props, function(err, client) {
                    if (err) {
                        next(err);
                    } else {
                        res.json({client_id: client.consumer_key,
                                  client_secret: client.secret,
                                  expires_at: 0});
                    }
                });
            }
        });
    } else {
        next(new HTTPError("Invalid registration type", 400));
        return;
    }
};

// Since most stream endpoints take the same arguments,
// consolidate validation and parsing here

var streamArgs = function(req, defaultCount, maxCount) {

    var args = {};

    try {
        if (_(maxCount).isUndefined()) {
            maxCount = 10 * defaultCount;
        }

        if (_(req.query).has('count')) {
            check(req.query.count, "Count must be between 0 and " + maxCount).isInt().min(0).max(maxCount);
            args.count = sanitize(req.query.count).toInt();
        } else {
            args.count = defaultCount;
        }

        // XXX: Check 'before' and 'since' for injection...?
        // XXX: Check 'before' and 'since' for URI...?

        if (_(req.query).has('before')) {
            check(req.query.before).notEmpty();
            args.before = sanitize(req.query.before).trim();
        }

        if (_(req.query).has('since')) {
            if (_(args).has('before')) {
                throw new Error("Can't have both 'before' and 'since' parameters");
            }
            check(req.query.since).notEmpty();
            args.since = sanitize(req.query.since).trim();
        }

        if (_(req.query).has('offset')) {
            if (_(args).has('before')) {
                throw new Error("Can't have both 'before' and 'offset' parameters");
            }
            if (_(args).has('since')) {
                throw new Error("Can't have both 'since' and 'offset' parameters");
            }
            check(req.query.offset, "Offset must be an integer greater than or equal to zero").isInt().min(0);
            args.start = sanitize(req.query.offset).toInt();
        }

        if (!_(req.query).has('offset') && !_(req.query).has('since') && !_(req.query).has('before')) {
            args.start = 0;
        }

        if (_(args).has('start')) {
            args.end = args.start + args.count;
        }

        return args;
    } catch (e) {
        throw new HTTPError(e.message, 400);
    }
};
