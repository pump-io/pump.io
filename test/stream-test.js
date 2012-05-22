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

var assert = require('assert'),
    vows = require('vows'),
    databank = require('databank'),
    Step = require('step'),
    URLMaker = require('../lib/urlmaker').URLMaker,
    modelBatch = require('./lib/model').modelBatch,
    schema = require('../lib/schema').schema,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe('stream interface');

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

var mb = modelBatch('stream', 'Stream', testSchema, testData);

// This class has a weird schema format

mb['When we require the stream module']
['and we get its Stream class export']
['and we get its schema']
['topic'] = function(Stream) {
    return Stream.schema.stream || null;
};

mb['When we require the stream module']
['and we get its Stream class export']
['and we create a stream instance']
['auto-generated fields are there'] = function(err, created) {
    // No auto-gen fields, so...
    assert.isTrue(true);
};

mb['When we require the stream module']
['and we get its Stream class export']
['and we create a stream instance']
['and we modify it']
['it is modified'] = function(err, updated) {
    assert.ifError(err);
};

suite.addBatch(mb);

var act1 = null;

suite.addBatch({
    'When we create a new stream': {
        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get('memory', params);

            db.connect({}, function(err) {

                var Stream, mod;

                if (err) {
                    cb(err, null);
                    return;
                }

                DatabankObject.bank = db;
                
                mod = require('../lib/model/stream');

                if (!mod) {
                    cb(new Error("No module"), null);
                    return;
                }

                Stream = mod.Stream;

                if (!Stream) {
                    cb(new Error("No class"), null);
                    return;
                }

                Stream.create({name: 'test'}, cb);
            });
        },
        'it works': function(err, stream) {
            assert.ifError(err);
            assert.isObject(stream);
        },
        'it has a deliver() method': function(err, stream) {
            assert.isFunction(stream.deliver);
        },
        'it has a getActivities() method': function(err, stream) {
            assert.isFunction(stream.getActivities);
        },
        'it has a count() method': function(err, stream) {
            assert.isFunction(stream.count);
        },
        'and we create a single activity': {
            topic: function(stream) {
                var Activity = require('../lib/model/activity').Activity,
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
            'it works': function(err, activity) {
                assert.ifError(err);
                assert.isObject(activity);
            },
            'and we deliver it to the stream': {
                topic: function(activity, stream) {
                    act1 = activity;
                    stream.deliver(activity, this.callback);
                },
                'it works': function(err) {
                    assert.ifError(err);
                },
                "and we get the stream's activities": {
                    topic: function(activity, stream) {
                        stream.getActivities(0, 100, this.callback);
                    },
                    'it works': function(err, activities) {
                        assert.ifError(err);
                        assert.isArray(activities);
                        assert.isTrue(activities.length > 0);
                    },
                    'our activity is in there': function(err, activities) {
                        assert.isTrue(activities.some(function(item) {
                            return item.id == act1.id;
                        }));
                    }
                },
                "and we count the stream's activities": {
                    topic: function(activity, stream) {
                        stream.count(this.callback);
                    },
                    'it works': function(err, cnt) {
                        assert.ifError(err);
                    },
                    'it has the right value (1)': function(err, cnt) {
                        assert.equal(cnt, 1);
                    }
                }
            }
        }
    }
});

suite.addBatch({
    'When we deliver a lot of activities to a stream': {
        topic: function() {
            var cb = this.callback,
                Activity = require('../lib/model/activity').Activity,
                actor = {
                    id: "urn:uuid:c484d84e-6afa-4c51-ac9a-f8738d48569c",
                    displayName: "Counter",
                    objectType: "service"
                };

            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get('memory', params);

            var stream = null;

            Step(
                function() {
                    db.connect({}, this);
                },
                function(err) {
                    if (err) throw err;

                    DatabankObject.bank = db;
                
                    var Stream = require('../lib/model/stream').Stream;

                    Stream.create({name: 'scale-test'}, this);
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
                                stream.deliver(results, function(err) {
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
        'it works': function(err, stream) {
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
        }
    }
});

suite.export(module);