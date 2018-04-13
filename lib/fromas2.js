// lib/fromas2.js
//
// Converts objects from activitystrea.ms library to as1
//
// Copyright 2018 E14N <https://e14n.com/>
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

var assert = require("assert");
var _ = require("lodash");
var Step = require("step");

// We export a single function that converts an object from
// the activitystrea.ms
module.exports = function fromAS2(imported, callback) {
    assert(_.isObject(imported));
    assert(_.isFunction(callback));
    var copy = {};
    Step(
        function() {
            copyScalarProperties(imported, copy, this);
        },
        function(err) {
            if (err) throw err;
            copyObjectProperties(imported, copy, this);
        },
        function(err) {
            if (err) throw err;
            this(null, copy);
        },
        callback
    );
    return undefined;
};

function copyScalarProperties(imported, copy, callback) {
    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));
    copy.objectType = convertType(String(imported.type));
    copy.id = imported.id;
    copy.links = copy.links || {};
    copy.links.self = {href: copy.id};
    if (imported.name) {
        copy.displayName = imported.name.get();
    }
    if (imported.summary) {
        copy.summary = imported.summary.get();
    }
    if (imported.published) {
        copy.published = imported.published.get().toDate().toISOString();
    }
    if (imported.updated) {
        copy.updated = imported.updated.get().toDate().toISOString();
    }
    setImmediate(callback, null);
}

function copyObjectProperties(imported, copy, callback) {
    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));
    // Take the first of image or icon
    for (var iprop of ["image", "icon"]) {
        var member = imported.get(iprop);
        if (member && member.length >= 1 ) {
            var first = member.first;
            var link = null;
            if (typeMatch(first.type, "Link")) {
                link = first;
            } else if (first.url && first.url.length >= 1 && typeMatch(first.url.first.type, "Link")) {
                link = first.url.first;
            }
            if (link) {
                var image = copy.image = copy.image || {};
                if (link.href) {
                    image.url = link.href;
                }
                if (link.width) {
                    image.width = link.width;
                }
                if (link.height) {
                    image.height = link.height;
                }
            }
        }
    }
    setImmediate(callback, null);
}

var NS = "https://www.w3.org/ns/activitystreams#";

function convertType(str) {
    assert(_.isString(str));
    if (str.startsWith(NS)) {
        return str.substr(NS.length).toLowerCase();
    } else {
        return str.toLowerCase();
    }
}

function typeMatch(a, b) {
    if (a.startsWith(NS) && b.startsWith(NS)) {
        return a === b;
    } else if (a.startsWith(NS) && !b.startsWith("http")) {
        return a === NS + b;
    } else if (!a.startsWith("http") && b.startsWith(NS)) {
        return NS + a === b;
    } else {
        return a === b;
    }
}
