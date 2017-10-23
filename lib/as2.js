// as2.js
//
// conversion routine for AS1 -> AS2
//
// Copyright 2017 AJ Jordan <alex@strugee.net>
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

var _ = require("lodash");

// XXX make these shared with lib/model/activity.js?
var oprops = ["actor",
              "generator",
              "provider",
              "object",
              "target",
              "context",
              "location",
              "source"],
    aprops = ["to",
              "cc",
              "bto",
              "bcc"];

var toAS2 = function(obj) {
    var as2 = _.cloneDeep(obj);

    as2["@id"] = as2.id;
    delete as2.id;

    if (as2.verb === "post") {
        if (as2.target) {
            as2["@type"] = "Add";
        } else {
            as2["@type"] = "Create";
        }
    } else {
        as2["@type"] = as2.verb || as2.objectType;
        delete as2.objectType;
    }

    delete as2.verb;

    as2["name"] = as2.displayName;
    delete as2.displayName;

    delete as2.title;
    delete as2.upstreamDuplicates;
    delete as2.downstreamDuplicates;

    _.each(oprops, function(prop) {
        if (_.isObject(as2[prop])) {
            as2[prop] = toAS2(as2[prop]);
        }
    });

    _.each(aprops, function(prop) {
        if (_.isArray(as2[prop])) {
            _.each(as2[prop], function(addr, idx) {
                as2[prop][idx] = toAS2(as2[prop][idx]);
            });
        }
    });

    return as2;
};

module.exports = toAS2;
