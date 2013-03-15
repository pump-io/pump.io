// dialback.js
//
// Copyright 2011-2012, E14N https://e14n.com/
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

var Step = require("step"),
    wf = require("webfinger"),
    http = require("http"),
    https = require("https"),
    url = require("url"),
    URLMaker = require("./urlmaker").URLMaker,
    querystring = require("querystring"),
    path = require("path"),
    DialbackRequest = require("dialback-client").DialbackRequest;

var discoverHostEndpoint = function(host, callback) {

    Step(
        function() {
            wf.hostmeta(host, this);
        },
        function(err, jrd) {
            var dialbacks;
            if (err) {
                callback(err, null);
                return;
            }
            if (!jrd.hasOwnProperty("links")) {
                callback(new Error("No links in host-meta for " + host), null);
                return;
            }
            dialbacks = jrd.links.filter(function(link) {
                return (link.hasOwnProperty("rel") && link.rel == "dialback" && link.hasOwnProperty("href"));
            });
            if (dialbacks.length === 0) {
                callback(new Error("No dialback links in host-meta for " + host), null);
                return;
            }
            callback(null, dialbacks[0].href);
        }
    );

};

var discoverWebfingerEndpoint = function(address, callback) {

    Step(
        function() {
            wf.webfinger(address, this);
        },
        function(err, jrd) {
            var dialbacks;
            if (err) {
                callback(err, null);
                return;
            }
            if (!jrd.hasOwnProperty("links")) {
                callback(new Error("No links in lrdd for " + address), null);
                return;
            }
            dialbacks = jrd.links.filter(function(link) {
                return (link.hasOwnProperty("rel") && link.rel == "dialback");
            });
            if (dialbacks.length === 0) {
                callback(new Error("No dialback links in lrdd for " + address), null);
                return;
            }
            callback(null, dialbacks[0].href);
        }
    );
};

var discoverEndpoint = function(fields, callback) {
    if (fields.hasOwnProperty("host")) {
        discoverHostEndpoint(fields.host, callback);
    } else if (fields.hasOwnProperty("webfinger")) {
        discoverWebfingerEndpoint(fields.webfinger, callback);
    }
};

var postToEndpoint = function(endpoint, params, callback) {
    var options = url.parse(endpoint),
        pstring = querystring.stringify(params);

    options.method = "POST";
    options.headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    };

    var mod = (options.protocol == "https:") ? https : http;

    var req = mod.request(options, function(res) {
        var body = "";
        res.setEncoding("utf8");
        res.on("data", function(chunk) {
            body = body + chunk;
        });
        res.on("error", function(err) {
            callback(err, null, null);
        });
        res.on("end", function() {
            if (res.statusCode < 200 || res.statusCode > 300) {
                callback(new Error("Error " + res.statusCode + ": " + body), null, null);
            } else {
                callback(null, body, res);
            }
        });
    });

    req.on("error", function(err) {
        callback(err, null, null);
    });

    req.write(pstring);

    req.end();
};

// XXX: separate request store

var requests = {
};

var saveRequest = function(id, url, date, token, callback) {

    var ms = Date.parse(date),
        props = {
            endpoint: url,
            id: id,
            token: token,
            timestamp: ms
        };

    Step(
        function() {
            DialbackRequest.create(props, this);
        },
        function(err, req) {
            callback(err);
        }
    );
};

var seenRequest = function(id, url, date, token, callback) {

    var ms = Date.parse(date),
        props = {
            endpoint: url,
            id: id,
            token: token,
            timestamp: ms
        },
        key = DialbackRequest.toKey(props);

    Step(
        function() {
            DialbackRequest.get(key, this);
        },
        function(err, req) {
            if (err && (err.name == "NoSuchThingError")) {
                callback(null, false);
            } else if (err) {
                callback(err, null);
            } else {
                callback(null, true);
            }
        }
    );
};

var maybeDialback = function(req, res, next) {

    if (!req.headers.hasOwnProperty("authorization")) {
        next();
        return;
    }

    dialback(req, res, next);
};

var dialback = function(req, res, next) {

    var auth,
        now = Date.now(),
        fields,
        unauthorized = function(msg) {
            res.status(401);
            res.setHeader("WWW-Authentication", "Dialback");
            res.setHeader("Content-Type", "text/plain");
            res.send(msg);
        },
        parseFields = function(str) {
            var fstr = str.substr(9); // everything after "Dialback "
            var pairs = fstr.split(/,\s+/); // XXX: won't handle blanks inside values well
            var fields = {};
            pairs.forEach(function(pair) {
                var kv = pair.split("="),
                    key = kv[0],
                    value = kv[1].replace(/^"|"$/g, "");
                fields[key] = value;
            });
            return fields;
        };

    if (!req.headers.hasOwnProperty("authorization")) {
        unauthorized("No Authorization header");
        return;
    }

    auth = req.headers.authorization;

    if (auth.substr(0, 9) != "Dialback ") {
        unauthorized("Authorization scheme is not 'Dialback'");
        return;
    }

    fields = parseFields(auth);

    // must have a token

    if (!fields.hasOwnProperty("token")) {
        unauthorized("Authorization header has no 'token' field");
        return;
    }

    // must have a webfinger or host field

    if (!fields.hasOwnProperty("host") && !fields.hasOwnProperty("webfinger")) {
        unauthorized("Authorization header has neither 'host' nor 'webfinger' fields");
        return;
    }

    fields.url = URLMaker.makeURL(req.originalUrl);
    
    if (!req.headers.hasOwnProperty("date")) {
        unauthorized("No 'Date' header");
        return;
    }

    fields.date = req.headers.date;

    if (Math.abs(Date.parse(fields.date) - now) > 300000) { // 5-minute window
        unauthorized("'Date' header is outside our 5-minute window");
        return;
    }

    Step(
        function() {
            seenRequest(fields.host || fields.webfinger, 
                        fields.url,
                        fields.date,
                        fields.token,
                        this);
        },
        function(err, seen) {
            if (err) throw err;
            if (seen) {
                unauthorized("We've already seen this request.");
                return;
            } else {
                saveRequest(fields.host || fields.webfinger, 
                            fields.url,
                            fields.date,
                            fields.token,
                            this);
            }
        },
        function(err) {
            if (err) throw err;
            discoverEndpoint(fields, this);
        },
        function(err, endpoint) {
            if (err) throw err;
            postToEndpoint(endpoint, fields, this);
        },
        function(err, body, res) {
            if (err) {
                unauthorized(err.message);
            } else if (fields.hasOwnProperty("host")) {
                req.remoteHost = fields.host;
                next();
            } else if (fields.hasOwnProperty("webfinger")) {
                req.remoteUser = fields.webfinger;
                next();
            }
        }
    );
};

exports.dialback = dialback;
exports.maybeDialback = maybeDialback;
