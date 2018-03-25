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
    Step = require("step"),
    ActivityObject = require("./model/activityobject").ActivityObject;

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

var ucfirst = function(str) {
  return (str) ? str.charAt(0).toUpperCase() + str.slice(1) : null;
};

var toAS2 = function(obj, cb) {
    var as2 = _.cloneDeep(obj);

    as2["@context"] = "https://www.w3.org/ns/activitystreams";

    // Setting the type

    if (as2.verb === "post" || as2.verb === "submit") {
        if (as2.target) {
            as2["type"] = "Add";
        } else {
            as2["type"] = "Create";
        }
    } else if (!as2.objectType && _.isArray(as2.items)) {
        // XXX: deal with user lists which aren't really that ordered
        // when you think about it.
        as2.type = "OrderedCollection";
    } else {
        as2["type"] = verbVocabMap[as2.verb] || as2.verb || ucfirst(as2.objectType);
        delete as2.objectType;
    }

    delete as2.verb;

    // NOTE: We fudge the ID value for users only because
    // with ActivityPub this is the ID people share

    if (as2.type == "Person" && ActivityObject.isLocal(obj)) {
      as2.id = as2.url;
      delete as2.url;
    }

    as2["name"] = as2.displayName;
    delete as2.displayName;

    delete as2.title;
    delete as2.upstreamDuplicates;
    delete as2.downstreamDuplicates;

    // Setting the outbox

    if (as2.links && as2.links["activity-outbox"] && as2.links["activity-outbox"].href) {
      as2.outbox = as2.links["activity-outbox"].href;
      delete as2.links["activity-outbox"];
    }

    // Restructure our collections

    if (as2.type === "Collection" || as2.type === "OrderedCollection") {
      var next = (as2.links.next) ? as2.links.next.href : null;
      var prev = (as2.links.prev) ? as2.links.prev.href : null;
      var first = (as2.links.first) ? as2.links.first.href : null;
      as2.first = {
        type: as2.type + "Page",
        id: first,
        next: next,
        prev: prev,
        orderedItems: as2.items
      };
      delete as2.items;
      delete as2.links.first;
      if (as2.links.next) {
        delete as2.links.next;
      }
      if (as2.links.prev) {
        delete as2.links.prev;
      }
      if (as2.objectTypes) {
        delete as2.objectTypes;
      }
    }

    // XXX: get other streams before here!

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
