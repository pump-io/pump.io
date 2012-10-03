// Dialback HTTP calls
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

var Step = require("step"),
    _ = require("underscore"),
    urlparse = require("url").parse,
    http = require("http"),
    https = require("https"),
    DialbackClientRequest = require("./model/dialbackclientrequest").DialbackClientRequest,
    randomString = require("./randomstring").randomString;

var DialbackClient = {

    post: function(endpoint, id, requestBody, contentType, callback) {

        var reqOpts = urlparse(endpoint),
            auth,
            token,
            ts;
        
        Step(
            function() {
                randomString(8, this);
            },
            function(err, str) {
                if (err) throw err;
                token = str;
                ts = Math.round(Date.now()/1000)*1000;
                DialbackClient.remember(endpoint, id, token, ts, this);
            },
            function(err) {

                if (err) {
                    callback(err, null, null);
                    return;
                }

                reqOpts.method = "POST";
                reqOpts.headers = {
                    "Content-Type": contentType,
                    "Content-Length": requestBody.length,
                    "User-Agent": "pump.io/0.1.0dev"
                };

                if (id.indexOf("@") === -1) {
                    auth = "Dialback host=\"" + id + "\", token=\""+token+"\"";
                } else {
                    auth = "Dialback webfinger=\"" + id + "\", token=\""+token+"\"";
                }

                reqOpts.headers["Authorization"] = auth;
                reqOpts.headers["Date"] = (new Date(ts)).toUTCString();

                var req = http.request(reqOpts, this);

                req.on("error", function(err) {
                    callback(err, null, null);
                });

                req.write(requestBody);

                req.end();
            },
            function(res) {
                var body = "";
                res.setEncoding("utf8");
                res.on("data", function(chunk) {
                    body = body + chunk;
                });
                res.on("error", function(err) {
                    callback(err, null, null);
                });
                res.on("end", function() {
                    callback(null, res, body);
                });
            }            
        );
    },

    remember: function(endpoint, id, token, ts, callback) {
        var props = {
            endpoint: endpoint,
            id: id,
            token: token,
            timestamp: ts
        };

        Step(
            function() {
                DialbackClientRequest.create(props, this);
            },
            function(err, req) {
                callback(err);
            }
        );
    },

    isRemembered: function(endpoint, id, token, ts, callback) {
        var props = {
            endpoint: endpoint,
            id: id,
            token: token,
            timestamp: ts
        },
            key = DialbackClientRequest.toKey(props);

        Step(
            function() {
                DialbackClientRequest.get(key, this);
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
    }
};

module.exports = DialbackClient;
