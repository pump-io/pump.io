// registeruser.js
//
// Register a new user with the activity pump
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

var _ = require('underscore'),
    postJSON = require('./common').postJSON,
    argv = require('optimist')
        .usage('Usage: $0 -u <nickname> -p <num>')
        .demand(['u','p'])
        .alias('u', 'username')
        .alias('p', 'password')
        .alias('s', 'server')
        .alias('P', 'port')
        .describe('u', "Username to register")
        .describe('p', "Password for user")
        .describe('s', "Server name (default 'localhost')")
        .describe('P', "Port (default 8001)")
        .default('P', 8001)
        .default('s', 'localhost')
        .argv;

var user = {'nickname': argv.u,
            'password': argv.p};

var server = (_(argv).has('s')) ? argv.s : 'localhost';
var port = (_(argv).has('p')) ? argv.p : 8001;

postJSON('http://'+server+':'+port+'/api/users', user, function(err, results) {
    if (err) {
        console.error(err);
    } else {
        console.log(results);
    }
});
