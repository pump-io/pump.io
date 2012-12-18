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

var socketio = require("socket.io"),
    cluster = require("cluster"),
    uuid = require("node-uuid"),
    Step = require("step"),
    _ = require("underscore"),
    randomString = require("./randomstring").randomString;

var connect = function(app, log) {
    var options = {log: false},
        clog = log.child({component: "socketio"}),
        id2url = {},
        url2id = {},
        id2socket = {},
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
        clog.info(msg);
        if (msg.cmd == "update") {
            ids = url2id[msg.url];
            if (ids && ids.length) {
                tosend = _.pick(msg, "url", "activity");
                _.each(ids, function(id) {
                    var socket = id2socket[id];
                    clog.info({msg: "sending to socket", id: "id"});
                    if (socket) {
                        socket.emit("update", tosend);
                    }
                });
            }
        }
    });

    log.info("Setting up socket.io server.");
    app.io = socketio.listen(app, options);
    app.io.on("connection", function(socket) {
        var id = uuid.v4();
        var slog = clog.child({"connection_id": id, component: "socketio"});
        slog.info("Connected");
        id2socket[id] = socket;
        id2url[id] = [];
        socket.on("disconnect", function() {
            _.each(id2url[id], function(url) {
                unfollow(url, id);
            });
            delete id2url[id];
            delete id2socket[id];
            id = null;
            slog.info("Disconnected");
        });
        socket.on("follow", function(data) {
            slog.info({msg: "follow", url: data.url});
            follow(data.url, id);
        });
        socket.on("unfollow", function(data) {
            slog.info({msg: "unfollow", url: data.url});
            unfollow(data.url, id);
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
                    socket.emit("challenge", {value: str});
                }
            }
        );
        socket.on("rise to challenge", function() {
        });
    });
};

exports.connect = connect;
