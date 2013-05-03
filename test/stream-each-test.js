// stream-each-test.js
//
// Test the iterator interface to a stream
//
// Copyright 2013, E14N https://e14n.com/
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
    modelBatch = require("./lib/model").modelBatch,
    schema = require("../lib/schema").schema,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var suite = vows.describe("stream iterator interface");

suite.addBatch({

    "When we setup the env": {
        topic: function() {
            var cb = this.callback;

            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            var stream = null;

            db.connect({}, function(err) {

                if (err) {
                    cb(err, null);
                    return;
                }

                DatabankObject.bank = db;
                
                var Stream = require("../lib/model/stream").Stream;
                cb(null, Stream);
            });
        },
        "it works": function(err, Stream) {
            assert.ifError(err);
        },
        "and we create a stream": {
            topic: function(Stream) {
                Stream.create({name: "test-each-1"}, this.callback);
            },
            "it works": function(err, stream) {
                assert.ifError(err);
                assert.isObject(stream);
            },
            "it has an each method": function(err, stream) {
                assert.ifError(err);
                assert.isFunction(stream.each);
            },
            "and we add 5000 ids": {
                topic: function(stream, Stream) {
                    var cb = this.callback;
                    Step(
                        function() {
                            var i, group = this.group();
                            for (i = 0; i < 5000; i++) {
                                stream.deliver("http://example.net/api/object/"+i, group());
                            }
                        },
                        function(err) {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null);
                            }
                        }
                    );
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we iterate over them": {
                    topic: function(stream, Stream) {
                        var count = 0,
                            callback = this.callback;
                        stream.each(
                            function(item, callback) {
                                count++;
                                callback(null);
                            },
                            function(err) {
                                callback(err, count);
                            }
                        );
                    },
                    "it works": function(err, count) {
                        assert.ifError(err);
                        assert.isNumber(count);
                        assert.equal(count, 5000);
                    }
                }
            }
        },
        "and we create another stream": {
            topic: function(Stream) {
                Stream.create({name: "test-each-2"}, this.callback);
            },
            "it works": function(err, stream) {
                assert.ifError(err);
                assert.isObject(stream);
            },
            "and we iterate over the empty stream": {
                topic: function(stream, Stream) {
                    var count = 0,
                        callback = this.callback;
                    stream.each(
                        function(item, callback) {
                            count++;
                            callback(null);
                        },
                        function(err) {
                            callback(err, count);
                        }
                    );
                },
                "it works": function(err, count) {
                    assert.ifError(err);
                    assert.isNumber(count);
                    assert.equal(count, 0);
                }
            }
        },
        "and we create yet another stream": {
            topic: function(Stream) {
                Stream.create({name: "test-each-3"}, this.callback);
            },
            "it works": function(err, stream) {
                assert.ifError(err);
                assert.isObject(stream);
            },
            "and we add 5000 ids": {
                topic: function(stream, Stream) {
                    var cb = this.callback;
                    Step(
                        function() {
                            var i, group = this.group();
                            for (i = 0; i < 5000; i++) {
                                stream.deliver("http://example.net/api/object/"+i, group());
                            }
                        },
                        function(err) {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null);
                            }
                        }
                    );
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we iterate with a function that throws an exception": {
                    topic: function(stream, Stream) {
                        var theError = new Error("My test error"),
                            callback = this.callback;
                        stream.each(
                            function(item, callback) {
                                throw theError;
                            },
                            function(err) {
                                if (err == theError) {
                                    callback(null);
                                } else if (err) {
                                    callback(err);
                                } else {
                                    callback(new Error("Unexpected success"));
                                }
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    }
                }
            }
        }
    }
});

suite["export"](module);
