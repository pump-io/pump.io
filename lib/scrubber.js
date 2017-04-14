// scrubber.js
//
// Scrub HTML for dangerous XSS crap
//
// Copyright 2012, E14N https://e14n.com/
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

var _ = require("underscore"),
    validator = require("validator"),
    sanitizeHtml = require("sanitize-html"),
    majorRelease = Number(process.versions.node.split(".")[0]);

if (majorRelease >= 4) {
    var jsdom = require("jsdom"),
        window = jsdom.jsdom("", {
            features: {
                FetchExternalResources: false,
                ProcessExternalResources: false
            }
        }).defaultView,
        DOMPurify = require("dompurify")(window);
}

var Scrubber = {
    scrub: function(str) {
        if (majorRelease < 4) {
            // Node.js 0.10, 0.12, or io.js
            return sanitizeHtml(str, {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "style", "span", "abbr", "address", "aside", "audio", "cite", "col", "data", "dd", "del", "details", "dfn", "dl", "dt", "figcaption", "figure", "footer", "header", "ins", "kbd", "label", "mark", "meter", "nav", "output", "progress", "q", "rb", "rt", "rtc", "ruby", "s", "samp", "section", "small", "source", "sub", "summary", "sup", "td", "template", "tfoot", "time", "track", "u", "var", "wbr"]),
                allowedAttributes: {
                    a: ["download", "href", "hreflang", "name", "target", "ping", "referrerpolicy", "rel", "target", "type"],
                    abbr: ["title"],
                    audio: ["autoplay", "buffers", "controls", "loop", "muted", "preload", "src", "volume"],
                    blockquote: ["cite"],
                    col: ["span"],
                    colgroup: ["span"],
                    data: ["value"],
                    del: ["cite", "datetime"],
                    details: ["open"],
                    img: ["src"],
                    ins: ["cite", "datetime"],
                    li: ["value"],
                    meter: ["value", "min", "max", "low", "high", "optimum"],
                    ol: ["reversed", "start", "type"],
                    output: ["for", "name"],
                    progress: ["max", "value"],
                    q: ["cite"],
                    source: ["src", "type"],
                    table: ["align", "border", "cellpadding", "frame", "rules", "summary", "width"],
                    tbody: ["align", "char", "charoff", "valign"],
                    td: ["colspan", "headers", "rowspan"],
                    th: ["colspan", "headers", "rowspan", "scope"],
                    time: ["datetime"],
                    track: ["default", "kind", "label", "src", "srclang"],
                    video: ["autoplay", "controls", "height", "loop", "muted", "preload", "poster", "src", "width"],
                    "*": ["data-*", "style"]
                },
                allowedSchemes: ["http", "https", "ftp", "mailto", "xmpp", "irc"]
            });
        } else {
            // Node.js 4.x or better
            return DOMPurify.sanitize(str);
        }
    },
    scrubActivity: function(act) {

        var strings = ["content"],
            objects = ["actor",
                       "object",
                       "target",
                       "generator",
                       "provider",
                       "context",
                       "source"],
            arrays = ["to",
                      "cc",
                      "bto",
                      "bcc"];

        // Remove any incoming private properties

        _.each(act, function(value, key) {
            if (key[0] === "_") {
                delete act[key];
            }
        });

        _.each(strings, function(sprop) {
            if (_.has(act, sprop)) {
                act[sprop] = Scrubber.scrub(act[sprop]);
            }
        });

        _.each(objects, function(prop) {
            if (_.has(act, prop)) {
                if (_.isObject(act[prop])) {
                    act[prop] = Scrubber.scrubObject(act[prop]);
                }
            }
        });

        _.each(arrays, function(array) {
            if (_.has(act, array)) {
                if (_.isArray(act[array])) {
                    _.each(act[array], function(item, index) {
                        Scrubber.scrubObject(item);
                    });
                }
            }
        });

        return act;
    },
    scrubObject: function(obj) {

        var strings = ["content", "summary"],
            objects = ["author",
                       "location"],
            arrays = ["attachments",
                      "tags"];

        // Remove any incoming private properties

        _.each(obj, function(value, key) {
            if (key[0] === "_") {
                delete obj[key];
            }
        });

        _.each(strings, function(sprop) {
            if (_.has(obj, sprop)) {
                obj[sprop] = Scrubber.scrub(obj[sprop]);
            }
        });

        _.each(objects, function(prop) {
            if (_.has(obj, prop)) {
                if (_.isObject(obj[prop])) {
                    obj[prop] = Scrubber.scrubObject(obj[prop]);
                }
            }
        });

        _.each(arrays, function(array) {
            if (_.has(obj, array)) {
                if (_.isArray(obj[array])) {
                    _.each(obj[array], function(item, index) {
                        Scrubber.scrubObject(item);
                    });
                }
            }
        });

        return obj;
    }
};

// So you can require("scrubber").Scrubber or just require("scrubber")

Scrubber.Scrubber = Scrubber;

module.exports = Scrubber;
