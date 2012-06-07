// tombstone-test.js
//
// Test the tombstone module
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
    DatabankObject = databank.DatabankObject,
    NoSuchThingError = databank.NoSuchThingError;

var suite = vows.describe('tombstone interface');

var testSchema = {
    pkey: 'typeuuid',
    fields: ['objectType',
             'id',
             'uuid',
             'created',
             'updated',
             'deleted'],
    indices: ['id']
};

var testData = {
    'create': {
        objectType: 'person',
        id: 'http://example.net/api/person/QpL57jiXQt2WzMW4GKfp9A',
        uuid: 'QpL57jiXQt2WzMW4GKfp9A',
        created: '2012-06-07T12:00:00',
        updated: '2012-06-07T12:05:00'
    }
};

var mb = modelBatch('tombstone', 'Tombstone', testSchema, testData);

mb['When we require the tombstone module']
['and we get its Tombstone class export']
['and we create a tombstone instance']
['auto-generated fields are there'] = function(err, created) {
    assert.isString(created.typeuuid);
    assert.isString(created.deleted);
};

suite.addBatch(mb);

suite.addBatch({
    'When we get the Tombstone class again': {
        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get('memory', params);

            db.connect({}, function(err) {
                var mod;

                DatabankObject.bank = db;
                
                mod = require('../lib/model/tombstone').Tombstone;

                cb(null, mod);
            });
        },
        'it works': function(err, Tombstone) {
            assert.isFunction(Tombstone);
        },
        'it has the mark() method': function(err, Tombstone) {
            assert.isFunction(Tombstone.mark);
        },
        'it has the lookup() method': function(err, Tombstone) {
            assert.isFunction(Tombstone.lookup);
        },
        'and we call mark() on an ActivityObject': {
            topic: function(Tombstone) {
                var cb = this.callback,
                    Person = require('../lib/model/person').Person;

                Step(
                    function() {
                        Person.create({displayName: "Abraham Lincoln"}, this);
                    },
                    function(err, person) {
                        if (err) throw err;
                        Tombstone.mark(person, this);
                    },
                    function(err) {
                        cb(err);
                    }
                );
            },
            'it works': function(err) {
                assert.ifError(err);
            }
        },
        'and we call markFull() on an ActivityObject': {
            topic: function(Tombstone) {
                var cb = this.callback,
                    Person = require('../lib/model/person').Person;

                Step(
                    function() {
                        Person.create({displayName: "Abraham Lincoln"}, this);
                    },
                    function(err, person) {
                        if (err) throw err;
                        Tombstone.markFull(person, 'person', person.uuid, this);
                    },
                    function(err) {
                        cb(err);
                    }
                );
            },
            'it works': function(err) {
                assert.ifError(err);
            }
        },
        'and we call mark() on another kind of object': {
            topic: function(Tombstone) {
                var cb = this.callback,
                    Cls = function() {},
                    inst = new Cls();
                
                Tombstone.mark(inst, function(err) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error('Unexpected success'));
                    }
                });
            },
            'it works': function(err) {
                assert.ifError(err);
            }
        },
        'and we call mark() on null': {
            topic: function(Tombstone) {
                var cb = this.callback;
                
                Tombstone.mark(null, function(err) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error('Unexpected success'));
                    }
                });
            },
            'it works': function(err) {
                assert.ifError(err);
            }
        },
        'and we call lookup() on a valid type/uuid pair': {
            topic: function(Tombstone) {
                var cb = this.callback,
                    Person = require('../lib/model/person').Person,
                    person;

                Step(
                    function() {
                        Person.create({displayName: "John MacDonald"}, this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        person = results;
                        Tombstone.mark(person, this);
                    },
                    function(err) {
                        if (err) throw err;
                        Tombstone.lookup(Person.type, person.uuid, this);
                    },
                    function(err, ts) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(null, ts, person);
                        }
                    }
                );
            },
            'it works': function(err, ts, person) {
                assert.ifError(err);
            },
            'tombstone is correct': function(err, ts, person) {
                assert.isObject(ts);
                assert.equal(ts.objectType, person.objectType);
                assert.equal(ts.id, person.id);
                assert.equal(ts.uuid, person.uuid);
                assert.equal(ts.created, person.published);
                assert.equal(ts.updated, person.updated);
                assert.isString(ts.deleted);
                assert.match(ts.deleted, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            }
        },
        'and we call lookup() on a valid type but invalid uuid': {
            topic: function(Tombstone) {
                var cb = this.callback;
                Tombstone.lookup('person', 'NOTAUUID', function(err, ts) {
                    if (err && err instanceof NoSuchThingError) {
                        cb(null);
                    } else if (err) {
                        cb(err);
                    } else {
                        cb(new Error("Unexpected success"));
                    }
                });
            },
            'it fails correctly': function(err) {
                assert.ifError(err);
            }
        },
        'and we call lookup() on a valid uuid but mismatched type': {
            topic: function(Tombstone) {
                var cb = this.callback,
                    Person = require('../lib/model/person').Person,
                    person;

                Step(
                    function() {
                        Person.create({displayName: "Benjamin Disraeli"}, this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        person = results;
                        Tombstone.mark(person, this);
                    },
                    function(err) {
                        if (err) throw err;
                        Tombstone.lookup('audio', person.uuid, this);
                    },
                    function(err, ts) {
                        if (err && err instanceof NoSuchThingError) {
                            cb(null);
                        } else if (err) {
                            cb(err);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    }
                );
            },
            'it fails correctly': function(err) {
                assert.ifError(err);
            }
        }
    }
});

suite['export'](module);
