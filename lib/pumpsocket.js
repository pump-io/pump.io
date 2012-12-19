// pumpsocket.js
//
// Our own socket.io application interface
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

var sockjs = require("sockjs"),
    cluster = require("cluster"),
    uuid = require("node-uuid"),
    Step = require("step"),
    _ = require("underscore"),
    oauth = require("oauth"),
    randomString = require("./randomstring").randomString,
    URLMaker = require("./urlmaker").URLMaker;

var connect = function(app, log) {
    var slog = log.child({component: "sockjs"}),
        options = {
            sockjs_url: "/javascript/sockjs.min.js",
            prefix: "/main/realtime/sockjs",
            log: function(severity, message) {
                if (_.isFunction(slog[severity])) { 
                    slog[severity](message);
                } else {
                    slog.info(message);
                }
            }
        },
        server,
        id2url = {},
        url2id = {},
        id2conn = {},
        follow = function(url, id) {
            if (!_.has(url2id, url)) {
                cluster.worker.send({cmd: "follow", url: url});
                url2id[url] = [id];
            } 
            if (!_.contains(url2id[url], id)) {
                url2id[url].push(id);
            }
            if (!_.contains(id2url[id], url)) {
                id2url[id].push(url);
            }
        },
        unfollow = function(url, id) {
            if (_.has(url2id, url) && _.contains(url2id[url], id)) {
                url2id[url].splice(url2id[url].indexOf(id), 1);
                if (url2id[url].length === 0) {
                    cluster.worker.send({cmd: "unfollow", url: url});
                    delete url2id[url];
                }
            }
            if (_.contains(id2url[id], url)) {
                id2url[id].splice(id2url[id].indexOf(url), 1);
            }
        },
        challenge = function(conn) {
            Step(
                function() {
                    randomString(8, this);
                },
                function(err, str) {
                    var url;
                    if (err) {
                        // <sad trombone>
                        conn.log.error(err);
                        conn.close();
                    } else {
                        conn.challenge = str;
                        url = URLMaker.makeURL("/main/realtime/sockjs", {challenge: str});
                        conn.write(JSON.stringify({cmd: "challenge",
                                                   url: url,
                                                   method: "GET"}));
                    }
                }
            );
        },
        rise = function(conn, data) {
            var client;
            if (data.params.challenge != conn.challenge) {
                conn.log.error({challenge: conn.challenge,
                                param: data.params.challenge},
                               "Bad challenge param");
                conn.close();
                return;
            }
        };

    cluster.worker.on("message", function(msg) {
        var ids, tosend;
        if (msg.cmd == "update") {
            ids = url2id[msg.url];
            if (ids && ids.length) {
                tosend = _.pick(msg, "cmd", "url", "activity");
                _.each(ids, function(id) {
                    var conn = id2conn[id];
                    slog.info({activity: msg.activity.id,
                               url: msg.url,
                               id: id},
                              "Sending activity update to connection");
                    if (conn) {
                        conn.write(JSON.stringify(tosend));
                    }
                });
            }
        }
    });

    server = sockjs.createServer(options);

    // Note this is a utility for us; SockJS uses the log() function
    // we pass in through options

    server.log = slog;

    server.log.info("Setting up sockjs server.");

    server.on("connection", function(conn) {
        var id = conn.id;
        conn.log = server.log.child({"connection_id": id, component: "sockjs"});
        conn.log.info("Connected");
        id2conn[id] = conn;
        id2url[id] = [];
        conn.on("close", function() {
            _.each(id2url[id], function(url) {
                unfollow(url, id);
            });
            delete id2url[id];
            delete id2conn[id];
            id = null;
            conn.log.info("Disconnected");
        });
        conn.on("data", function(message) {
            var data = JSON.parse(message);
            switch (data.cmd) {
            case "follow":
                conn.log.info({url: data.url}, "Follow");
                follow(data.url, id);
                break;
            case "unfollow":
                conn.log.info({url: data.url}, "Unfollow");
                unfollow(data.url, id);
                break;
            case "rise":
                conn.log.info({challenge: data.challenge}, "Rise");
                rise(conn, data);
                break;
            case "request":
                conn.log.info("Request");
                challenge(conn);
                break;
            }
            return;
        });

        // Send a challenge on connection

        challenge(conn);
    });

    server.installHandlers(app, options);
};

exports.connect = connect;
