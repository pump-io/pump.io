// activitypump.js
//
// The beating heart of a pumpin' good time
//
// Copyright 2011, StatusNet Inc.
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

var Activity = require('./model/activity').Activity,
    bcrypt  = require('bcrypt'),
    connect = require('connect'),
    User = require('./model/user').User,
    Edge = require('./model/edge').Edge,
    databank = require('databank'),
    NoSuchThingError = databank.NoSuchThingError;

var ActivityPump = {
    
    bank: null,
    DEFAULT_USERS: 20,
    DEFAULT_ACTIVITIES: 20,

    initApp: function(app) {
        var i = 0, url, type;

        // Users
        app.get('/user/:nickname', ActivityPump.reqUser, ActivityPump.getUser);
        app.put('/user/:nickname', ActivityPump.userAuth, ActivityPump.reqUser, ActivityPump.sameUser, ActivityPump.putUser);
        app.del('/user/:nickname', ActivityPump.userAuth, ActivityPump.reqUser, ActivityPump.sameUser, ActivityPump.delUser);

        // Feeds

        app.post('/user/:nickname/feed', ActivityPump.userAuth, ActivityPump.reqUser, ActivityPump.sameUser, ActivityPump.postActivity);
        app.get('/user/:nickname/feed', ActivityPump.reqUser, ActivityPump.userFeed); // XXX: privileged access when authenticated

        // Inboxen

        app.get('/user/:nickname/inbox', ActivityPump.reqUser, ActivityPump.userInbox);
        app.post('/user/:nickname/inbox', ActivityPump.notYetImplemented);

        for (i = 0; i < Activity.objectTypes.length; i++) {

            type = Activity.objectTypes[i];

            url = '/' + type + '/' + ':uuid';

            // person

            app.get(url, ActivityPump.requester(type), ActivityPump.getter(type));
            app.put(url, ActivityPump.userAuth, ActivityPump.requester(type), ActivityPump.authorOnly(type), ActivityPump.putter(type));
            app.del(url, ActivityPump.userAuth, ActivityPump.requester(type), ActivityPump.authorOnly(type), ActivityPump.deleter(type));
        }
        
        // Activities

        app.get('/activity/:uuid', ActivityPump.requester('activity'), ActivityPump.getter('activity'));
        app.put('/activity/:uuid', ActivityPump.userAuth, ActivityPump.requester('activity'), ActivityPump.actorOnly, ActivityPump.putter('activity'));
        app.del('/activity/:uuid', ActivityPump.userAuth, ActivityPump.requester('activity'), ActivityPump.actorOnly, ActivityPump.deleter('activity'));

        // Global user list

        app.get('/users', ActivityPump.listUsers);
        app.post('/users', ActivityPump.createUser);
    },

    requester: function(type) {

        var Cls = Activity.toClass(type),
            pump = this;

        return function(req, res, next) {
            Cls.search({'uuid': req.params.uuid}, function(err, results) {
                if (err instanceof NoSuchThingError) {
                    pump.showError(res, err, 404);
                } else if (err) {
                    pump.showError(res, err);
                } else if (results.length === 0) {
                    pump.showError(res, new Error("Can't find a " + type + " with ID = " + req.params.uuid), 404);
                } else if (results.length > 1) {
                    pump.showError(res, new Error("Too many " + type + " objects with ID = " + req.params.uuid), 500);
                } else {
                    req[type] = results[0];
                    next();
                }
            });
        };
    },

    authorOnly: function(type) {
        var pump = this;
        return function(req, res, next) {
            var obj = req[type];

            if (obj && obj.author && obj.author.id == req.remoteUser.personId) {
                next();
            } else {
                pump.showError(res, new Error("Only the author can modify this object."), 403);
            }
        };
    },

    actorOnly: function(req, res, next) {
        var act = req.activity;

        if (act && act.actor && act.actor.id == req.remoteUser.personId) {
            next();
        } else {
            ActivityPump.showError(res, new Error("Only the actor can modify this object."), 403);
        }
    },

    getter: function(type) {
        var pump = this;
        return function(req, res, next) {
            pump.showData(res, req[type]);
        };
    },

    putter: function(type) {
        var pump = this;
        return function(req, res, next) {
            var obj = req[type];
            obj.update(req.body, function(err, result) {
                if (err) {
                    pump.showError(res, err);
                } else {
                    pump.showData(res, result);
                }
            });
        };
    },

    deleter: function(type) {
        var pump = this;
        return function(req, res, next) {
            var obj = req[type];
            obj.del(function(err) {
                if (err) {
                    pump.showError(res, err);
                } else {
                    pump.showData(res, "Deleted");
                }
            });
        };
    },

    checkCredentials: function(nickname, password, callback) {
        User.get(nickname, function(err, user) {
            if (err) {
                callback(err, null);
            } else {
                bcrypt.compare(password, user.passwordHash, function(err, res) {
                    if (err) {
                        callback(err, null);
                    } else {
                        // Don't percolate that hash around
                        user.sanitize();
                        callback(null, user);
                    }
                });
            }
        });
    },

    reqUser: function(req, res, next) {

        User.get(req.params.nickname, function(err, user) {
            if (err instanceof NoSuchThingError) {
                ActivityPump.showError(res, err, 404);
            } else if (err) {
                ActivityPump.showError(res, err);
            } else {
                user.sanitize();
                req.user = user;
                user.getPerson(function(err, person) {
                    if (err) {
                        ActivityPump.showError(res, err);
                    } else {
                        req.person = person;
                        next();
                    }
                });
            }
        });
    },

    sameUser: function(req, res, next) {
        if (!req.remoteUser ||
            !req.user ||
            req.remoteUser.nickname != req.user.nickname) {
            this.showError(res, new Error("Not authorized"), 403);
        } else {
            next();
        }
    },

    getUser: function(req, res) {
        ActivityPump.showData(res, req.user);
    },

    putUser: function(req, res, next) {

        var newUser = req.body;

        req.user.update(newUser, function(err, saved) {
            if (err) {
                ActivityPump.showError(res, err);
            } else {
                saved.sanitize();
                ActivityPump.showData(res, saved);
            }
        });
    },

    delUser: function(req, res, next) {
        req.user.del(function(err) {
            if (err instanceof NoSuchThingError) { // unusual
                ActivityPump.showError(res, err, 404);
            } else if (err) {
                ActivityPump.showError(res, err);
            } else {
                ActivityPump.bank.decr('usercount', 0, function(err, value) {
                    if (err) {
                        ActivityPump.showError(res, err);
                    } else {
                        ActivityPump.showData(res, "Deleted");
                    }
                });
            }
        });
    },

    createUser: function (req, res, next) {

        User.create(req.body, function(err, user) {
            if (err) {
                ActivityPump.showError(res, err);
            } else {
                ActivityPump.bank.prepend('userlist', 0, user.nickname, function(err, value) {
                    if (err) {
                        ActivityPump.showError(res, err);
                    } else {
                        ActivityPump.bank.incr('usercount', 0, function(err, value) {
                            if (err) {
                                ActivityPump.showError(res, err);
                            } else {
                                // Hide the password for output
                                user.sanitize();
                                ActivityPump.showData(res, user);
                            }
                        });
                    }
                });
            }
        });
    },

    listUsers: function(req, res, next) {
        var bank = ActivityPump.bank,
            start, cnt, end;

        start = (req.query.offset) ? parseInt(req.query.offset) : 0;
        cnt = (req.query.cnt) ? parseInt(req.query.cnt) : ActivityPump.DEFAULT_USERS;
        end = start + cnt;

        bank.read('usercount', 0, function(err, totalUsers) {
            if (err) {
                ActivityPump.showError(res, err);
            } else {
                bank.slice('userlist', 0, start, end, function(err, userIds) {
                    var collection = {
                        totalCount: totalUsers,
                        displayName: "Users of this service",
                        id: ActivityPump.makeURL("users"),
                        objectTypes: ["user"]
                    };
                    if (err) {
                        if (err instanceof NoSuchThingError) {
                            collection.items = [];
                            ActivityPump.showData(res, collection);
                        } else {
                            ActivityPump.showError(res, err);
                        }
                    } else {
                        if (userIds.length == 0) {
                            collection.items = [];
                            ActivityPump.showData(res, collection);
                        } else {
                            bank.readAll('user', userIds, function(err, userMap) {
                                var users = [], id, user;
                                if (err) {
                                    ActivityPump.showError(res, err);
                                } else {
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
                                    ActivityPump.showData(res, collection);
                                }
                            });
                        }
                    }
                });
            }
        });
    },

    postActivity: function(req, res, next) {

        var activity = new Activity(req.body), pump = this;

        // First, apply the activity

        activity.apply(req.person, function(err) {
            if (err) {
                ActivityPump.showError(res, err);
            } else {
                // ...then persist...
                activity.save(function(err, results) {
                    if (err) {
                        ActivityPump.showError(res, err);
                    } else {
                        // ...then distribute.
                        ActivityPump.distribute(activity, function(err) {
                            if (err) {
                                ActivityPump.showError(res, err);
                            } else {
                                // ...then show (possibly modified) results.
                                ActivityPump.showData(res, activity);
                            }
                        });
                    }
                });
            }
        });
    },

    userFeed: function(req, res, next) {
        // XXX: instead of search, use a separate data structure,
        // like an 'outbox'.
        Activity.search({'actor.id': req.user.personId}, function(err, activities) {
            var collection;
            if (err) {
                ActivityPump.showErr(res, err);
            } else {

                activities.sort(function(a, b) {  
                    if (a.published > b.published) {
                        return -1;  
                    } else if (a.published < b.published) {
                        return 1;  
                    } else {
                        return 0;  
                    }
                });

                activities.forEach(function(el, i, arr) {
                    // Remove unnecessary actor info
                    delete el.actor;
                    // remove internal uuid info, if any
                    delete el.uuid;
                });

                collection = {
                    author: req.person,
                    displayName: "Activities by " + (req.person.displayName || req.user.nickname),
                    id: ActivityPump.makeURL("user/" + req.user.nickname + "/feed"),
                    objectTypes: ["activity"],
                    items: activities
                };

                ActivityPump.showData(res, collection);
            }
        });
    },

    userInbox: function(req, res, next) {
        ActivityPump.bank.read('inbox', req.user.personId, function(err, inbox) {
            var collection = {
                    author: req.person,
                    displayName: "Activities for " + (req.person.displayName || req.user.nickname),
                    id: ActivityPump.makeURL("user/" + req.user.nickname + "/inbox"),
                    objectTypes: ["activity"],
                    items: []
                };
            if (err) {
                // No inbox yet; show empty collection
                if (err instanceof NoSuchThingError) {
                    ActivityPump.showData(res, collection);
                } else {
                    ActivityPump.showError(res, err);
                }
            } else {
                // FIXME: Activity.readAll() would be nicer here
                ActivityPump.bank.readAll('activity', inbox, function(err, activityMap) {
                    var activities = [], id;
                    if (err) {
                        ActivityPump.showError(res, err);
                    } else {
                        for (id in activityMap) {
                            activities.push(activityMap[id]);
                        }
                        activities.sort(function(a, b) {  
                            if (a.published > b.published) {
                                return -1;  
                            } else if (a.published < b.published) {
                                return 1;  
                            } else {
                                return 0;  
                            }
                        });

                        activities.forEach(function(el, i, arr) {
                            // remove internal uuid info, if any
                            delete el.uuid;
                        });

                        collection.items = activities;

                        ActivityPump.showData(res, collection);
                    }
                });
            }
        });
    },

    showError: function(res, err, code) {
        if (!code) {
            code = 500;
        }
        console.error(err.message);
        console.error(err.stack);
        res.writeHead(code, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(err.message));
    },

    showData: function(res, data) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(data));
    },

    notYetImplemented: function(req, res, next) {
        this.showError(res, new Error("Not yet implemented"));
    },

    port: null,
    hostname: null,

    makeURL: function(relative) {
        if (this.port != 80) {
            return 'http://'+this.hostname+':'+this.port+'/'+relative;
        } else {
            return 'http://'+this.hostname+'/'+relative;
        }
    },

    getSchema: function() {

        var i, type, Cls, schema = {};

        schema.activity = Activity.schema;
        schema.user = User.schema;
        schema.edge = Edge.schema;
        schema.inbox = {'pkey': 'id'};
        schema.userlist = {'pkey': 'id'};
        schema.usercount = {'pkey': 'id'};

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
    },
    
    distribute: function(activity, callback) {
        var bank = ActivityPump.bank;

        Edge.search({'to.id': activity.actor.id}, function(err, follows) {
            var cnt = 0, len = follows.length, hadErr = false, i, id;
            // XXX: fan-out is hard; let's go shopping.
            if (len === 0) {
                // Not an error; just nothing to do
                callback(null);
            }
            for (i = 0; i < follows.length; i++) {
                id = follows[i].to.id;
                // FIXME: check for local/remote distribution
                // FIXME: trim long inboxen
                bank.prepend('inbox', id, activity.id, function(err, results) {
                    cnt++;
                    if (err) {
                        hadErr = true;
                        callback(err);
                    } else if (cnt === len && !hadErr) {
                        callback(null);
                    }
                });
            }
        });
    }
};

ActivityPump.userAuth = connect.basicAuth(ActivityPump.checkCredentials);

exports.ActivityPump = ActivityPump;
