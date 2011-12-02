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
    User = require('./model/user').User;

var ActivityPump = {
    
    db: null,

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
    
    getUser: function(req, res) {
	User.get(req.params.nickname, function(err, user) {
	    if (err instanceof NoSuchThingError) {
		res.writeHead(404, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else if (err) {
		res.writeHead(500, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else {
		user.password = '<not shown>';
		res.writeHead(200, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(user));
	    }
	});
    },

    putUser: function(req, res, next) {

	var newUser = req.body;

	User.get(req.params.nickname, function(err, user) {
	    if (err instanceof NoSuchThingError) {
		res.writeHead(404, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else if (err) {
		res.writeHead(500, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else {
		user.update(newUser, function(err, saved) {
		    if (err) {
			res.writeHead(500, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(err.message));
		    } else {
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(saved));
		    }
		});
	    }
	});
    },

    delUser: function(req, res, next) {
	User.del(req.params.nickname, function(err) {
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
	
	User.create(newUser.nickname, newUser, function(err, user) {
	    if (err) {
		res.writeHead(400, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
	    } else {
		// Hide the password for output
		user.password = 'xxxxxxxx';
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

	this.db.read('user', req.params.nickname, function(err, user) {
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
