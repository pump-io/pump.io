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
        var i = 0, url, type;

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

        for (i = 0; i < Activity.objectTypes.length; i++) {

            type = Activity.objectTypes[i];

            url = '/' + type + '/' + ':uuid';

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
                ActivityPump.showData(res, "Deleted");
            }
        });
    },

    createUser: function (req, res, next) {

        User.create(req.body, function(err, user) {
            if (err) {
                ActivityPump.showError(res, err);
            } else {
                // Hide the password for output
                user.sanitize();
                ActivityPump.showData(res, user);
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

    showError: function(res, err, code) {
        if (!code) {
            code = 500;
        }
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
	schema.edge = require('./model/edge').Edge.schema;

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
	callback(new Error("No distribution yet."));
    }
};

ActivityPump.userAuth = connect.basicAuth(ActivityPump.checkCredentials);

exports.ActivityPump = ActivityPump;
