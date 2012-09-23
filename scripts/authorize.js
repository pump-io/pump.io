// authorize.js
//
// Get OAuth token
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

var _ = require("underscore"),
    Step = require("step"),
    OAuth = require("oauth").OAuth,
    config = require("./config"),
    argv = require("optimist")
        .usage("Usage: $0 -s <nickname>")
        .alias("s", "server")
        .alias("P", "port")
        .describe("s", "Server name (default 'localhost')")
        .describe("P", "Port (default 80)")
        .default("P", 80)
        .default("s", "localhost")
        .argv,
    server = argv.s,
    port = argv.P,
    cl,
    oa,
    rt;

if (!_.has(config, "hosts") || !_.has(config.hosts, server)) {
    console.error("No client key for " + server);
    process.exit(1);
}

cl = config.hosts[server];

oa = new OAuth("http://"+server+":"+port+"/oauth/request_token",
               "http://"+server+":"+port+"/oauth/access_token",
               cl.key,
               cl.secret,
               "1.0",
               "oob",
               "HMAC-SHA1",
               null, // nonce size; use default
               {"User-Agent": "activitypump-scripts/0.1.0"});

Step(    
    function() {
        oa.getOAuthRequestToken(this);
    },
    function(err, token, secret) {
        var url;
        var callback = this;
        var verifier = "";
        if (err) throw err;
        rt = {token: token, secret: secret};
        url = "http://"+server+":"+port+"/oauth/authorize?oauth_token=" + rt.token;
        console.log("Log in here: " + url);
        console.log("Verifier: ");
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        process.stdin.on('data', function (chunk) {
            verifier = verifier + chunk;
        });

        process.stdin.on('end', function () {
            process.stdin.pause();
            callback(null, verifier);
        });
    },
    function(err, verifier) {
        if (err) throw err;
        oa.getOAuthAccessToken(rt.token, rt.secret, verifier, this);
    },
    function(err, token, secret, res) {
        if (err) {
            console.error(err);
        } else {
            console.dir({
                token: token,
                secret: secret
            });
        }
    }
);
