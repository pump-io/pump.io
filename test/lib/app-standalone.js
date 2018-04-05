// app.js
//
// Utilities for setting up the app
//
// Copyright 2012-2013 E14N https://e14n.com/
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

"use strict";

var _ = require("lodash"),
    Step = require("step"),
    cluster = require("cluster"),
    mod = require("../../lib/app"),
    fs = require("fs"),
    path = require("path"),
    Dispatch = require("../../lib/dispatch"),
    makeApp = mod.makeApp;

var tc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "config.json")));

var config = _.extend(tc, {
              firehose: false,
              sockjs: false,
              noCDN: true,
              debugClient: false,
              nologger: true}),
    app = null,
    i,
    parts,
    worker;

process.env.NODE_ENV = "test";

for (i = 2; i < process.argv.length; i++) {
    parts = process.argv[i].split("=");
    config[parts[0]] = JSON.parse(parts[1]);
}

config.port = parseInt(config.port, 10);

if (cluster.isMaster) {
    worker = cluster.fork();
    worker.on("message", function(msg) {
        switch (msg.cmd) {
        case "error":
        case "listening":
        case "credkilled":
        case "objectchanged":
            process.send(msg);
            break;
        default:
            break;
        }
    });
    Dispatch.start();
    process.on("message", function(msg) {
        switch (msg.cmd) {
        case "killcred":
        case "changeobject":
            worker.send(msg);
            break;
        }
    });
    process.on('SIGTERM', function () {
        console.error("Got SIGTERM in parent");
        if (_.isFunction(worker.disconnect)) {
            console.error("Disconnecting worker");
            worker.disconnect();
        } else {
            console.error("Killing worker");
            worker.kill();
        }
        process.exit(0);
    });
} else {
    Step(
        function() {
            makeApp(config, this);
        },
        function(err, res) {
            if (err) throw err;
            app = res;
            app.run(this);
        },
        function(err) {
            if (err) {
                process.send({cmd: "error", value: err});
            } else {
                process.send({cmd: "listening"});
            }
        }
    );

    process.on("message", function(msg) {
        switch (msg.cmd) {
        case "killcred":
            // This is to simulate losing the credentials of a remote client
            // It's hard to do without destroying the database values directly,
            // so we essentially do that.
            Step(
                function() {
                    var client = require("../../lib/model/client"),
                        Client = client.Client;
                    Client.search({webfinger: msg.webfinger}, this);
                },
                function(err, results) {
                    if (err) throw err;
                    if (!results || results.length !== 1) {
                        throw new Error("Bad results");
                    }
                    results[0].del(this);
                },
                function(err) {
                    if (err) {
                        process.send({cmd: "credkilled", error: err.message, webfinger: msg.webfinger});
                    } else {
                        process.send({cmd: "credkilled", webfinger: msg.webfinger});
                    }
                }
            );
            break;
        case "changeobject":
            // we break an object
            var DatabankObject = require("databank").DatabankObject,
                db = DatabankObject.bank,
                object = msg.object;
            Step(
                function() {
                    db.update(object.objectType, object.id, object, this);
                },
                function(err) {
                    if (err) {
                        process.send({cmd: "objectchanged", error: err.message, id: object.id});
                    } else {
                        process.send({cmd: "objectchanged", id: object.id});
                    }
                }
            );
            break;
        }
    });
}
