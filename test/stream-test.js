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
    modelBatch = require("./lib/model").modelBatch,
    schema = require("../lib/schema").schema,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var suite = vows.describe("stream interface");

// XXX: check other types

var testSchema = {
    pkey: "name"
};

var testData = {
    create: {
        name: "evan-inbox"
    },
    update: {
        something: "value" // Not clear what we update here
    }
};

// XXX: hack hack hack
// modelBatch hard-codes ActivityObject-style

var mb = modelBatch("stream", "Stream", testSchema, testData);

// This class has a weird schema format

mb["When we require the stream module"]
["and we get its Stream class export"]
["and we get its schema"]
["topic"] = function(Stream) {
    return Stream.schema.stream || null;
};

mb["When we require the stream module"]
["and we get its Stream class export"]
["and we create a stream instance"]
["auto-generated fields are there"] = function(err, created) {
    // No auto-gen fields, so...
    assert.isTrue(true);
};

mb["When we require the stream module"]
["and we get its Stream class export"]
["and we create a stream instance"]
["and we modify it"]
["it is modified"] = function(err, updated) {
    assert.ifError(err);
};

suite.addBatch(mb);

var act1 = null;

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

                Stream.create({name: "test"}, cb);
            });
        },
        "it works": function(err, stream) {
            assert.ifError(err);
            assert.isObject(stream);
        },
        "it has a deliver() method": function(err, stream) {
            assert.isFunction(stream.deliver);
        },
        "it has a remove() method": function(err, stream) {
            assert.isFunction(stream.remove);
        },
        "it has a getIDs() method": function(err, stream) {
            assert.isFunction(stream.getIDs);
        },
        "it has a getIDsGreaterThan() method": function(err, stream) {
            assert.isFunction(stream.getIDsGreaterThan);
        },
        "it has a getIDsLessThan() method": function(err, stream) {
            assert.isFunction(stream.getIDsLessThan);
        },
        "it has a count() method": function(err, stream) {
            assert.isFunction(stream.count);
        },
        "and we create a single activity": {
            topic: function(stream) {
                var Activity = require("../lib/model/activity").Activity,
                    props = {
                        actor: {
                            id: "urn:uuid:8f64087d-fffc-4fe0-9848-c18ae611cafd",
                            displayName: "Delbert Fnorgledap",
                            objectType: "person"
                        },
                        verb: "post",
                        object: {
                            objectType: "note",
                            content: "Feeling groovy."
                        }
                    };


                Activity.create(props, this.callback);
            },
            "it works": function(err, activity) {
                assert.ifError(err);
                assert.isObject(activity);
            },
            "and we deliver it to the stream": {
                topic: function(activity, stream) {
                    act1 = activity;
                    stream.deliver(activity.id, this.callback);
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we get the stream's activities": {
                    topic: function(activity, stream) {
                        stream.getIDs(0, 100, this.callback);
                    },
                    "it works": function(err, activities) {
                        assert.ifError(err);
                        assert.isArray(activities);
                        assert.isTrue(activities.length > 0);
                    },
                    "our activity is in there": function(err, activities) {
                        assert.isTrue(activities.some(function(item) {
                            return item === act1.id;
                        }));
                    }
                },
                "and we count the stream's activities": {
                    topic: function(activity, stream) {
                        stream.count(this.callback);
                    },
                    "it works": function(err, cnt) {
                        assert.ifError(err);
                    },
                    "it has the right value (1)": function(err, cnt) {
                        assert.equal(cnt, 1);
                    }
                },
                "and we count the stream's activities with Stream.count()": {
                    topic: function(activity, stream) {
                        var Stream = require("../lib/model/stream").Stream;
                        Stream.count(stream.name, this.callback);
                    },
                    "it works": function(err, cnt) {
                        assert.ifError(err);
                    },
                    "it has the right value (1)": function(err, cnt) {
                        assert.equal(cnt, 1);
                    }
                }
            }
        }
    }
});

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
                Stream.create({name: "test-remove-1"}, this.callback);
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
                                stream.deliver("tag:pump.io,2012:stream-test:object:"+i, group());
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
                "and we remove one": {
                    topic: function(stream, Stream) {
                        stream.remove("tag:pump.io,2012:stream-test:object:2500", this.callback);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we get all the IDs": {
                        topic: function(stream, Stream) {
                            stream.getIDs(0, 5000, this.callback);
                        },
                        "it works": function(err, ids) {
                            assert.ifError(err);
                            assert.isArray(ids);
                        },
                        "it is the right size": function(err, ids) {
                            assert.equal(ids.length, 4999); // 5000 - 1
                        },
                        "removed ID is missing": function(err, ids) {
                            assert.equal(ids.indexOf("tag:pump.io,2012:stream-test:object:2500"), -1);
                        }
                    },
                    "and we get the count": {
                        topic: function(stream, Stream) {
                            stream.count(this.callback);
                        },
                        "it works": function(err, count) {
                            assert.ifError(err);
                            assert.isNumber(count);
                        },
                        "it is the right size": function(err, count) {
                            assert.equal(count, 4999); // 5000 - 1
                        }
                    }
                }
            }
        },
        "and we try to remove() from an empty stream": {
            topic: function(Stream) {
                var cb = this.callback;
                
                Stream.create({name: "test-remove-2"}, function(err, stream) {
                    if (err) {
                        cb(err);
                    } else {
                        stream.remove("tag:pump.io,2012:stream-test:object:6000", function(err) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we remove a not-present object from a non-empty stream": {
            topic: function(Stream) {
                var cb = this.callback,
                    stream;

                Step(
                    function() {
                        Stream.create({name: "test-remove-3"}, this);
                    }, 
                    function(err, results) {
                        var i, group = this.group();
                        if (err) throw err;
                        stream = results;
                        for (i = 0; i < 5000; i++) {
                            stream.deliver("tag:pump.io,2012:stream-test:object:"+i, group());
                        }
                    },
                    function(err) {
                        if (err) {
                            cb(err);
                        } else {
                            // 6666 > 5000
                            stream.remove("tag:pump.io,2012:stream-test:object:6666", function(err) {
                                if (err) {
                                    cb(null);
                                } else {
                                    cb(new Error("Unexpected success"));
                                }
                            });
                        }
                    }
                );
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        }
    }
});

suite.addBatch({
    "When we deliver a lot of activities to a stream": {
        topic: function() {
            var cb = this.callback,
                Activity = require("../lib/model/activity").Activity,
                actor = {
                    id: "urn:uuid:c484d84e-6afa-4c51-ac9a-f8738d48569c",
                    displayName: "Counter",
                    objectType: "service"
                };

            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            var stream = null;

            Step(
                function() {
                    db.connect({}, this);
                },
                function(err) {
                    if (err) throw err;

                    DatabankObject.bank = db;
                    
                    var Stream = require("../lib/model/stream").Stream;

                    Stream.create({name: "scale-test"}, this);
                },
                function(err, results) {
                    var i, act, group = this.group();
                    if (err) throw err;
                    stream = results;
                    var addNew = function(act, callback) {
                        Activity.create(act, function(err, results) {
                            if (err) {
                                callback(err, null);
                            } else {
                                stream.deliver(results.id, function(err) {
                                    if (err) {
                                        callback(err, null);
                                    } else {
                                        callback(err, results);
                                    }
                                });
                            }
                        });
                    };
                    for (i = 0; i < 10000; i++) {
                        act = {actor: actor,
                               verb: "post",
                               object: {
                                   objectType: "note",
                                   content: "Note #" + i
                               }
                              };
                        addNew(act, group());
                    }
                },
                function(err, activities) {
                    if (err) {
                        cb(err, null);
                    } else {
                        cb(err, stream);
                    }
                }
            );
        },
        "it works": function(err, stream) {
            assert.ifError(err);
            assert.isObject(stream);
        },
        "and we count the number of elements": {
            topic: function(stream) {
                stream.count(this.callback);
            },
            "it works": function(err, cnt) {
                assert.ifError(err);
            },
            "it gives the right value (10000)": function(err, cnt) {
                assert.equal(cnt, 10000);
            }
        },
        "and we get all the activities in little chunks": {
            topic: function(stream) {
                var cb = this.callback;
                Step(
                    function() {
                        var i, group = this.group();
                        for (i = 0; i < 500; i++) { 
                            stream.getIDs(i * 20, (i+1)*20, group());
                        }
                    },
                    function(err, chunks) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, chunks);
                        }
                    }
                );
            },
            "it works": function(err, chunks) {
                assert.ifError(err);
            },
            "results have right size": function(err, chunks) {
                var i;
                assert.lengthOf(chunks, 500);
                for (i = 0; i < 500; i++) {
                    assert.lengthOf(chunks[i], 20);
                }
            },
            "there are no duplicates": function(err, chunks) {
                var i, j, seen = {};
                for (i = 0; i < chunks.length; i++) {
                    for (j = 0; j < chunks[i].length; j++) {
                        assert.isUndefined(seen[chunks[i][j]]);
                        seen[chunks[i][j]] = true;
                    }
                }
            }
        },
        "and we get all the activities in big chunks": {
            topic: function(stream) {
                var cb = this.callback;
                Step(
                    function() {
                        var i, group = this.group();
                        for (i = 0; i < 20; i++) { 
                            stream.getIDs(i * 500, (i+1)*500, group());
                        }
                    },
                    function(err, chunks) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, chunks);
                        }
                    }
                );
            },
            "it works": function(err, chunks) {
                assert.ifError(err);
            },
            "results have right size": function(err, chunks) {
                var i;
                assert.lengthOf(chunks, 20);
                for (i = 0; i < 20; i++) {
                    assert.lengthOf(chunks[i], 500);
                }
            },
            "there are no duplicates": function(err, chunks) {
                var i, j, seen = {};
                for (i = 0; i < chunks.length; i++) {
                    for (j = 0; j < chunks[i].length; j++) {
                        assert.isUndefined(seen[chunks[i][j]]);
                        seen[chunks[i][j]] = true;
                    }
                }
            }
        },
        "and we get all the activities one at a time": {
            topic: function(stream) {
                var cb = this.callback;
                Step(
                    function() {
                        var i, group = this.group();
                        for (i = 0; i < 10000; i++) { 
                            stream.getIDs(i, i+1, group());
                        }
                    },
                    function(err, chunks) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, chunks);
                        }
                    }
                );
            },
            "it works": function(err, chunks) {
                assert.ifError(err);
            },
            "results have right size": function(err, chunks) {
                var i;
                assert.lengthOf(chunks, 10000);
                for (i = 0; i < 10000; i++) {
                    assert.lengthOf(chunks[i], 1);
                }
            },
            "there are no duplicates": function(err, chunks) {
                var i, j, seen = {};
                for (i = 0; i < chunks.length; i++) {
                    for (j = 0; j < chunks[i].length; j++) {
                        assert.isUndefined(seen[chunks[i][j]]);
                        seen[chunks[i][j]] = true;
                    }
                }
            }
        },
        "and we get all the activities at once": {
            topic: function(stream) {
                var cb = this.callback;
                stream.getIDs(0, 10000, cb);
            },
            "it works": function(err, chunk) {
                assert.ifError(err);
            },
            "results have right size": function(err, chunk) {
                assert.lengthOf(chunk, 10000);
            },
            "there are no duplicates": function(err, chunk) {
                var i, seen = {};
                for (i = 0; i < chunk.length; i++) {
                    assert.isUndefined(seen[chunk[i]]);
                    seen[chunk[i]] = true;
                }
            },
            "and we get IDs greater than some ID": {
                topic: function(all, stream) {
                    var cb = this.callback,
                        target = all[4216];
                    
                    stream.getIDsGreaterThan(target, 20, function(err, results) {
                        cb(err, results, all);
                    });
                },
                "it works": function(err, ids, all) {
                    assert.ifError(err);
                    assert.isArray(ids);
                    assert.isArray(all);
                },
                "it is the right size": function(err, ids, all) {
                    assert.lengthOf(ids, 20);
                },
                "it has the right values": function(err, ids, all) {
                    assert.deepEqual(ids, all.slice(4217, 4237));
                }
            },
            "and we get IDs less than some ID": {
                topic: function(all, stream) {
                    var cb = this.callback,
                        target = all[8423];
                    
                    stream.getIDsLessThan(target, 20, function(err, results) {
                        cb(err, results, all);
                    });
                },
                "it works": function(err, ids, all) {
                    assert.ifError(err);
                    assert.isArray(ids);
                    assert.isArray(all);
                },
                "it is the right size": function(err, ids, all) {
                    assert.lengthOf(ids, 20);
                },
                "it has the right values": function(err, ids, all) {
                    assert.deepEqual(ids, all.slice(8403, 8423));
                }
            },
            "and we get the indices of items in the stream": {
                topic: function(all, stream) {
                    var cb = this.callback;

                    Step(
                        function() {
                            var i, group = this.group();
                            for (i = 0; i < all.length; i++) {
                                stream.indexOf(all[i], group());
                            }
                        },
                        cb
                    );
                },
                "it works": function(err, indices) {
                    assert.ifError(err);
                },
                "they have the right values": function(err, indices) {
                    var i;
                    assert.ifError(err);
                    assert.isArray(indices);
                    assert.lengthOf(indices, 10000);
                    for (i = 0; i < indices.length; i++) {
                        assert.equal(indices[i], i);
                    }
                }
            },
            "and we get too many IDs greater than some ID at the end": {
                topic: function(all, stream) {
                    var cb = this.callback,
                        target = all[9979];
                    
                    stream.getIDsGreaterThan(target, 40, function(err, results) {
                        cb(err, results, all);
                    });
                },
                "it works": function(err, ids, all) {
                    assert.ifError(err);
                    assert.isArray(ids);
                    assert.isArray(all);
                },
                "it is the right size": function(err, ids, all) {
                    assert.lengthOf(ids, 20);
                },
                "it has the right values": function(err, ids, all) {
                    assert.deepEqual(ids, all.slice(9980, 10000));
                }
            },
            "and we too many get IDs less than some ID toward the beginning": {
                topic: function(all, stream) {
                    var cb = this.callback,
                        target = all[40];
                    
                    stream.getIDsLessThan(target, 60, function(err, results) {
                        cb(err, results, all);
                    });
                },
                "it works": function(err, ids, all) {
                    assert.ifError(err);
                    assert.isArray(ids);
                    assert.isArray(all);
                },
                "it is the right size": function(err, ids, all) {
                    assert.lengthOf(ids, 40);
                },
                "it has the right values": function(err, ids, all) {
                    assert.deepEqual(ids, all.slice(0, 40));
                }
            },
            "and we get a negative number of IDs less than an ID": {
                topic: function(all, stream) {
                    var cb = this.callback;
                    stream.getIDsLessThan(all[100], -50, function(err, ids) {
                        if (err) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we get zero IDs less than an ID": {
                topic: function(all, stream) {
                    var cb = this.callback;
                    stream.getIDsLessThan(all[100], 0, cb);
                },
                "it works": function(err, ids) {
                    assert.ifError(err);
                    assert.isArray(ids);
                },
                "it returns the right value": function(err, ids) {
                    assert.lengthOf(ids, 0);
                }
            },
            "and we get a negative number of IDs greater than an ID": {
                topic: function(all, stream) {
                    var cb = this.callback;
                    stream.getIDsGreaterThan(all[100], -50, function(err, ids) {
                        if (err) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we get zero IDs greater than an ID": {
                topic: function(all, stream) {
                    var cb = this.callback;
                    stream.getIDsGreaterThan(all[100], 0, cb);
                },
                "it works": function(err, ids) {
                    assert.ifError(err);
                    assert.isArray(ids);
                },
                "it returns the right value": function(err, ids) {
                    assert.lengthOf(ids, 0);
                }
            }
        },
        "and we try to get activities starting at a negative number": {
            topic: function(stream) {
                var cb = this.callback;
                stream.getIDs(-10, 20, function(err, activities) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to get activities ending at a negative number": {
            topic: function(stream) {
                var cb = this.callback;
                stream.getIDs(10, -20, function(err, activities) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to get activities with start after the end": {
            topic: function(stream) {
                var cb = this.callback;
                stream.getIDs(110, 100, function(err, activities) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to get activities start and end equal": {
            topic: function(stream) {
                var cb = this.callback;
                stream.getIDs(50, 50, cb);
            },
            "it works": function(err, results) {
                assert.ifError(err);
            },
            "results are empty": function(err, results) {
                assert.isEmpty(results);
            }
        },
        "and we get IDs greater than an ID not in the stream": {
            topic: function(stream) {
                var cb = this.callback;
                stream.getIDsGreaterThan("tag:pump.io,2012:nonexistent", 20, function(err, ids) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we get IDs less than an ID not in the stream": {
            topic: function(stream) {
                var cb = this.callback;
                stream.getIDsLessThan("tag:pump.io,2012:nonexistent", 20, function(err, ids) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we get zero IDs greater than an ID not in the stream": {
            topic: function(stream) {
                var cb = this.callback;
                stream.getIDsGreaterThan("tag:pump.io,2012:nonexistent", 0, function(err, ids) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we get zero IDs less than an ID not in the stream": {
            topic: function(stream) {
                var cb = this.callback;
                stream.getIDsLessThan("tag:pump.io,2012:nonexistent", 0, function(err, ids) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        }
    }
});

suite["export"](module);
