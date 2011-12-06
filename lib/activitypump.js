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
    databank = require('databank'),
    NoSuchThingError = databank.NoSuchThingError;

var ActivityPump = {
    
    db: null,

    initApp: function(app) {
        // Activities
        app.get('/activity/:id', ActivityPump.notYetImplemented);
        app.put('/activity/:id', ActivityPump.notYetImplemented);
        app.del('/activity/:id', ActivityPump.notYetImplemented);

        // Users
        app.get('/user/:nickname', ActivityPump.reqUser, ActivityPump.getUser);
        app.put('/user/:nickname', ActivityPump.userAuth, ActivityPump.reqUser, ActivityPump.sameUser, ActivityPump.putUser);
        app.del('/user/:nickname', ActivityPump.userAuth, ActivityPump.reqUser, ActivityPump.sameUser, ActivityPump.delUser);

        // Feeds

        app.post('/user/:nickname/feed', ActivityPump.userAuth, ActivityPump.reqUser, ActivityPump.sameUser, ActivityPump.postActivity);
        app.get('/user/:nickname/feed', ActivityPump.notYetImplemented);

        // Inboxen

        app.get('/user/:nickname/inbox', ActivityPump.notYetImplemented);
        app.post('/user/:nickname/inbox', ActivityPump.notYetImplemented);

        // Global user list

        app.get('/users', ActivityPump.notYetImplemented);
        app.post('/users', ActivityPump.createUser);
    },

    userAuth: connect.basicAuth(this.checkCredentials),
    
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
                        delete user.passwordHash;
                        callback(null, user);
                    }
                });
            }
        });
    },

    reqUser: function(req, res, next) {
        User.get(req.params.nickname, function(err, user) {
            if (err instanceof NoSuchThingError) {
                res.writeHead(404, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else {
                req.user = user;
                next();
            }
        });
    },

    sameUser: function(req, res, next) {
        if (!req.remoteUser ||
            !req.user ||
            req.remoteUser.nickname != req.user.nickname) {
            res.writeHead(403, {'Content-Type': 'application/json'});
            res.end("Not authorized.");
        } else {
            next();
        }
    },

    getUser: function(req, res) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(req.user));
    },

    putUser: function(req, res, next) {

        var newUser = req.body;

        req.user.update(newUser, function(err, saved) {
            if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(saved));
            }
        });
    },

    delUser: function(req, res, next) {
        req.user.del(function(err) {
            if (err instanceof NoSuchThingError) { // unusual
                res.writeHead(404, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify("Deleted."));
            }
        });
    },

    createUser: function (req, res, next) {

        var user = new User(req.body);

        user.create(function(err, user) {
            if (err) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else {
                // Hide the password for output
                user.password = 'xxxxxxxx';
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(user));
            }
        });
    },

    postActivity: function(req, res, next) {

        var activity = new Activity(req.body), pump = this;

        this.db.read('user', req.params.nickname, function(err, user) {
            if (err instanceof NoSuchThingError) {
                res.writeHead(404, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else {
                activity.apply(user, function(err) {
                    if (err) {
                        res.writeHead(500, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify(err.message));
                    } else {
                        activity.create(function(err) {
                            if (err) {
                                res.writeHead(500, {'Content-Type': 'application/json'});
                                res.end(JSON.stringify(err.message));
                            } else {
                                pump.distribute(activity, function(err) {
                                    if (err) {
                                        res.writeHead(500, {'Content-Type': 'application/json'});
                                        res.end(JSON.stringify(err.message));
                                    } else {
                                        res.writeHead(200, {'Content-Type': 'application/json'});
                                        res.end(JSON.stringify(activity));
                                    }
                                });
                            }
                        });
                    }
                });
                delete user.password;

                // Should we store the whole thing...?

                activity.subject = user;

                var uuid = newActivityId();
                var url  = makeURL('activity/'+uuid);

                activity.id = url;

                this.db.create('activity', uuid, activity, function(err, value) {
                    if (err instanceof AlreadyExistsError) {
                        res.writeHead(409, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify(err.message));
                    } else if (err) {
                        res.writeHead(400, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify(err.message));
                    } else {
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify(value));
                    }
                });
            }
        });
    },

    notYetImplemented: function(req, res, next) {
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end("\"Not yet implemented\"\n");
    },

    makeURL: function(relative) {
        if (port != 80) {
            return 'http://'+hostname+':'+port+'/'+relative;
        } else {
            return 'http://'+hostname+'/'+relative;
        }
    }
};

exports.ActivityPump = ActivityPump;
