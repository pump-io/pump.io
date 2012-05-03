// schema-test.js
//
// Test the schema module
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
    vows = require('vows');

var types = [
    'activity',
    'user',
    'client',
    'requesttoken',
    'accesstoken',
    'edge',
    'usercount',
    'userlist',
    'stream',
    'streamcount',
    'streamsegments',
    'streamsegment',
    'streamsegmentcount',
    'article',
    'audio',
    'badge',
    'bookmark',
    'collection',
    'comment',
    'event',
    'file',
    'group',
    'image',
    'note',
    'person',
    'place',
    'product',
    'question',
    'review',
    'service',
    'video'
];

vows.describe('schema module interface').addBatch({
    'When we require the schema module': {
        topic: function() { 
            return require('../lib/schema');
        },
        'we get a module': function(schemamodule) {
            assert.isObject(schemamodule);
        },
        'and we get its schema': {
            topic: function(schemamodule) {
                return schemamodule.schema;
            },
            'it exists': function(schema) {
                assert.isObject(schema);
            },
            'it has all the types we expect': function(schema) {
                var i, type;
                for (i = 0; i < types.length; i++) {
                    type = types[i];
                    assert.include(schema, type);
                }
            },
            'it has no types we do not expect': function(schema) {
                var prop;
                for (prop in schema) {
                    if (schema.hasOwnProperty(prop)) {
                        assert.include(types, prop);
                    }
                }
            },
            'all its types are objects': function(schema) {
                var prop;
                for (prop in schema) {
                    if (schema.hasOwnProperty(prop)) {
                        assert.isObject(schema[prop]);
                    }
                }
            },
            'all its types have pkeys': function(schema) {
                var prop;
                for (prop in schema) {
                    if (schema.hasOwnProperty(prop)) {
                        assert.include(schema[prop], 'pkey');
                        assert.isString(schema[prop].pkey);
                    }
                }
            }
        }
    }
}).export(module);

