// server.js
//
// main function for activity pump application
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

var connect = require('connect'),
    bcrypt  = require('bcrypt'),
    api = require('./routes/api'),
    web = require('./routes/web'),
    port = process.env.PORT || 8001,
    hostname = process.env.HOSTNAME || 'localhost',
    databank = require('databank'),
    config = require('./config'),
    express = require('express'),
    _ = require('underscore'),
    params,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    db,
    app;

// Initiate the DB

params = config.params;
params.schema = api.getSchema();

db = Databank.get(config.driver, params);

// Connect...

db.connect({}, function(err) {

    var server;
    var app = module.exports = express.createServer();

    if (err) {
        console.log("Couldn't connect to JSON store: " + err.message);
	process.exit(1);
    }

    // Configuration

    app.configure(function() {

	// Templates are in public
	app.set('views', __dirname + '/public/template');
	app.set('view engine', 'utml');
	app.use(express.logger());
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.query());
	app.use(express.methodOverride());
	app.use(express.favicon());
	app.use(express.session({secret: (config.secret || "activitypump")}));

	app.use(app.router);

	app.use(express.static(__dirname + '/public'));

    });

    app.configure('development', function() {
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });

    app.configure('production', function() {
	app.use(express.errorHandler());
    });

    // Routes

    api.addRoutes(app);

    // Use "noweb" to disable Web site (API engine only)

    if (!_(config).has('noweb') || !config.noweb) {
	web.addRoutes(app);
    }

    app.listen(3000);
});
