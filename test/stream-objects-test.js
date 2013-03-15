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

var assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    fs = require("fs"),
    path = require("path"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    schema = require("../lib/schema").schema,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("stream objects interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

// Test the object methods

suite.addBatch({

    "When we get the Stream class": {

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

                    stream.removeObject({a: "b"}, function(err) {
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
        },
        "and we create another stream": {
            topic: function(Stream) { 
                Stream.create({name: "object-test-2"}, this.callback);
            },
            "it works": function(err, stream) {
                assert.ifError(err);
                assert.isObject(stream);
            },
            "and we deliver an object to it": {
                topic: function(stream) {
                    var cb = this.callback,
                        obj = {
                            objectType: "person",
                            id: "acct:evan@status.net"
                        };

                    stream.deliverObject(obj, cb);
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we get the stream's objects": {
                    topic: function(stream) {
                        stream.getObjects(0, 20, this.callback);
                    },
                    "it works": function(err, objects) {
                        assert.ifError(err);
                    },
                    "results look right": function(err, objects) {
                        assert.ifError(err);
                        assert.isArray(objects);
                        assert.lengthOf(objects, 1);
                        assert.isObject(objects[0]);
                        assert.include(objects[0], "objectType");
                        assert.equal(objects[0].objectType, "person");
                        assert.include(objects[0], "id");
                        assert.equal(objects[0].id, "acct:evan@status.net");
                    }
                }
            }
        },
        "and we create a stream and deliver many objects to it": {
            topic: function(Stream) {
                var cb = this.callback,
                    stream;

                Step(
                    function() {
                        Stream.create({name: "object-test-3"}, this);
                    },
                    function(err, results) {
                        var i, group = this.group();
                        if (err) throw err;
                        stream = results;
                        for (i = 0; i < 50; i++) {
                            stream.deliverObject({id: "http://example.com/person" + i, objectType: "person"}, group());
                        }
                    },
                    function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, stream);
                        }
                    }
                );
            },
            "it works": function(err, stream) {
                assert.ifError(err);
                assert.isObject(stream);
            },
            "and we get the stream's objects": {
                topic: function(stream) {
                    stream.getObjects(0, 100, this.callback);
                },
                "it works": function(err, objects) {
                    assert.ifError(err);
                },
                "results look right": function(err, objects) {
                    var i, obj, seen = {};
                    assert.ifError(err);
                    assert.isArray(objects);
                    assert.lengthOf(objects, 50);
                    for (i = 0; i < objects.length; i++) {
                        obj = objects[i];
                        assert.isObject(obj);
                        assert.include(obj, "objectType");
                        assert.equal(obj.objectType, "person");
                        assert.include(obj, "id");
                        assert.match(obj.id, /http:\/\/example.com\/person[0-9]+/);
                        assert.isUndefined(seen[obj.id]);
                        seen[obj.id] = obj;
                    }
                },
                "and we get objects less than some object": {
                    topic: function(objects, stream) {
                        var cb = this.callback;
                        stream.getObjectsLessThan(objects[30], 20, function(err, results) {
                            cb(err, results, objects);
                        });
                    },
                    "it works": function(err, objects, total) {
                        assert.ifError(err);
                    },
                    "results look right": function(err, objects, total) {
                        var i, obj;
                        assert.ifError(err);
                        assert.isArray(objects);
                        assert.lengthOf(objects, 20);
                        for (i = 0; i < objects.length; i++) {
                            obj = objects[i];
                            assert.isObject(obj);
                            assert.include(obj, "objectType");
                            assert.equal(obj.objectType, "person");
                            assert.include(obj, "id");
                            assert.match(obj.id, /http:\/\/example.com\/person[0-9]+/);
                            assert.deepEqual(objects[i], total[i+10]);
                        }
                    }
                },
                "and we get objects greater than some object": {
                    topic: function(objects, stream) {
                        var cb = this.callback;
                        stream.getObjectsGreaterThan(objects[9], 20, function(err, results) {
                            cb(err, results, objects);
                        });
                    },
                    "it works": function(err, objects, total) {
                        assert.ifError(err);
                    },
                    "results look right": function(err, objects, total) {
                        var i, obj;
                        assert.ifError(err);
                        assert.isArray(objects);
                        assert.lengthOf(objects, 20);
                        for (i = 0; i < objects.length; i++) {
                            obj = objects[i];
                            assert.isObject(obj);
                            assert.include(obj, "objectType");
                            assert.equal(obj.objectType, "person");
                            assert.include(obj, "id");
                            assert.match(obj.id, /http:\/\/example.com\/person[0-9]+/);
                            assert.deepEqual(objects[i], total[i+10]);
                        }
                    }
                }
            }
        },
        "and we create a stream and deliver an object then remove it": {
            topic: function(Stream) {
                var cb = this.callback,
                    stream;

                Step(
                    function() {
                        Stream.create({name: "object-test-4"}, this);
                    },
                    function(err, results) {
                        var i, group = this.group();
                        if (err) throw err;
                        stream = results;
                        for (i = 0; i < 50; i++) {
                            stream.deliverObject({id: "http://example.com/person" + i, objectType: "person"}, group());
                        }
                    },
                    function(err) {
                        if (err) throw err;
                        stream.removeObject({id: "http://example.com/person23", objectType: "person"}, this);
                    },
                    function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, stream);
                        }
                    }
                );
            },
            "it works": function(err, stream) {
                assert.ifError(err);
                assert.isObject(stream);
            },
            "and we get its objects": {
                topic: function(stream) {
                    stream.getObjects(0, 100, this.callback);
                },
                "it works": function(err, objects) {
                    assert.ifError(err);
                },
                "results look right": function(err, objects) {
                    var i, obj, seen = {};
                    assert.ifError(err);
                    assert.isArray(objects);
                    assert.lengthOf(objects, 49);
                    for (i = 0; i < objects.length; i++) {
                        obj = objects[i];
                        assert.isObject(obj);
                        assert.include(obj, "objectType");
                        assert.equal(obj.objectType, "person");
                        assert.include(obj, "id");
                        assert.notEqual(obj.id, "http://example.com/person23");
                        assert.match(obj.id, /http:\/\/example.com\/person[0-9]+/);
                        assert.isUndefined(seen[obj.id]);
                        seen[obj.id] = obj;
                    }
                }
            }
        }
    }
});

suite["export"](module);