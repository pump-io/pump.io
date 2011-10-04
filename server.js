// server.js
//
// main function for activity pump application
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

var connect = require('connect');
var uuid    = require('node-uuid');
var bcrypt  = require('bcrypt');
var dateFormat = require('dateformat');

var RedisJSONStore = require('./redisjsonstore').RedisJSONStore;

var jsonstore = require('./jsonstore');

function notYetImplemented(req, res, next) {
    res.writeHead(500, {'Content-Type': 'application/json'});
    res.end("\"Not yet implemented\"\n");
}

function newActivityId()
{
    var buf = new Buffer(16);
    uuid('binary', buf);

    var id = buf.toString('base64');

    // XXX: optimize me

    id = id.replace(/\+/g, '-');
    id = id.replace(/\//g, '_');
    id = id.replace(/=/g, '');
    return id;
}

server = connect.createServer(
    connect.logger(),
    connect.bodyParser(),
    connect.errorHandler({showMessage: true}),
    connect.query(),
    connect.router(function(app) {

	// Activities
	app.get('/activity/:id', notYetImplemented);
	app.put('/activity/:id', notYetImplemented);
	app.del('/activity/:id', notYetImplemented);

	// Users
	app.get('/user/:nickname', function(req, res, next) {

	    var newUser = req.body;
	    
	    store.read('user', req.params.nickname, function(err, value) {
		if (err instanceof jsonstore.NoSuchThingError) {
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
	});

	app.put('/user/:nickname', function(req, res, next) {

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

	    store.read('user', req.params.nickname, function(err, oldUser) {

		if (err instanceof jsonstore.NoSuchThingError) {
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

		    store.update('user', req.params.nickname, newUser, function(err, value) {
			if (err instanceof jsonstore.NoSuchThingError) {
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
	});

	app.del('/user/:nickname', notYetImplemented);

	// Feeds

	app.get('/user/:nickname/feed', notYetImplemented);
	app.post('/user/:nickname/feed', notYetImplemented);

	// Inboxen

	app.get('/user/:nickname/inbox', notYetImplemented);
	app.post('/user/:nickname/inbox', notYetImplemented);

	// Global user list

	app.get('/users', notYetImplemented);

	app.post('/users', function (req, res, next) {

	    var newUser = req.body;

	    if (!newUser.preferredUsername || !newUser.password) {
		res.writeHead(400, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(err.message));
		return;
	    }

	    newUser.password  = bcrypt.encrypt_sync(newUser.password, bcrypt.gen_salt_sync(10));

	    var now = dateFormat(new Date(), "isoDateTime", true);

	    newUser.published = newUser.updated = now;

	    store.create('user', newUser.preferredUsername, newUser, function(err, value) {
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
	});

	// Testing

	app.get('/test/newid', function (req, res, next) {
	    res.writeHead(200, {'Content-Type': 'application/json'});
	    res.end(JSON.stringify(newActivityId())+"\n");
	});
    })
);

var store = new RedisJSONStore();

// Connect...

store.connect({}, function(err) {
    if (err) {
	console.log("Couldn't connect to JSON store: " + err.message);
    } else {
	// ...then listen
	server.listen(process.env.PORT || 8001);
    }
});
