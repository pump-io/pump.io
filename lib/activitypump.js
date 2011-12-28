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
    Step = require('step'),
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
        var user = null;
        Step(
            function() {
                User.get(nickname, this);
            },
            function(err, result) {
                if (err) throw err;
                user = result;
                bcrypt.compare(password, user.passwordHash, this);
            },
            function(err, res) {
                if (err) {
                    callback(err, null);
                } else if (!res) {
                    callback(null, null);
                } else {
                    // Don't percolate that hash around
                    user.sanitize();
                    callback(null, user);
                }
            }
        );
    },

    reqUser: function(req, res, next) {
        var pump = ActivityPump, bank = ActivityPump.bank;

        Step(
            function() {
                User.get(req.params.nickname, this);
            },
            function(err, user) {
                if (err) throw err;
                user.sanitize();
                req.user = user;
                user.getPerson(this);
            },
            function(err, person) {
                if (err instanceof NoSuchThingError) {
                    ActivityPump.showError(res, err, 404);
                } else if (err) {
                    ActivityPump.showError(res, err);
                } else {
                    req.person = person;
                    next();
                }
            }
        );
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
        var user, pump = ActivityPump;

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
                    pump.showError(res, err);
                } else {
                    // Hide the password for output
                    user.sanitize();
                    pump.showData(res, user);
                }
            }
        );
    },

    listUsers: function(req, res, next) {
        var bank = ActivityPump.bank,
            start, cnt, end,
            pump = ActivityPump;

        var collection = {
            displayName: "Users of this service",
            id: ActivityPump.makeURL("users"),
            objectTypes: ["user"]
        };

        start = (req.query.offset) ? parseInt(req.query.offset) : 0;
        cnt = (req.query.cnt) ? parseInt(req.query.cnt) : ActivityPump.DEFAULT_USERS;
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
                        ActivityPump.showData(res, collection);
                    } else {
                        throw err;
                    }
                } else if (userIds.length == 0) {
                    collection.items = [];
                    ActivityPump.showData(res, collection);
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
                ActivityPump.showData(res, collection);
            }
        );
    },

    postActivity: function(req, res, next) {

        var activity = new Activity(req.body), pump = ActivityPump;

        Step(
            function() {
                // First, apply the activity
                activity.apply(req.person, this);
            },
            function(err) {
                if (err) throw err;
                // ...then persist...
                activity.save(this);
            },
            function(err, saved) {
                if (err) throw err;
                activity = saved;
                pump.addToOutbox(activity, req.person, this);
            }, 
            function(err) {
                if (err) throw err;
                // ...then distribute.
                pump.distribute(activity, this);
            },
            function(err) {
                if (err) {
                    pump.showError(res, err);
                } else {
                    // ...then show (possibly modified) results.
                    pump.showData(res, activity);
                }
            }
        );
    },

    addToOutbox: function(activity, person, next) {
        var bank = ActivityPump.bank;

        Step(
            function() {
                bank.prepend('outbox', person.id, activity.id, this);
            },
            function(err, value) {
                if (err) throw err;
                bank.incr('outboxcount', person.id, this);
            },
            function(err, value) {
                if (err) {
                    next(err);
                } else {
                    next(null);
                }
            }
        );
    },

    userFeed: function(req, res, next) {

        var collection = {
            author: req.person,
            displayName: "Activities by " + (req.person.displayName || req.user.nickname),
            id: ActivityPump.makeURL("user/" + req.user.nickname + "/feed"),
            objectTypes: ["activity"]
        };

        var start, cnt, end, pump = ActivityPump, bank = ActivityPump.bank;

        start = (req.query.offset) ? parseInt(req.query.offset) : 0;
        cnt = (req.query.cnt) ? parseInt(req.query.cnt) : pump.DEFAULT_ACTIVITIES;
        end = start + cnt;

        Step(
            function() {
                bank.read('outboxcount', req.user.personId, this);
            },
            function(err, totalOutbox) {
                if (err) throw err;
                collection.totalCount = totalOutbox;
                bank.slice('outbox', req.user.personId, start, end, this);
            },
            function(err, activityIds) {
                if (err) throw err;
                // FIXME: Activity.readAll() would be nicer here
                pump.bank.readAll('activity', activityIds, this);
            },
            function(err, activityMap) {
                var activities = [], id;
                if (err) {
                    if (err instanceof NoSuchThingError) {
                        collection.items = [];
                        pump.showData(res, collection);
                    } else {
                        pump.showErr(res, err);
                    }
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
                        delete el.actor;
                        delete el.uuid;
                    });

                    collection.items = activities;

                    pump.showData(res, collection);
                }
            }
        );
    },

    userInbox: function(req, res, next) {

        var collection = {
            author: req.person,
            displayName: "Activities for " + (req.person.displayName || req.user.nickname),
            id: ActivityPump.makeURL("user/" + req.user.nickname + "/inbox"),
            objectTypes: ["activity"],
            items: []
        };
        var start, cnt, end, pump = ActivityPump, bank = ActivityPump.bank;

        start = (req.query.offset) ? parseInt(req.query.offset) : 0;
        cnt = (req.query.cnt) ? parseInt(req.query.cnt) : ActivityPump.DEFAULT_ACTIVITIES;
        end = start + cnt;

        Step(
            function() {
                bank.read('inboxcount', req.user.personId, this);
            },
            function(err, inboxCount) {
                if (err) throw err;
                collection.totalCount = inboxCount;
                bank.slice('inbox', req.user.personId, start, end, this);
            },
            function(err, inbox) {
                if (err) throw err;
                // FIXME: Activity.readAll() would be nicer here
                bank.readAll('activity', inbox, this);
            },
            function(err, activityMap) {
                var activities = [], id;

                if (err) {
                    // No inbox yet; show empty collection
                    if (err instanceof NoSuchThingError) {
                        collection.totalCount = 0;
                        pump.showData(res, collection);
                    } else {
                        pump.showError(res, err);
                    }
                    return;
                }

                // Convert from id => activity map to array

                for (id in activityMap) {
                    activities.push(activityMap[id]);
                }

                // Sort by published, reverse chron

                activities.sort(function(a, b) {  
                    if (a.published > b.published) {
                        return -1;  
                    } else if (a.published < b.published) {
                            return 1;  
                    } else {
                        return 0;  
                    }
                });

                // sanitize

                activities.forEach(function(el, i, arr) {
                    // remove internal uuid info, if any
                    delete el.uuid;
                });
                
                collection.items = activities;
                
                pump.showData(res, collection);
            }
        );
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
        schema.inboxcount = {'pkey': 'id'};
        schema.outbox = {'pkey': 'id'};
        schema.outboxcount = {'pkey': 'id'};
        schema.userlist = {'pkey': 'id'};
        schema.usercount = {'pkey': 'id'};
        schema.feedcount = {'pkey': 'id'};

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

        Step(
            function() {
                Edge.search({'to.id': activity.actor.id}, this);
            },
            function(err, follows) {
                if (err) throw err;
                var i, id, group = this.group();
                for (i = 0; i < follows.length; i++) {
                    id = follows[i].from.id;
                    // FIXME: check for local/remote distribution
                    // FIXME: trim long inboxen
                    bank.prepend('inbox', id, activity.id, group());
                    bank.incr('inboxcount', id, group());
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
    }
};

var pump = ActivityPump;

ActivityPump.userAuth = connect.basicAuth(ActivityPump.checkCredentials);

exports.ActivityPump = ActivityPump;
