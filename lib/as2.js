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

var verbVocabMap = {
    "share": "Announce",
    "attach": "Add",
    "author": "Create",
    "favorite": "Like",
    "flag-as-inappropriate": "Flag",
    "play": "View",
    "rsvp-maybe": "TentativeAccept",
    "rsvp-no": "Reject",
    "rsvp-yes": "Accept",
    "watch": "View"
};

// XXX handle Undos specially

var toAS2 = function(obj) {
    var as2 = _.cloneDeep(obj);

   as2["@context"] = "https://www.w3.org/ns/activitystreams";

    as2["@id"] = as2.id;
    delete as2.id;

    if (as2.verb === "post" || as2.verb === "submit") {
        if (as2.target) {
            as2["@type"] = "Add";
        } else {
            as2["@type"] = "Create";
        }
    } else {
        as2["@type"] = verbVocabMap[as2.verb] || as2.objectType;
        delete as2.objectType;
    }

    delete as2.verb;

    as2["name"] = as2.displayName;
    delete as2.displayName;

    delete as2.title;
    delete as2.upstreamDuplicates;
    delete as2.downstreamDuplicates;

    _.each(as2, function(prop, propName) {
        // Recurse into things that look vaguely like subobjects
        if (_.isObject(prop) && (_.has(prop, "verb") || _.has(prop, "objectType"))) {
            as2[propName] = toAS2(as2[propName]);
        }
    });

    _.each(as2, function(prop) {
        // Ditto
        if (_.isArray(prop)) {
            _.each(prop, function(addr, idx) {
                if (_.has(addr, "verb") || _.has(addr, "objectType")) {
                    prop[idx] = toAS2(prop[idx]);
                }
            });
        }
    });

    return as2;
};

module.exports = toAS2;
