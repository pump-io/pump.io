// stream-test.js
//
// Test the stream module
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

var _ = require("underscore"),
    assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    fs = require("fs"),
    path = require("path"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    schema = require("../lib/schema").schema,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var suite = vows.describe("stream index tests");

var MAX = 10000;
var SOME = 3000;

suite.addBatch({
    "When we create a new stream": {
        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {

                var Stream, mod;

                if (err) {
                    cb(err, null);
                    return;
                }

                DatabankObject.bank = db;
                
                mod = require("../lib/model/stream");

                if (!mod) {
                    cb(new Error("No module"), null);
                    return;
                }

                Stream = mod.Stream;

                if (!Stream) {
                    cb(new Error("No class"), null);
                    return;
                }

                Stream.create({name: "index-test"}, cb);
            });
        },
        "it works": function(err, stream) {
            assert.ifError(err);
            assert.isObject(stream);
        },
        "and we add a bunch of integers": {
            topic: function(stream) {
                var cb = this.callback;
                Step(
                    function() {
                        var i, group = this.group();
                        for (i = MAX - 1; i >= 0; i--) {
                            stream.deliver(i, group());
                        }
                    },
                    function(err) {
                        cb(err);
                    }
                );
            },
            "it works": function(err) {
                assert.ifError(err);
            },
            "and we get them all out": {
                topic: function(stream) {
                    stream.getItems(0, MAX, this.callback);
                },
                "it works": function(err, items) {
                    assert.ifError(err);
                    assert.isArray(items);
                    assert.equal(items.length, MAX);
                },
                "and we get each one's index": {
                    topic: function(items, stream) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var i, group = this.group();
                                for (i = 0; i < MAX; i++) {
                                    stream.indexOf(items[i], group());
                                }
                            },
                            cb
                        );
                    },
                    "it works": function(err, indices) {
                        var i;
                        assert.ifError(err);
                        assert.isArray(indices);
                        assert.lengthOf(indices, MAX);
                        for (i = 0; i < indices.length; i++) {
                            assert.equal(indices[i], i);
                        }
                    }
                }
            },
            "and we get SOME out": {
                topic: function(stream) {
                    stream.getItems(0, SOME, this.callback);
                },
                "it works": function(err, items) {
                    assert.ifError(err);
                    assert.isArray(items);
                    assert.equal(items.length, SOME);
                },
                "and we get each one's index": {
                    topic: function(items, stream) {
                        var cb = this.callback;
                        Step(
                            function() {
                                var i, group = this.group();
                                for (i = 0; i < SOME; i++) {
                                    stream.indexOf(items[i], group());
                                }
                            },
                            cb
                        );
                    },
                    "it works": function(err, indices) {
                        var i;
                        assert.ifError(err);
                        assert.isArray(indices);
                        assert.lengthOf(indices, SOME);
                        for (i = 0; i < indices.length; i++) {
                            assert.equal(indices[i], i);
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);

