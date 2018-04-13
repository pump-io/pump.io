// as2-to-as1-test.js
//
// Convert Activity Streams JSON 1.0 to ActivityStreams 2.0
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

var vows = require("vows");
var assert = require("assert");
var Step = require("step");
var as2 = require("activitystrea.ms");

var fromAS2 = require("../lib/fromas2");

var convert = function(from, to) {
    var type = (from.type) ? from.type : "<unknown>";
    var batch = {};
    var title = "When we convert a(n) " + type + " object";
    batch[title] = {
        topic: function() {
            Step(
                function() {
                    // Convert to an AS2 module object
                    as2.import(from, this);
                },
                function(err, imported) {
                    if (err) throw err;
                    fromAS2(imported, this);
                },
                this.callback
            );
        },
        "it works": function(err, converted) {
            assert.ifError(err);
            assert.isObject(converted);
            assert.deepEqual(converted, to);
        }
    };
    return batch;
};

vows.describe("AS2 -> AS1 conversion")
    .addBatch(convert(
        {
            id: "https://application.test",
            type: "Application",
            name: "The Test Application"
        },
        {
            id: "https://application.test",
            links: {
                self: {
                    href: "https://application.test"
                }
            },
            objectType: "application",
            displayName: "The Test Application"
        }
    ))
    .addBatch(convert(
        {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Group",
            "name": "Big Beards of Austin",
            "id": "https://bboa.example",
            "icon": {
                "type": "Link",
                "href": "https://bboa.example/logo.png",
                "mediaType": "image/png",
                "name": "Big Beards of Austin logo",
                "width": 128,
                "height": 128
            },
            "summary": "Austinites who have, or are fans of, big beards",
            "published": "2018-04-18T12:58:00Z",
            "updated": "2018-04-25T17:21:00Z"
        },
        {
            id: "https://bboa.example",
            links: {
                self: {
                    href: "https://bboa.example"
                }
            },
            objectType: "group",
            displayName: "Big Beards of Austin",
            summary: "Austinites who have, or are fans of, big beards",
            published: "2018-04-18T12:58:00.000Z",
            updated: "2018-04-25T17:21:00.000Z",
            image: {
                "url": "https://bboa.example/logo.png",
                "width": 128,
                "height": 128
            }
        }
    ))
    .export(module);
