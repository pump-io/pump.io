// dialback.js
//
// Dummy server for making dialback requests
//
// Copyright 2012, E14N https://e14n.com/
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

var express = require("express");

var dialbackApp = function(port, hostname, callback) {

    var app = express.createServer();

    app.configure(function(){
        app.set("port", port);
        app.use(express.bodyParser());
        app.use(app.router);
    });

    app.get("/.well-known/host-meta.json", function(req, res) {
        res.json({
            links: [
                {
                    rel: "lrdd",
                    type: "application/json",
                    template: "http://"+hostname+"/lrdd.json?uri={uri}"
                },
                {
                    rel: "dialback",
                    href: "http://"+hostname+"/dialback"
                }
            ]
        });
    });

    app.get("/lrdd.json", function(req, res) {
        var uri = req.query.uri,
            parts = uri.split("@"),
            username = parts[0],
            hostname = parts[1];

        res.json({
            links: [
                {
                    rel: "dialback",
                    href: "http://"+hostname+"/dialback"
                }
            ]
        });
    });

    // Validates tokens and hosts for dialback
    // Invalid stuff: host mismatch, date greater than 5 min from now, invalid@hostname
    // Everything else is valid
    // NOTE: this is just for a test; real dialback systems shouldn't work this way!

    app.post("/dialback", function(req, res, next) {

        var host = req.body.host,
            webfinger = req.body.webfinger,
            token = req.body.token,
            date = req.body.date,
            url = req.body.url,
            id = host || webfinger,
            user,
            parts,
            ms;

        if (!host && !webfinger) {
            res.status(400).send("No identity");
            return;
        }

        if (host && host != hostname) {
            res.status(400).send("Incorrect host");
            return;
        }

        if (webfinger) {
            parts = webfinger.split("@", 2);
            user = parts[0];
            host = parts[1];
            if (user == "invalid" || host != hostname) {
                res.status(400).send("Invalid webfinger");
                return;
            }
        }

        if (!token) {
            res.status(400).send("No token");
            return;
        }

        if (!date) {
            res.status(400).send("No date");
            return;
        }

        ms = Date.parse(date);

        if (Math.abs(Date.now() - ms) > 300000) { // 5-minute window
            res.status(400).send("Invalid date");
            return;
        }

        if (token == "INVALID") {
            res.status(400).send("Invalid token");
            return;
        }

        // If you lived here you'd be home by now

        res.status(200).send("OK");
    });

    app.on("error", function(err) {
        callback(err, null);
    });

    app.listen(port, hostname, function() {
        callback(null, app);
    });
};

exports.dialbackApp = dialbackApp;
