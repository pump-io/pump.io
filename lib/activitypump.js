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
        var types = ["article", 
                     "audio", 
                     "badge", 
                     "bookmark", 
                     "comment", 
                     "event", 
                     "file", 
                     "group", 
                     "image",
                     "note", 
                     "person", 
                     "place", 
                     "product", 
                     "question", 
                     "review", 
                     "service", 
                     "video"],
            i = 0, url, type;

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

        for (i = 0; i < types.length; i++) {

            type = types[i];

            url = '/' + types[i] + '/' + ':uuid';

            // person

            app.get(url, ActivityPump.requester(type), ActivityPump.getter(type));
            app.put(url, ActivityPump.userAuth, ActivityPump.requester(type), ActivityPump.authorOnly(type), ActivityPump.putter(type));
            app.del(url, ActivityPump.userAuth, ActivityPump.requester(type), ActivityPump.authorOnly(type), ActivityPump.deleter(type));
        }
        
        // Global user list

        app.get('/users', ActivityPump.notYetImplemented);
        app.post('/users', ActivityPump.createUser);
    },

    requester: function(type) {

        var module = require('./model/' + type),
            className = type.substring(0,1).toUpperCase() + type.substring(1, type.length).toLowerCase(),
            Cls = module[className];

        return function(req, res, next) {
            Cls.search({'uuid': req.params.uuid}, function(err, results) {
                if (err instanceof NoSuchThingError) {
                    res.writeHead(404, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(err.message));
                } else if (err) {
                    res.writeHead(500, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(err.message));
                } else if (results.length === 0) {
                    res.writeHead(404, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify("Can't find a " + type + " with ID = " + req.params.uuid));
                } else if (results.length > 1) {
                    res.writeHead(500, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify("Too many " + type + " object with ID = " + req.params.uuid));
                } else {
                    req[type] = results[0];
                    next();
                }
            });
        };
    },

    authorOnly: function(type) {
        return function(req, res, next) {
            var obj = req[type];

            if (obj && obj.author && obj.author.id == req.remoteUser.personId) {
                next();
            } else {
                res.writeHead(403, {'Content-Type': 'application/json'});
                res.end(JSON.stringify("Only the author can modify this object."));
            }
        };
    },

    getter: function(type) {
        return function(req, res, next) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(req[type]));
        };
    },

    putter: function(type) {
        return function(req, res, next) {
            var obj = req[type];
            obj.update(req.body, function(err, result) {
                if (err) {
                    res.writeHead(500, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(err.message));
                } else {
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(result));
                }
            });
        };
    },

    deleter: function(type) {
        return function(req, res, next) {
            var obj = req[type];
            obj.del(function(err) {
                if (err) {
                    res.writeHead(500, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(err.message));
                } else {
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify("Deleted."));
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
                res.writeHead(404, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else {
                user.sanitize();
                req.user = user;
                user.getPerson(function(err, person) {
                    if (err) {
                        res.writeHead(500, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify(err.message));
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
                saved.sanitize();
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

        User.create(req.body, function(err, user) {
            if (err) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else {
                // Hide the password for output
                user.sanitize();
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(user));
            }
        });
    },

    postActivity: function(req, res, next) {

        var activity = new Activity(req.body), pump = this;

        // First, apply the activity

        activity.apply(user, function(err) {
            if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else {
                activity.save(function(err) {
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
    },

    notYetImplemented: function(req, res, next) {
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end("\"Not yet implemented\"\n");
    },

    port: null,
    hostname: null,

    makeURL: function(relative) {
        if (this.port != 80) {
            return 'http://'+this.hostname+':'+this.port+'/'+relative;
        } else {
            return 'http://'+this.hostname+'/'+relative;
        }
    }
};

ActivityPump.userAuth = connect.basicAuth(ActivityPump.checkCredentials);

exports.ActivityPump = ActivityPump;
