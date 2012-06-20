// common.js
//
// Common utilities for activityspam scripts
//
// Copyright 2011, 2012 StatusNet Inc.
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

var http = require("http"),
    querystring = require("querystring"),
    url = require("url"),
    config = require("./config"),
    OAuth = require("oauth").OAuth,
    _ = require("underscore");

var postJSON = function(serverUrl, payload, callback) {

    var req, oa, parts, toSend, pair;

    if (!callback) {
        callback = postReport(payload);
    }
    
    parts = url.parse(serverUrl);

    if (!_(config).has("hosts") ||
        !_(config.hosts).has(parts.hostname)) {
        callback(new Error("No OAuth key for " + parts.hostname), null);
        return;
    }

    pair = config.hosts[parts.hostname];

    oa = new OAuth(null, // request token N/A for 2-legged OAuth
                   null, // access token N/A for 2-legged OAuth
                   pair.key,
                   pair.secret,
                   "1.0",
                   null,
                   "HMAC-SHA1",
                   null, // nonce size; use default
                   {"User-Agent": "activitypump/0.1"});
    
    toSend = JSON.stringify(payload);

    oa.post(serverUrl, null, null, toSend, "application/json", function(err, data, response) {
        // Our callback has swapped args to OAuth module"s
        callback(err, response, data);
    });
};

var postReport = function(payload) {
    return function(err, res, body) {
        if (err) {
            if (_(payload).has("id")) {
                console.log("Error posting payload " + payload.id);
            } else {
                console.log("Error posting payload");
            }
            console.error(err);
        } else {
            if (_(payload).has("id")) {
                console.log("Results of posting " + payload.id + ": " + body);
            } else {
                console.log("Results of posting: " + body);
            }
        }
    };
};

var postArgs = function(serverUrl, args, callback) {

    var requestBody = querystring.stringify(args);

    var parts = url.parse(serverUrl);

    // An object of options to indicate where to post to
    var options = {
        host: parts.hostname,
        port: parts.port,
        path: parts.path,
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": requestBody.length,
            "User-Agent": "activitypump/0.1.0dev"
        }
    };

    // Set up the request

    var req = http.request(options, function(res) {
        var body = "";
        var err = null;
        res.setEncoding("utf8");
        res.on("data", function(chunk) {
            body = body + chunk;
        });
        res.on("error", function(err) {
            callback(err, null, null);
        });
        res.on("end", function() {
            callback(err, res, body);
        });
    });

    // post the data
    req.write(requestBody);
    req.end();
};

exports.postJSON = postJSON;
exports.postReport = postReport;
exports.postArgs = postArgs;
