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

var connect = require('connect'),
    bcrypt  = require('bcrypt'),
    ActivityPump = require('./lib/activitypump').ActivityPump,
    server = connect.createServer(
        connect.logger(),
        connect.bodyParser(),
        connect.errorHandler({showStack: true, dumpExceptions: true}),
        connect.query(),
        connect.router(ActivityPump.initApp)
    ),
    port = process.env.PORT || 8001,
    hostname = process.env.HOSTNAME || 'localhost',
    databank = require('databank'),
    config = require('./config'),
    params,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    db;

params = config.params;
params.schema = ActivityPump.getSchema();
db = Databank.get(config.driver, params);

// Connect...

db.connect({}, function(err) {
    if (err) {
        console.log("Couldn't connect to JSON store: " + err.message);
    } else {

        ActivityPump.port = port;
        ActivityPump.hostname = hostname;
        ActivityPump.bank = DatabankObject.bank = db;

        // ...then listen
        server.listen(port, hostname);
    }
});
