// model.js
//
// Test utility for databankobject model modules
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
    _ = require("underscore"),
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    fs = require("fs"),
    path = require("path"),
    URLMaker = require("../../lib/urlmaker").URLMaker,
    schema = require("../../lib/schema").schema,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var tc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "config.json")));

var modelBatch = function(typeName, className, testSchema, testData) {

    var batch = {};
    var typeKey = "When we require the "+typeName+" module";
    var classKey = "and we get its "+className+" class export";
    var instKey;

    if ("aeiouAEIOU".indexOf(typeName.charAt(0)) !== -1) {
        instKey = "and we create an "+typeName+" instance";
    } else {
        instKey = "and we create a "+typeName+" instance";
    }

    batch[typeKey] = {
        topic: function() {

            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {
                var mod;

                DatabankObject.bank = db;

                mod = require("../../lib/model/"+typeName) || null;

                cb(null, mod);
            });
        },
        "there is one": function(err, mod) {
            assert.isObject(mod);
        },
        "it has a class export": function(err, mod) {
            assert.includes(mod, className);
        }
    };

    batch[typeKey][classKey] = {
        topic: function(mod) {
            return mod[className] || null;
        },
        "it is a function": function(Cls) {
            assert.isFunction(Cls);
        },
        "it has an init method": function(Cls) {
            assert.isFunction(Cls.init);
        },
        "it has a bank method": function(Cls) {
            assert.isFunction(Cls.bank);
        },
        "it has a get method": function(Cls) {
            assert.isFunction(Cls.get);
        },
        "it has a search method": function(Cls) {
            assert.isFunction(Cls.search);
        },
        "it has a pkey method": function(Cls) {
            assert.isFunction(Cls.pkey);
        },
        "it has a create method": function(Cls) {
            assert.isFunction(Cls.create);
        },
        "it has a readAll method": function(Cls) {
            assert.isFunction(Cls.readAll);
        },
        "its type is correct": function(Cls) {
            assert.isString(Cls.type);
            assert.equal(Cls.type, typeName);
        },
        "and we get its schema": {
            topic: function(Cls) {
                return Cls.schema || null;
            },
            "it exists": function(schema) {
                assert.isObject(schema);
            },
            "it has the right pkey": function(schema) {
                assert.includes(schema, "pkey");
                assert.equal(schema.pkey, testSchema.pkey);
            },
            "it has the right fields": function(schema) {
                var fields = testSchema.fields,
                    i, field;

                if (fields) {
                    assert.includes(schema, "fields");
                    for (i = 0; i < fields.length; i++) {
                        assert.includes(schema.fields, fields[i]);
                    }
                    for (i = 0; i < schema.fields.length; i++) {
                        assert.includes(fields, schema.fields[i]);
                    }
                }
            },
            "it has the right indices": function(schema) {
                var indices = testSchema.indices,
                    i, field;

                if (indices) {
                    assert.includes(schema, "indices");
                    for (i = 0; i < indices.length; i++) {
                        assert.includes(schema.indices, indices[i]);
                    }
                    for (i = 0; i < schema.indices.length; i++) {
                        assert.includes(indices, schema.indices[i]);
                    }
                }
            }
        }
    };

    batch[typeKey][classKey][instKey] = {
        topic: function(Cls) {
            Cls.create(testData.create, this.callback);
        },
        "it works correctly": function(err, created) {
            assert.ifError(err);
            assert.isObject(created);
        },
        "auto-generated fields are there": function(err, created) {
            assert.isString(created.objectType);
            assert.equal(created.objectType, typeName);
            assert.isString(created.id);
            assert.isString(created.published);
            assert.isString(created.updated); // required for new object?
        },
        "passed-in fields are there": function(err, created) {
            var prop, aprop;
            for (prop in testData.create) {
                // Author may have auto-created properties
                if (_.contains(["author", "inReplyTo"], prop)) {
                    _.each(testData.create[prop], function(value, key) {
                        assert.deepEqual(created[prop][key], value);
                    });
                } else {
                    assert.deepEqual(created[prop], testData.create[prop]);
                }
            }
        },
        "and we modify it": {
            topic: function(created) {
                var callback = this.callback;
                created.update(testData.update, callback);
            },
            "it is modified": function(err, updated) {
                assert.ifError(err);
                assert.isString(updated.updated);
            },
            "modified fields are modified": function(err, updated) {
                var prop;
                for (prop in testData.update) {
                    assert.deepEqual(updated[prop], testData.update[prop]);
                }
            },
            "and we delete it": {
                topic: function(updated) {
                    updated.del(this.callback);
                },
                "it works": function(err, updated) {
                    assert.ifError(err);
                }
            }
        }
    };

    return batch;
};

exports.modelBatch = modelBatch;
