// activity-test.js
//
// Test the activity module
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
    URLMaker = require('../lib/urlmaker').URLMaker,
    schema = require('../lib/schema').schema,
    modelBatch = require('./lib/model').modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe('activity module interface');

var testSchema = {
    pkey: 'id', 
    fields: ['actor',
             'content',
             'generator',
             'icon',
             'id',
             'object',
             'published',
             'provider',
             'target',
             'title',
             'url',
             'uuid',
             'updated',
             'verb'],
    indices: ['actor.id', 'object.id', 'uuid']
};

var testData = {
    'create': {
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
    },
    'update': {
        mood: {
            displayName: "groovy"
        }
    }
};

var testVerbs = ['add',
                 'cancel',
                 'checkin',
                 'delete',
                 'favorite',
                 'follow',
                 'give',
                 'ignore',
                 'invite',
                 'join',
                 'leave',
                 'like',
                 'make-friend',
                 'play',
                 'post',
                 'receive',
                 'remove',
                 'remove-friend',
                 'request-friend',
                 'rsvp-maybe',
                 'rsvp-no',
                 'rsvp-yes',
                 'save',
                 'share',
                 'stop-following',
                 'tag',
                 'unfavorite',
                 'unlike',
                 'unsave',
                 'update'];

var mb = modelBatch('activity', 'Activity', testSchema, testData);

mb['When we require the activity module']
['and we get its Activity class export']
['and we create an activity instance']
['auto-generated fields are there'] = function(err, created) {
    assert.isString(created.id);
    assert.isString(created.uuid);
    assert.isString(created.published);
    assert.isString(created.updated);
};

suite.addBatch(mb);

suite.addBatch({
    'When we get the Activity class': {
        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get('memory', params);

            db.connect({}, function(err) {

                var mod;

                if (err) {
                    cb(err, null);
                    return;
                }

                DatabankObject.bank = db;
                
                mod = require('../lib/model/activity');

                if (!mod) {
                    cb(new Error("No module"), null);
                    return;
                }

                cb(null, mod.Activity);
            });
        },
        'it works': function(err, Activity) {
            assert.ifError(err);
            assert.isFunction(Activity);
        },
        'it has the right verbs': function(err, Activity) {
            var i;
            assert.isArray(Activity.verbs);
            for (i = 0; i < testVerbs.length; i++) {
                assert.includes(Activity.verbs, testVerbs[i]);
            }
            for (i = 0; i < Activity.verbs.length; i++) {
                assert.includes(testVerbs, Activity.verbs[i]);
            }
        }
    }
});

suite.export(module);
