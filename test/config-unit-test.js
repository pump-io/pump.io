// config-unit-test.js
//
// Test the config module
//
// Copyright 2018 AJ Jordan <alex@strugee.net>
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

var assert = require("assert"),
    vows = require("vows"),
    os = require("os"),
    cpus = os.cpus,
    getuid = process.getuid;

var suite = vows.describe("config module");

function withSecret(obj) {
    obj.secret = "sekkret";
    return obj;
}

function tryToBuild(obj) {
    return {
        topic: function(mod) {
            return mod.buildConfig.bind(null, obj);
        },
        "it throws an error": function(err, fn) {
            assert.throws(fn);
        }
    };
}

suite.addBatch({
    "When we get the config module and mock out os.cpus()": {
        topic: function() {
            os.cpus = () => [{}, {}, {}, {}];
            return require("../lib/config");
        },
        teardown: function() {
            os.cpus = cpus;
        },
        "there is one": function(mod) {
            assert.isObject(mod);
        },
        "it has the right exports": function(mod) {
            assert.isFunction(mod.buildConfig);
        },
        "and we build a config from an object with just the secret": {
            topic: function(mod) {
                return mod.buildConfig(withSecret({}));
            },
            "it works": function(err, config) {
                assert.ifError(err);
                assert.isObject(config);
            },
            "the defaults are filled in": function(err, config) {
                assert.isNumber(config.port);
                assert.isString(config.hostname);
            },
            "the nickname blacklist is loaded": function(err, config) {
                assert.isArray(config.nicknameBlacklist);
            }
        },
        "and we build a config that enables uploads": {
            topic: function(mod) {
                return mod.buildConfig(withSecret({
                    enableUploads: true,
                    datadir: "/some/directory"
                }));
            },
            "it works": function(err, config) {
                assert.ifError(err);
                assert.isObject(config);
            },
            "config.uploaddir is set to the right thing": function(err, config) {
                assert.isString(config.uploaddir);
                assert.equal(config.uploaddir, "/some/directory/uploads");
            }
        },
        "and we build a config that sets hostname but not address or smtpfrom": {
            topic: function(mod) {
                return mod.buildConfig(withSecret({hostname: "example.net"}));
            },
            "it works": function(err, config) {
                assert.ifError(err);
                assert.isObject(config);
            },
            "address defaults to hostname": function(err, config) {
                assert.isString(config.address);
                assert.equal(config.address, "example.net");
            },
            "smtpfrom defaults to no-reply@ plus the hostname": function(err, config) {
                assert.isString(config.smtpfrom);
                assert.equal(config.smtpfrom, "no-reply@example.net");
            }
        },
        "and we build a config that sets port but not urlPort": {
            topic: function(mod) {
                return mod.buildConfig(withSecret({port: 31337}));
            },
            "it works": function(err, config) {
                assert.ifError(err);
                assert.isObject(config);
            },
            "urlPort defaults to port": function(err, config) {
                assert.isNumber(config.urlPort);
                assert.equal(config.urlPort, 31337);
            }
        },
        "and we build a config with an unclustered Databank driver": {
            topic: function(mod) {
                return mod.buildConfig(withSecret({driver: "memory"}));
            },
            "it works": function(err, config) {
                assert.ifError(err);
                assert.isObject(config);
            },
            "we choose to use only 1 worker": function(err, config) {
                assert.isNumber(config.workers);
                assert.equal(config.workers, 1);
            }
        },
        "and we build a config with a clustered Databank driver": {
            topic: function(mod) {
                return mod.buildConfig(withSecret({"driver": "mongodb"}));
            },
            "it works": function(err, config) {
                assert.ifError(err);
                assert.isObject(config);
            },
            "we choose to use >1 worker": function(err, config) {
                assert.isNumber(config.workers);
                assert.greater(config.workers, 1);
            }
        },
        "and we build a config with an explicit config.children": {
            topic: function(mod) {
                return mod.buildConfig(withSecret({children: 1337}));
            },
            "it works": function(err, config) {
                assert.ifError(err);
                assert.isObject(config);
            },
            "our choice was respected": function(err, config) {
                assert.isNumber(config.workers);
                assert.equal(config.workers, 1337);
            }
        },
        "and we try to build a config with uploaddir specified": tryToBuild({uploaddir: "/some/directory"}),
        "and we try to build a config with uploads enabled but no datadir": tryToBuild({enableUploads: true}),
        "and we try to build a config with port < 1024 while we're not root": tryToBuild({secret: "p4ssword", port: 80}),
        "and we try to build a config with controlSocket set to a TCP port number": tryToBuild({controlSocket: 9000}),
        "and we try to build a config with controlSocket set to a string that looks like a TCP port number": tryToBuild({controlSocket: "9000"}),
        "and we try to build a config with nicknameBlacklist defined": tryToBuild({nicknameBlacklist: [], secret: "foobar"}),
        "and we try to build a config with canUpload defined": tryToBuild({canUpload: [], secret: "foobar"}),
        "and we try to build a config with haveEmail defined": tryToBuild({haveEmail: [], secret: "foobar"}),
        "and we try to build a config with workers defined": tryToBuild({workers: 1, secret: "foobar"}),
        "and we try to build a config with secret undefined": tryToBuild({}),
        "and we try to build a config with the example secret": tryToBuild({secret: "my dog has fleas"})
    }
});

suite.addBatch({
    "When we get the config module and mock out process.getuid() to return 0": {
        topic: function() {
            process.getuid = function() {
                return 0;
            };

            return require("../lib/config");
        },
        teardown: function() {
            process.getuid = getuid;
        },
        "it works": function(err, mod) {
            assert.ifError(err);
            assert.isObject(mod);
        },
        "and we try building a config": {
            topic: function(mod) {
                return mod.buildConfig({
                    secret: "foobar"
                });
            },
            "it works": function(err, config) {
                assert.ifError(err);
                assert.isObject(config);
            },
            "`controlSocket` was set to `/var/run/pump.socket`": function(err, config) {
                assert.isString(config.controlSocket);
                assert.equal(config.controlSocket, "/var/run/pump.socket");
            }
        }
    }
});

suite.addBatch({
    "When we get the config module and we pretend we don't have process.getuid()": {
        topic: function() {
            process.getuid = undefined;

            return require("../lib/config");
        },
        teardown: function() {
            process.getuid = getuid;
        },
        "it works": function(err, mod) {
            assert.ifError(err);
            assert.isObject(mod);
        },
        "and we try building a config": {
            topic: function(mod) {
                return mod.buildConfig({
                    secret: "foobar"
                });
            },
            "it works": function(err, config) {
                assert.ifError(err);
                assert.isObject(config);
            },
            "`controlSocket` was set to `/tmp/pump.socket`": function(err, config) {
                assert.isString(config.controlSocket);
                assert.equal(config.controlSocket, "/tmp/pump.socket");
            }
        }
    }
});

suite["export"](module);
