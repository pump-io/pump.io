// activity.js
//
// data object representing an activity
//
// Copyright 2011, StatusNet Inc.
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

var DatabankObject = require('databank').DatabankObject,
    dateFormat = require('dateformat'),
    uuid    = require('node-uuid');

var Activity = DatabankObject.subClass('activity');

var verbs = ['add',
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
	     'update'], i = 0, verb;

// Constants-like members for activity

for (i = 0; i < verbs.length; i++) {
    verb = verbs[i];
    Activity[verb.toUpperCase().replace('-', '_')] = verb;
}

Activity.newId = function ()
{
    var buf = new Buffer(16);
    uuid('binary', buf);

    var id = buf.toString('base64');

    // XXX: optimize me

    id = id.replace(/\+/g, '-');
    id = id.replace(/\//g, '_');
    id = id.replace(/=/g, '');
    return id;
};

Activity.schema = { pkey: 'id', 
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
			     'updated',
			     'verb'],
		    indices: ['actor.id', 'object.id'] };

exports.Activity = Activity;
