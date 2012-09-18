// Dialback verification
//
// Copyright 2012 StatusNet Inc.
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

var DialbackClient = require("../lib/dialbackclient"),
    URLMaker = require("../lib/urlmaker").URLMaker;

var addRoutes = function(app) {
    app.post("/api/dialback", dialback); 
};

var dialback = function(req, res, next) {

    var host = req.body.host,
        webfinger = req.body.webfinger,
        token = req.body.token,
        date = req.body.date,
        url = req.body.url,
        id = host || webfinger,
        ts,
        parts;

    if (host && host != URLMaker.hostname) {
        res.status(400).send("Incorrect host");
        return;
    } else if (webfinger) {
        parts = webfinger.split("@");
        if (parts.length !== 2 || parts[1] != URLMaker.hostname) {
            res.status(400).send("Incorrect host");
            return;
        }
    } else {
        res.status(400).send("No identity");
        return;
    }

    if (!token) {
        res.status(400).send("No token");
        return;
    }

    if (!date) {
        res.status(400).send("No date");
        return;
    }

    ts = Date.parse(date);

    if (Math.abs(Date.now() - ts) > 300000) { // 5-minute window
        res.status(400).send("Invalid date");
        return;
    }

    if (DialbackClient.isRemembered(url, id, token, ts)) {
        res.status(200).send("OK");
        return;
    } else {
        res.status(400).send("Not my token");
        return;
    }
};

exports.addRoutes = addRoutes;
