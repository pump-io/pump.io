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

var _ = require("lodash"),
    Step = require("step");

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

var toAS2 = function(obj, cb) {
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
        as2["@type"] = verbVocabMap[as2.verb] || as2.verb || as2.objectType;
        delete as2.objectType;
   }

    delete as2.verb;

    as2["name"] = as2.displayName;
    delete as2.displayName;

    delete as2.title;
    delete as2.upstreamDuplicates;
    delete as2.downstreamDuplicates;

    Step(
        function() {
            // XXX this.parallel()?
            var that = this,
                foundSubobj = false;

            _.each(as2, function(prop, propName) {
                // Recurse into things that look vaguely like subobjects
                var subObjs = 0;
                if (_.isObject(prop) && (_.has(prop, "verb") || _.has(prop, "objectType"))) {
                    subObjs++;
                    foundSubobj = true;
                    toAS2(as2[propName], function(err, obj) {
                        /*
                          It's safe to call cb() directly because that way subObjs doesn't get
                          decremented, and will always be >0. So that() never gets called and we
                          don't end up calling cb() again.
                         */

                        if (err) {
                            cb(err);
                            return;
                        }

                        subObjs--;
                        as2[propName] = obj;
                        if (subObjs === 0) that();
                    });
                }
            });

            if (!foundSubobj) that();
        },
        function() {
            var foundSubarray = false;

            _.each(as2, function(prop) {
                // Ditto for arrays
                var propChange = 0;

                if (_.isArray(prop)) {
                    _.each(prop, function(addr, idx) {
                        if (_.has(addr, "verb") || _.has(addr, "objectType")) {
                            propChange++;
                            foundSubarray = true;
                            toAS2(prop[idx], function(err, obj) {
                                if (err) {
                                    cb(err);
                                    return;
                                }

                                propChange--;
                                prop[idx] = obj;
                                if (propChange === 0) process.nextTick(cb.bind(undefined, undefined, as2));
                            });
                        }
                    });
                }
            });

            if (!foundSubarray) process.nextTick(cb.bind(undefined, undefined, as2));
        }
    );
};

module.exports = toAS2;
