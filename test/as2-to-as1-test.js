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
    .export(module);
