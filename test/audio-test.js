// audio-test.js
//
// Test the audio module
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
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

// Need this to make IDs

URLMaker.hostname = "example.net";

// Dummy databank

DatabankObject.bank = Databank.get('memory', {});

vows.describe('audio module interface').addBatch({
    'When we require the audio module': {
        topic: function() { 
            return require('../lib/model/audio');
        },
        'there is one': function(audio) {
            assert.isObject(audio);
        },
        'it has an Audio export': function(audio) {
            assert.includes(audio, 'Audio');
        },
        'and we get its Audio export': {
            topic: function(audio) {
                return audio.Audio;
            },
            'it is a function': function(Audio) {
                assert.isFunction(Audio);
            },
            'it has an init method': function(Audio) {
                assert.includes(Audio, 'init');
                assert.isFunction(Audio.init);
            },
            'it has a bank method': function(Audio) {
                assert.includes(Audio, 'bank');
                assert.isFunction(Audio.bank);
            },
            'it has a get method': function(Audio) {
                assert.includes(Audio, 'get');
                assert.isFunction(Audio.get);
            },
            'it has a search method': function(Audio) {
                assert.includes(Audio, 'search');
                assert.isFunction(Audio.search);
            },
            'it has a pkey method': function(Audio) {
                assert.includes(Audio, 'pkey');
                assert.isFunction(Audio.pkey);
            },
            'it has a create method': function(Audio) {
                assert.includes(Audio, 'create');
                assert.isFunction(Audio.create);
            },
            'it has a readAll method': function(Audio) {
                assert.includes(Audio, 'readAll');
                assert.isFunction(Audio.readAll);
            },
            'its type is "audio"': function(Audio) {
                assert.includes(Audio, 'type');
                assert.isString(Audio.type);
                assert.equal(Audio.type, 'audio');
            },
            'it has a schema property': function(Audio) {
                assert.includes(Audio, 'schema');
            },
            'and we get its schema': {
                topic: function(Audio) {
                    return Audio.schema;
                },
                'it exists': function(schema) {
                    assert.isObject(schema);
                },
                'it has the right pkey': function(schema) {
                    assert.includes(schema, 'pkey');
                    assert.equal(schema.pkey, 'id');
                },
                'it has the right fields': function(schema) {
                    var fields = ['author',
                                  'displayName',
                                  'embedCode',
                                  'published',
                                  'stream',
                                  'summary',
                                  'updated'
                                 ],
                        i, field;
                    assert.includes(schema, 'fields');
                    for (i = 0; i < fields.length; i++) {
                        assert.includes(schema.fields, fields[i]);
                    }
                    for (i = 0; i < schema.fields.length; i++) {
                        assert.includes(fields, schema.fields[i]);
                    }
                }
            },
            'and we create an instance': {
                topic: function(Audio) {
                    var props = {
                        displayName: "Shake Your Rump",
                        url: "http://example.com/beastie-boys/pauls-boutique/2",
                        stream: {
                            url: "http://example.com/beastie-boys/pauls-boutique/shake-your-rump.ogg",
                            duration: 388
                        }
                    };
                    Audio.create(props, this.callback);
                },
                'it works correctly': function(err, syr) {
                    assert.ifError(err);
                    assert.isObject(syr);
                    assert.isString(syr.id);
                    assert.equal(syr.displayName, "Shake Your Rump");
                    assert.equal(syr.url, "http://example.com/beastie-boys/pauls-boutique/2");
                    assert.isObject(syr.stream);
                    assert.equal(syr.stream.url, 
                                 "http://example.com/beastie-boys/pauls-boutique/shake-your-rump.ogg");
                    assert.equal(syr.stream.duration, 388);
                    assert.isString(syr.published);
                    assert.isString(syr.updated); // required for new object?
                },
                'it has the update method': function(err, syr) {
                    assert.isFunction(syr.update);
                },
                'it has the del method': function(err, syr) {
                    assert.isFunction(syr.del);
                },
                'it has the save method': function(err, syr) {
                    assert.isFunction(syr.save);
                },
                'and we modify it': {
                    topic: function(syr) {
                        syr.displayName = "Shake Your Rump (Extended Mix)";
                        syr.save(this.callback);
                    },
                    'it is modified': function(err, syrx) {
                        assert.ifError(err);
                        assert.equal(syrx.displayName, "Shake Your Rump (Extended Mix)");
                        assert.isString(syrx.updated);
                    },
                    'and we delete it': {
                        topic: function(syrx) {
                            syrx.del(this.callback);
                        },
                        'it works': function(err, syrx) {
                            assert.ifError(err);
                        }
                    }
                }
            }
        }
    }
}).export(module);

