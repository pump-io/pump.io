// as2headers.js
//
// Negotiate ALL the AS2 Content-Types
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

var as2 = require("./as2");

var wantAS2 = function(req) {
    // TODO are these MIME types the ones we want? In the right order?
    return req.accepts(["application/stream+json",
                        "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"",
                        "application/activity+json"]) !== "application/stream+json";
};

var maybeAS2 = function(req, res, next, obj) {
    if (wantAS2(req)) {
        as2(obj, function(err, nobj) {
            if (err) {
                next(err);
            } else {
              // XXX: handle the application/activity+json media type
              res.setHeader("Content-Type", "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"");
              res.end(JSON.stringify(nobj));
            }
        });
    } else {
        res.json(obj);
    }
};

module.exports.wantAS2 = wantAS2;
module.exports.maybeAS2 = maybeAS2;
