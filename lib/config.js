// config.js
//
// Fully parse the configuration
// Basically stuff done at runtime instead of statically in defaults.js.
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

var path = require("path"),
    os = require("os"),
    _ = require("lodash"),
    defaults = require("./defaults"),
    nicknameBlacklist = require("./nicknameblacklist");

var unclustered = ["memory", "disk", "leveldb"];

function throwInternalConfig(key, log) {
    throw new Error("`" + key + "` is an internal config value and cannot be manually configured");
}

function buildConfig(configBase) {
    // Copy the base config and insert defaults

    var config = _.clone(configBase);
    config = _.defaults(config, defaults);

    // Fill in values whose defaults are other values

    config.address = config.address || config.hostname;
    config.urlPort = config.urlPort || config.port;
    config.smtpfrom = config.smtpfrom || "no-reply@"+config.hostname;

    // Throw if the user has specified internal config values
    // We do this right away so we don't, you know, throw on the values we've just filled in

    if (config.nicknameBlacklist) throwInternalConfig("nicknameBlacklist");
    if (config.canUpload) throwInternalConfig("canUpload");
    if (config.haveEmail) throwInternalConfig("haveEmail");
    if (config.workers) throwInternalConfig("workers");

    // Decide how many workers to use; useful for some processes in each worker

    var cnt;
    if (config.children) {
        cnt = config.children;
    } else if (_(config).has("driver") && unclustered.indexOf(config.driver) !== -1) {
        cnt = 1;
    } else {
        cnt = Math.max(os.cpus().length - 1, 1);
    }

    config.workers = cnt;

    // /var/run is owned by root, so if we *aren't* root, we fall back to /tmp

    if (!config.controlSocket && process.getuid) {
        if (process.getuid() === 0) {
            config.controlSocket = "/var/run/pump.socket";
        } else {
            config.controlSocket = "/tmp/pump.socket";
        }
    } else if (!config.controlSocket) {
        config.controlSocket = "/tmp/pump.socket";
    }

    // Load the nickname blacklist into the config

    config.nicknameBlacklist = nicknameBlacklist;

    // Throw on configs written for < 3.x

    if (config.uploaddir) {
        throw new Error("`uploaddir` is no longer supported; see the pump.io 3.x release notes");
    }

    if (config.enableUploads) {
        if (!config.datadir) throw new Error("Uploads enabled but no `datadir` specified");
        config.uploaddir = path.join(config.datadir, "uploads");
    }

    // Throw if the user tries to have the control socket be a TCP port

    if (_.isNumber(config.controlSocket) || !_.isNaN(Number(config.controlSocket))) {
        throw new Error("For security reasons, `controlSocket` cannot be something that looks like a TCP port");
    }

    // Throw if the user has a dumb config

    if (!configBase.secret || configBase.secret === "my dog has fleas") {
        throw new Error("`config.secret` is either unset or set to the sample value; please set a real secret");
    }

    // Throw if we don't have the right privileges

    if (process.getuid) {
        if (config.port < 1024 && process.getuid() !== 0) {
            throw new Error("Can't listen to ports lower than 1024 on POSIX systems unless you're root.");
        }
    }

    return config;
}

module.exports.buildConfig = buildConfig;
