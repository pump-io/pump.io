// restartutil.js
//
// Utilities to support zero-downtime restart
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

var importFresh = require("import-fresh"),
    restartEpoch = require("../lib/zerodowntime");

var checkRequirements = function(config, abortedRestart, restartInflight) {
    var obj = {
        ok: false
    };

    if (config.workers <= 1) {
        obj.reason = "no workers";
        return obj;
    }

    if (config.driver !== "mongodb") {
        obj.reason = "bad driver";
        return obj;
    }

    if (abortedRestart) {
        obj.reason = "aborted restart";
        return obj;
    }

    if (restartInflight) {
        obj.reason = "restart inflight";
        return obj;
    }

    var newEpoch = importFresh("../lib/zerodowntime");
    if (newEpoch !== restartEpoch) {
        obj.reason = "bad epoch";
        return obj;
    }


    obj.ok = true;
    return obj;
};

module.exports.checkRequirements = checkRequirements;
