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
    uuid = require("node-uuid"),
    Step = require("step"),
    _ = require("underscore"),
    randomString = require("./randomstring").randomString;

var connect = function(app, log) {
    var options = {log: false};
    log.info("Setting up socket.io server.");
    app.io = socketio.listen(app, options);
    app.io.on("connection", function(socket) {
        socket.log = log.child({"connection_id": uuid.v4(), component: "socket.io"});
        socket.log.info("Connected");
        socket.on("disconnect", function() {
            socket.log.info("Disconnected");
        });
        socket.on("rise to challenge", function() {
        });
        Step(
            function() {
                randomString(8, this);
            },
            function(err, str) {
                if (err) {
                    // <sad trombone>
                    socket.log.error(err);
                } else {
                    socket.emit("challenge", {value: str});
                }
            }
        );
    });
};

exports.connect = connect;
