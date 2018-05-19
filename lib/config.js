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
    _ = require("lodash"),
    defaults = require("./defaults"),
    nicknameBlacklist = require("./nicknameblacklist");

function warnInternalConfig(key, log) {
    log.warn("`" + key + "` is an internal config value which will be overwritten and have no effect");
}

function buildConfig(configBase) {
    // Copy the base config and insert defaults

    var config = _.clone(configBase);
    config = _.defaults(config, defaults);

    // Fill in values whose defaults are other values

    config.address = config.address || config.hostname;
    config.urlPort = config.urlPort || config.port;
    config.smtpfrom = config.smtpfrom || "no-reply@"+config.hostname;

    // XXX decide on number of workers here

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

    // Throw if we don't have the right privileges

    if (process.getuid) {
        if (config.port < 1024 && process.getuid() !== 0) {
            throw new Error("Can't listen to ports lower than 1024 on POSIX systems unless you're root.");
        }
    }

    return config;
}

// Stuff that runs after we've initialized a logger
function validateConfig(configBase, log) {
    // Warn if the user has a dumb config

    if (configBase.nicknameBlacklist) warnInternalConfig("nicknameBlacklist", log);
    if (configBase.canUpload) warnInternalConfig("canUpload", log);
    if (configBase.haveEmail) warnInternalConfig("haveEmail", log);
    if (!configBase.secret || configBase.secret === "my dog has fleas") {
        log.warn("`config.secret` is either unset or set to the sample value; this is very insecure and should be changed ASAP");
    }
}

module.exports.buildConfig = buildConfig;
module.exports.validateConfig = validateConfig;
