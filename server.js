// activitypump.js
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

function makeNewId(req, res, next)
{
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(newActivityId())+"\n");
}

server = connect.createServer(
    connect.logger(),
    connect.query(),
    connect.router(function(app){
	// Activities
	app.get('/activity/:id', notYetImplemented);
	app.put('/activity/:id', notYetImplemented);
	app.del('/activity/:id', notYetImplemented);
	// Users
	app.get('/user/:nickname', notYetImplemented);
	app.put('/user/:nickname', notYetImplemented);
	app.del('/user/:nickname', notYetImplemented);

	// Feeds

	app.get('/user/:nickname/feed', notYetImplemented);
	app.post('/user/:nickname/feed', notYetImplemented);

	// Inboxen

	app.get('/user/:nickname/inbox', notYetImplemented);
	app.post('/user/:nickname/inbox', notYetImplemented);

	// Global user list

	app.get('/users', notYetImplemented);
	app.post('/users', notYetImplemented);

	// Testing

	app.get('/test/newid', makeNewId);
    })
);

server.listen(process.env.PORT || 8001);
