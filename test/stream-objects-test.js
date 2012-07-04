// stream-test.js
//
// Test the stream module
//
// Copyright 2012, StatusNet Inc.
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

var assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    schema = require("../lib/schema").schema,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("stream objects interface");

// Test the object methods

suite.addBatch({

    "When we get the Stream class": {

        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get("memory", params);

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

                cb(null, Stream);
            });
        },
        "it works": function(err, Stream) {
            assert.ifError(err);
            assert.isFunction(Stream);
        },
        "and we create a stream object": {
            topic: function(Stream) { 
                Stream.create({name: "object-test-1"}, this.callback);
            },
            "it has a getObjects() method": function(err, stream) {
                assert.ifError(err);
                assert.isFunction(stream.getObjects);
            },
            "it has a getObjectsGreaterThan() method": function(err, stream) {
                assert.ifError(err);
                assert.isFunction(stream.getObjectsGreaterThan);
            },
            "it has a getObjectsLessThan() method": function(err, stream) {
                assert.ifError(err);
                assert.isFunction(stream.getObjectsLessThan);
            },
            "it has a deliverObject() method": function(err, stream) {
                assert.ifError(err);
                assert.isFunction(stream.deliverObject);
            },
            "it has a removeObject() method": function(err, stream) {
                assert.ifError(err);
                assert.isFunction(stream.removeObject);
            },
            "and we get some objects": {
                topic: function(stream) {
                    stream.getObjects(0, 20, this.callback);
                },
                "it works": function(err, objects) {
                    assert.ifError(err);
                },
                "it is an empty array": function(err, objects) {
                    assert.isArray(objects);
                    assert.lengthOf(objects, 0);
                }
            },
            "and we get objects with indexes greater than some object": {
                topic: function(stream) {
                    var cb = this.callback,
                        NotInStreamError = require('../lib/model/stream').NotInStreamError;

                    stream.getObjectsGreaterThan({a: "b"}, 10, function(err, objects) {
                        if (err && err instanceof NotInStreamError) {
                            cb(null);
                        } else if (err) {
                            cb(err);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we get objects with indexes less than some object": {
                topic: function(stream) {
                    var cb = this.callback,
                        NotInStreamError = require('../lib/model/stream').NotInStreamError;

                    stream.getObjectsLessThan({a: "b"}, 10, function(err, objects) {
                        if (err && err instanceof NotInStreamError) {
                            cb(null);
                        } else if (err) {
                            cb(err);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we remove an object that doesn't exist": {
                topic: function(stream) {
                    var cb = this.callback,
                        NotInStreamError = require('../lib/model/stream').NotInStreamError;

                    stream.removeObject({a: "b"}, 10, function(err, objects) {
                        if (err && err instanceof NotInStreamError) {
                            cb(null);
                        } else if (err) {
                            cb(err);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite["export"](module);