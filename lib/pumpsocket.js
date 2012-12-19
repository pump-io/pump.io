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
    randomString = require("./randomstring").randomString;

var connect = function(app, log) {
    var clog = log.child({component: "sockjs"}),
        options = {
            sockjs_url: "/javascript/sockjs.min.js",
            prefix: "/main/realtime/sockjs",
            log: function(severity, message) {
                if (_.isFunction(clog[severity])) { 
                    clog[severity](message);
                } else {
                    clog.info(message);
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
                if (url2id[url].length == 0) {
                    cluster.worker.send({cmd: "unfollow", url: url});
                    delete url2id[url];
                }
            }
            if (_.contains(id2url[id], url)) {
                id2url[id].splice(id2url[id].indexOf(url), 1);
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
                    clog.info({activity: msg.activity.id,
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

    clog.info("Setting up sockjs server.");

    server.on("connection", function(conn) {
        var id = uuid.v4();
        var slog = clog.child({"connection_id": id, component: "sockjs"});
        slog.info("Connected");
        id2conn[id] = conn;
        id2url[id] = [];
        conn.on("close", function() {
            _.each(id2url[id], function(url) {
                unfollow(url, id);
            });
            delete id2url[id];
            delete id2conn[id];
            id = null;
            slog.info("Disconnected");
        });
        conn.on("data", function(message) {
            var data = JSON.parse(message);
            switch (data.cmd) {
            case "follow":
                slog.info({url: data.url}, "Follow");
                follow(data.url, id);
                break;
            case "unfollow":
                slog.info({url: data.url}, "Unfollow");
                unfollow(data.url, id);
                break;
            }
        });
        Step(
            function() {
                randomString(8, this);
            },
            function(err, str) {
                if (err) {
                    // <sad trombone>
                    slog.error(err);
                } else {
                    conn.write(JSON.stringify({cmd: "challenge", value: str}));
                }
            }
        );
    });

    server.installHandlers(app, options);
};

exports.connect = connect;
