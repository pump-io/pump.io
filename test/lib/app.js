// app.js
//
// Utilities to set up app instances
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

var cp = require("child_process"),
    path = require("path"),
    assert = require("assert"),
    proxyquire = require("proxyquire");

function noop() {}

// Call as setupApp(port, hostname, callback)
// setupApp(hostname, callback)
// setupApp(callback)

var setupApp = function(port, hostname, callback) {

    if (!hostname) {
        callback = port;
        hostname = "localhost";
        port = 4815;
    }

    if (!callback) {
        callback = hostname;
        hostname = "localhost";
    }

    port = port || 4815;
    hostname = hostname || "localhost";

    var config = {
        port: port,
        hostname: hostname
    };

    setupAppConfig(config, callback);
};

var setupAppConfig = function(config, callback) {

    var prop, args = [], credwait = {}, objwait = {};

    config.port = config.port || 4815;
    config.hostname = config.hostname || "localhost";

    for (prop in config) {
        args.push(prop + "=" + JSON.stringify(config[prop]));
    }

    var child = cp.fork(path.join(__dirname, "app-standalone.js"), args);

    var dummy = {
        close: function() {
            child.kill();
        },
        killCred: function(webfinger, callback) {
            var timeout = setTimeout(function() {
                callback(new Error("Timed out waiting for cred to die."));
            }, 30000);
            credwait[webfinger] = {callback: callback, timeout: timeout};
            child.send({cmd: "killcred", webfinger: webfinger});
        },
        changeObject: function(obj, callback) {
            var timeout = setTimeout(function() {
                callback(new Error("Timed out waiting for object change."));
            }, 30000);
            objwait[obj.id] = {callback: callback, timeout: timeout};
            child.send({cmd: "changeobject", object: obj});
        }
    };

    child.on("error", function(err) {
        callback(err, null);
    });

    child.on("message", function(msg) {
        switch (msg.cmd) {
        case "listening":
            callback(null, dummy);
            break;
        case "error":
            callback(msg.value, null);
            break;
        case "credkilled":
            clearTimeout(credwait[msg.webfinger].timeout);
            if (msg.error) {
                credwait[msg.webfinger].callback(new Error(msg.error));
            } else {
                credwait[msg.webfinger].callback(null);
            }
            break;
        case "objectchanged":
            clearTimeout(objwait[msg.id].timeout);
            if (msg.error) {
                objwait[msg.id].callback(new Error(msg.error));
            } else {
                objwait[msg.id].callback(null);
            }
            break;
        }
    });
};

var withAppSetup = function(batchConfig) {
    batchConfig.topic = function() {
        setupApp(this.callback);
    };
    batchConfig.teardown = function(app) {
        if (app && app.close) {
            app.close();
        }
    };
    batchConfig["it works"] = function(err, app) {
        assert.ifError(err);
    };

    return {
        "When we set up the app": batchConfig
    };
};

// lib/app.js expects to be run in a cluster worker with cluster.worker.on, etc.
var proxyquiredMakeApp = proxyquire("../../dist/lib/app", {
    cluster: {
        worker: {
            on: noop,
            send: noop
        }
    }
}).makeApp;

exports.setupApp = setupApp;
exports.setupAppConfig = setupAppConfig;
exports.withAppSetup = withAppSetup;
exports.proxyquiredMakeApp = proxyquiredMakeApp;
