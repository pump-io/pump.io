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

var Activity = require('../model/activity').Activity,
    connect = require('connect'),
    User = require('../model/user').User,
    Edge = require('../model/edge').Edge,
    databank = require('databank'),
    _ = require('underscore'),
    Stream = require('../model/stream').Stream,
    Step = require('step'),
    mw = require('../lib/middleware'),
    maybeAuth = mw.maybeAuth,
    reqUser = mw.reqUser,
    mustAuth = mw.mustAuth,
    sameUser = mw.sameUser,
    noUser = mw.noUser,
    NoSuchThingError = databank.NoSuchThingError;

// Initialize the app controller

var initRoutes = function(app) {

    var i = 0, url, type, authz;

    // Users
    app.get('/api/user/:nickname', maybeAuth, reqUser, getUser);
    app.put('/api/user/:nickname', mustAuth, reqUser, sameUser, putUser);
    app.del('/api/user/:nickname', mustAuth, reqUser, sameUser, delUser);

    // Feeds

    app.post('/api/user/:nickname/feed', mustAuth, reqUser, sameUser, postActivity);
    app.get('/api/user/:nickname/feed', maybeAuth, reqUser, userStream); // XXX: privileged access when authenticated

    // Inboxen

    app.get('/api/user/:nickname/inbox', mustAuth, reqUser, sameUser, userInbox);
    app.post('/api/user/:nickname/inbox', notYetImplemented);

    for (i = 0; i < Activity.objectTypes.length; i++) {

        type = Activity.objectTypes[i];

        url = '/api/' + type + '/' + ':uuid';

        // person

	if (type === 'person') {
	    authz = userOnly;
	} else {
	    authz = authorOnly(type);
	}

        app.get(url, maybeAuth, requester(type), getter(type));
        app.put(url, mustAuth, requester(type), authz, putter(type));
        app.del(url, mustAuth, requester(type), authz, deleter(type));
    }
    
    // Activities

    app.get('/api/activity/:uuid', maybeAuth, requester('activity'), getter('activity'));
    app.put('/api/activity/:uuid', mustAuth, requester('activity'), actorOnly, putter('activity'));
    app.del('/api/activity/:uuid', mustAuth, requester('activity'), actorOnly, deleter('activity'));

    // Global user list

    app.get('/api/users', maybeAuth, listUsers);
    app.post('/api/users', noUser, createUser);
};

exports.initRoutes = initRoutes;

var requester = function(type) {

    var Cls = Activity.toClass(type);

    return function(req, res, next) {
        Cls.search({'uuid': req.params.uuid}, function(err, results) {
            if (err instanceof NoSuchThingError) {
                next(err, 404);
            } else if (err) {
                next(err);
            } else if (results.length === 0) {
                next(new Error("Can't find a " + type + " with ID = " + req.params.uuid), 404);
            } else if (results.length > 1) {
                next(new Error("Too many " + type + " objects with ID = " + req.params.uuid), 500);
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
        next(new Error("Only the user can modify this profile."), 403);
    }
};

var authorOnly = function(type) {

    return function(req, res, next) {
        var obj = req[type];

        if (obj && obj.author && obj.author.id == req.remoteUser.profile.id) {
            next();
        } else {
            next(new Error("Only the author can modify this object."), 403);
        }
    };
};

var actorOnly = function(req, res, next) {
    var act = req.activity;

    if (act && act.actor && act.actor.id == req.remoteUser.profile.id) {
        next();
    } else {
        next(new Error("Only the actor can modify this object."), 403);
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
            next(err, 404);
        } else if (err) {
            next(err);
        } else {
            this.bank.decr('usercount', 0, function(err, value) {
                if (err) {
                    next(err);
                } else {
                    res.json("Deleted");
                }
            });
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
            pump.bank.prepend('userlist', 0, user.nickname, this);
        },
        function (err, userList) {
            if (err) throw err;
            pump.bank.incr('usercount', 0, this);
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
    var bank = this.bank,
        start, cnt, end;

    var collection = {
        displayName: "Users of this service",
        id: this.makeURL("api/users"),
        objectTypes: ["user"]
    };

    start = (req.query.offset) ? parseInt(req.query.offset, 10) : 0;
    cnt = (req.query.cnt) ? parseInt(req.query.cnt, 10) : this.DEFAULT_USERS;
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
                if (err instanceof NoSuchThingError) {
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
            req.user.addToOutbox(activity, this);
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
        id: this.makeURL("api/user/" + req.user.nickname + "/feed"),
        objectTypes: ["activity"],
        items: []
    };

    var start, cnt, end, pump = PumpAPI, bank = this.bank;

    start = (req.query.offset) ? parseInt(req.query.offset, 10) : 0;
    cnt = (req.query.cnt) ? parseInt(req.query.cnt, 10) : pump.DEFAULT_ACTIVITIES;
    end = start + cnt;

    Step(
        function() {
            // XXX: stuff this into User
            bank.read('streamcount', req.user.nickname + "-outbox", this);
        },
        function(err, totalOutbox) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    res.json(collection);
                } else {
                    throw err;
                }
            } else {
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
        id: this.makeURL("api/user/" + req.user.nickname + "/inbox"),
        objectTypes: ["activity"],
        items: []
    };
    var start, cnt, end, pump = PumpAPI, bank = this.bank;

    start = (req.query.offset) ? parseInt(req.query.offset, 10) : 0;
    cnt = (req.query.cnt) ? parseInt(req.query.cnt, 10) : this.DEFAULT_ACTIVITIES;
    end = start + cnt;

    Step(
        function() {
            // XXX: stuff this into User
            bank.read('streamcount', req.user.nickname + "-inbox", this);
        },
        function(err, inboxCount) {
            if (err) {
                if (err instanceof NoSuchThingError) {
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
    PumpAPI.showError(res, new Error("Not yet implemented"));
};

var makeURL = function(relative) {
    if (this.port != 80) {
        return 'http://'+this.hostname+':'+this.port+'/'+relative;
    } else {
        return 'http://'+this.hostname+'/'+relative;
    }
};

var getSchema = function() {

    var i, type, Cls, schema = {};

    schema.activity = Activity.schema;
    schema.user = User.schema;
    schema.edge = Edge.schema;
    schema.outbox = {'pkey': 'id'};
    schema.outboxcount = {'pkey': 'id'};
    schema.userlist = {'pkey': 'id'};
    schema.usercount = {'pkey': 'id'};
    schema.feedcount = {'pkey': 'id'};

    _.extend(schema, Stream.schema);

    for (i = 0; i < Activity.objectTypes.length; i++) {
        type = Activity.objectTypes[i];
        Cls = Activity.toClass(type);
        if (Cls.schema) {
            schema[type] = Cls.schema;
        } else {
            schema[type] = {'pkey': 'id',
                            'fields': ['updated', 'published', 'displayName', 'url'],
                            'indices': ['uuid', 'author.id']};
        }
    }

    return schema;
};
    
var distribute = function(activity, callback) {
    var bank = this.bank;

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

var getCurrentUser = function(req, res, callback) {
    var pump = this;

    if (req.session.nickname) {
        pump.getSessionUser(req, res, callback);
    } else if (req.headers.authorization) {
        pump.getBasicAuthUser(req, res, callback);
    } else {
        callback(null, null);
    }
};

var getBasicAuthUser = function(req, res, callback) {
    var authorization = req.headers.authorization;
    var parts = authorization.split(' '), 
        scheme = parts[0],
        credentials = new Buffer(parts[1], 'base64').toString().split(':'),
        nickname,
        password,
        user;

    if ('Basic' != scheme) {
        callback(new Error("Unknown auth scheme " + scheme), null);
    } else {
        nickname = credentials[0];
        password = credentials[1];
	this.checkCredentials(nickname, password, callback);
    }
};
