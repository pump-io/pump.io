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

var Activity = require('./model/activity').Activity;

var ActivityPump = {

    initApp: function(app) {
	// Activities
	app.get('/activity/:id', this.notYetImplemented);
	app.put('/activity/:id', this.notYetImplemented);
	app.del('/activity/:id', this.notYetImplemented);

	// Users
	app.get('/user/:nickname', this.getUser);
	app.put('/user/:nickname', this.putUser);
	app.del('/user/:nickname', this.delUser);

	// Feeds

	app.post('/user/:nickname/feed', this.postActivity);
	app.get('/user/:nickname/feed', this.notYetImplemented);

	// Inboxen

	app.get('/user/:nickname/inbox', this.notYetImplemented);
	app.post('/user/:nickname/inbox', this.notYetImplemented);

	// Global user list

	app.get('/users', this.notYetImplemented);
	app.post('/users', this.createUser);

	// Testing

	app.get('/test/newid', function (req, res, next) {
	    res.writeHead(200, {'Content-Type': 'application/json'});
	    res.end(JSON.stringify(newActivityId())+"\n");
	});
    },
    
    getUser: function(req, res, next) {

	var newUser = req.body;
	
	db.read('user', req.params.nickname, function(err, value) {
	    if (err instanceof NoSuchThingError) {
		res.writeHead(404, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else if (err) {
		res.writeHead(500, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else {
		value.password = 'xxxxxxxx';
		res.writeHead(200, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(value));
	    }
	});
    },

    putUser: function(req, res, next) {

	var newUser = req.body;

	if (!newUser.preferredUsername) {
	    newUser.preferredUsername = req.params.nickname;
	} else if (newUser.preferredUsername != req.params.nickname) {
	    res.writeHead(400, {'Content-Type': 'application/json'});
	    res.end(JSON.stringify("Can't modify user nickname."));
	    return;
	}

	newUser.password  = bcrypt.encrypt_sync(newUser.password, bcrypt.gen_salt_sync(10));

	var now = dateFormat(new Date(), "isoDateTime", true);

	newUser.updated = now;

	db.read('user', req.params.nickname, function(err, oldUser) {

	    if (err instanceof NoSuchThingError) {
		res.writeHead(404, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else if (err) {
		res.writeHead(500, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else {
		// Don't overwrite these!
		newUser.published = oldUser.published;
		newUser.url       = oldUser.url;
		newUser.id        = oldUser.id;

		db.update('user', req.params.nickname, newUser, function(err, value) {
		    if (err instanceof NoSuchThingError) {
			res.writeHead(404, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(err.message));
		    } else if (err) {
			res.writeHead(500, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(err.message));
		    } else {
			value.password = 'xxxxxxxx';
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(value));
		    }
		});
	    }
	});
    },

    delUser: function(req, res, next) {
	    db.del('user', req.params.nickname, function(err) {
		if (err instanceof NoSuchThingError) {
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

	var newUser = req.body;

	if (!newUser.preferredUsername || !newUser.password) {
	    res.writeHead(400, {'Content-Type': 'application/json'});
	    res.end(JSON.stringify(err.message));
	    return;
	}

	newUser.password  = bcrypt.encrypt_sync(newUser.password, bcrypt.gen_salt_sync(10));

	var now = dateFormat(new Date(), "isoDateTime", true);

	newUser.published = newUser.updated = now;

	db.create('user', newUser.preferredUsername, newUser, function(err, value) {
	    if (err) {
		res.writeHead(400, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else {
		// Hide the password for output
		value.password = 'xxxxxxxx';
		res.writeHead(200, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(value));
	    }
	});
    },

    postActivity: function(req, res, next) {

	var activity = req.body;

	if (!activity.verb) {
	    activity.verb = "post";
	}

	if (!activity.object) {
	    res.writeHead(500, {'Content-Type': 'application/json'});
	    res.end(JSON.stringify("No verb or object in activity."));
	    return;
	}

	var now = dateFormat(new Date(), "isoDateTime", true);

	activity.published = activity.updated = now;

	db.read('user', req.params.nickname, function(err, user) {
	    if (err instanceof NoSuchThingError) {
		res.writeHead(404, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else if (err) {
		res.writeHead(500, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else {

		delete user.password;

		// Should we store the whole thing...?

		activity.subject = user;

		var uuid = newActivityId();
		var url  = makeURL('activity/'+uuid);

		activity.id = url;

		db.create('activity', uuid, activity, function(err, value) {
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
