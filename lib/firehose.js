// firehose.js
//
// Update a remote firehose
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

var _ = require("underscore"),
    http = require("http"),
    https = require("https"),
    urlparse = require("url").parse,
    Queue = require("jankyqueue"),
    Step = require("step"),
    web = require("./web"),
    HTTPError = require("./httperror").HTTPError;

// How many pings we should have going at once

var QUEUE_MAX = 25;

var host    = null;
var log     = null;
var mod     = null;
var options = null;
var q       = new Queue(QUEUE_MAX);

// Main interface

var Firehose = {
    setup: function(hostname, plog) {
        host = hostname;
        if (plog) {
            log = plog.child({component: "firehose", firehose: hostname});
            log.info("Setting up firehose.");
        }
    },
    ping: function(activity, callback) {
        var hose = this;

        if (log) log.info({activity: activity.id}, "Enqueuing ping.");

        // If there's no host, silently skip

        if (!host) {
            if (log) log.warn({activity: activity.id}, "Skipping; no host.");
            callback(null);
            return;
        }

        // Enqueue 
        q.enqueue(pinger, [activity], callback);
    }
};

// Actually pings the firehose

var pinger = function(activity, callback) {
    Step(
        function() {
            getEndpointOptions(this);
        },
        function(err, mod, options) {
            var req, json, opts = _.clone(options);
            if (err) throw err;
            json = JSON.stringify(activity);
            if (!opts.headers) {
                opts.headers = {};
            }
            opts.headers["Content-Length"] = json.length;
            opts.headers["Content-Type"] = "application/json";
            if (log) log.info({activity: activity.id}, "Pinging firehose");
            web.mod(mod, opts, json, this);
        },
        function(err, res) {
            if (err) {
                // XXX: retry
                if (log) log.error(err);
                callback(err);
            } else if (res.statusCode >= 400 && res.statusCode < 600) {
                err = new HTTPError(res.body, res.statusCode);
                if (log) log.error(err);
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

// Does this response include some indication that the endpoint allows POST requests?

var allowsPost = function(res) {

    var allow;

    if (!_(res.headers).has("allow")) {
        return false;
    }

    allow = res.headers.allow.split(",").map(function(s) { return s.trim(); });

    return _.contains(allow, "POST");
};

// Get the options needed to ping the firehose endpoint
// callback is called with err, mod, options
// mod is http or https

var getEndpointOptions = function(callback) {

    if (mod && options) {
        callback(null, mod, options);
        return;
    }

    if (!host) {
        callback(new Error("No host"), null, null);
        return;
    }

    Step(
        // Test the HTTPS endpoint
        function() {
            var topt = {
                hostname: host,
                port: 443,
                path: "/ping",
                method: "OPTIONS"
            };
            web.https(topt, this);
        },
        // If that works, return options and HTTPS mod
        // If it doesn't, test the HTTP endpoint
        function(err, res) {
            var topt;
            var allow;
            if (!err && allowsPost(res)) {
                options = {
                    hostname: host,
                    port: 443,
                    path: "/ping",
                    method: "POST"
                };
                mod = https;
                callback(null, mod, options);
            } else {
                topt = {
                    hostname: host,
                    port: 80,
                    path: "/ping",
                    method: "OPTIONS"
                };
                web.http(topt, this);
            }
        },
        // If that works, return options and HTTP mod
        // If it doesn't, fail
        function(err, res) {
            if (!err && allowsPost(res)) {
                options = {
                    hostname: host,
                    port: 80,
                    path: "/ping",
                    method: "POST"
                };
                mod = http;
                callback(null, mod, options);
            } else {
                callback(new Error("No suitable endpoints"), null, null);
            }
        }
    );
};

module.exports = Firehose;
