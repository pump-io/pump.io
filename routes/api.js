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
    check = require('validator').check,
    HTTPError = require('../lib/httperror').HTTPError,
    Activity = require('../lib/model/activity').Activity,
    ActivityObject = require('../lib/model/activityobject').ActivityObject,
    User = require('../lib/model/user').User,
    Edge = require('../lib/model/edge').Edge,
    Stream = require('../lib/model/stream').Stream,
    Client = require('../lib/model/client').Client,
    mw = require('../lib/middleware'),
    URLMaker = require('../lib/urlmaker').URLMaker,
    reqUser = mw.reqUser,
    sameUser = mw.sameUser,
    NoSuchThingError = databank.NoSuchThingError,
    DEFAULT_ACTIVITIES = 20,
    DEFAULT_USERS = 20;

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
        Cls.search({'uuid': req.params.uuid}, function(err, results) {
            if (err instanceof NoSuchThingError) {
                next(new HTTPError(err.message, 404));
            } else if (err) {
                next(err);
            } else if (results.length === 0) {
                next(new HTTPError("Can't find a " + type + " with ID = " + req.params.uuid, 404));
            } else if (results.length > 1) {
                next(new HTTPError("Too many " + type + " objects with ID = " + req.params.uuid, 500));
            } else {
                req[type] = results[0];
                next();
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
        obj.del(function(err) {
            if (err) {
                next(err);
            } else {
                res.json("Deleted");
            }
        });
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
    Activity.search({'uuid': req.params.uuid}, function(err, results) {
        if (err instanceof NoSuchThingError) {
            next(new HTTPError(err.message, 404));
        } else if (err) {
            next(err);
        } else if (results.length === 0) {
            next(new HTTPError("Can't find an activity with ID = " + req.params.uuid, 404));
        } else if (results.length > 1) {
            next(new HTTPError("Too many activities with ID = " + req.params.uuid, 500));
        } else {
            req.activity = results[0];
            next();
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
    req.activity.del(function(err) {
        if (err) {
            next(err);
        } else {
            res.json("Deleted");
        }
    });
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
    var start, cnt, end;

    var collection = {
        displayName: "Users of this service",
        id: URLMaker.makeURL("api/users"),
        objectTypes: ["user"]
    };

    start = (req.query.offset) ? parseInt(req.query.offset, 10) : 0;
    cnt = (req.query.cnt) ? parseInt(req.query.cnt, 10) : DEFAULT_USERS;
    end = start + cnt;

    Step(
        function () {
            bank.read('usercount', 0, this);
        },
        function(err, totalUsers) {
            if (err) throw err;
            collection.totalCount = totalUsers;
            bank.slice('userlist', 0, start, end, this);
        },
        function(err, userIds) {
            if (err) {
                if (err instanceof NoSuchThingError) { // may catch err in prev func
                    collection.totalCount = 0;
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
            if (err) throw err;
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

    var collection = {
        author: req.user.profile,
        displayName: "Activities by " + (req.user.profile.displayName || req.user.nickname),
        id: URLMaker.makeURL("api/user/" + req.user.nickname + "/feed"),
        objectTypes: ["activity"],
        items: []
    };

    var start, cnt, end;

    start = (req.query.offset) ? parseInt(req.query.offset, 10) : 0;
    cnt = (req.query.cnt) ? parseInt(req.query.cnt, 10) : DEFAULT_ACTIVITIES;
    end = start + cnt;

    Step(
        function() {
            // XXX: stuff this into User
            bank.read('streamcount', req.user.nickname + "-outbox", this);
        },
        function(err, totalOutbox) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    collection.totalCount = 0;
                    res.json(collection);
                } else {
                    throw err;
                }
            } else {
                collection.totalCount = totalOutbox;
                req.user.getStream(start, end, this);
            }
        },
        function(err, activities) {
            if (err) {
                next(err);
            } else {
                activities.forEach(function(el, i, arr) {
                    // remove internal uuid info, if any
                    delete el.actor;
                    delete el.uuid;
                });

                collection.items = activities;

                res.json(collection);
            }
        }
    );
};

var userInbox = function(req, res, next) {

    var collection = {
        author: req.user.profile,
        displayName: "Activities for " + (req.user.profile.displayName || req.user.nickname),
        id: URLMaker.makeURL("api/user/" + req.user.nickname + "/inbox"),
        objectTypes: ["activity"],
        items: []
    };
    var start, cnt, end;

    start = (req.query.offset) ? parseInt(req.query.offset, 10) : 0;
    cnt = (req.query.cnt) ? parseInt(req.query.cnt, 10) : DEFAULT_ACTIVITIES;
    end = start + cnt;

    Step(
        function() {
            // XXX: stuff this into User
            bank.read('streamcount', req.user.nickname + "-inbox", this);
        },
        function(err, inboxCount) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    collection.totalCount = 0;
                    res.json(collection);
                } else {
                    throw err;
                }
            } else {
                collection.totalCount = inboxCount;
                req.user.getInbox(start, end, this);
            }
        },
        function(err, activities) {
            if (err) {
                next(err);
            } else {
                collection.items = activities;
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
