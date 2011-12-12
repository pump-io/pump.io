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

Activity.init = function(inst, properties) {

    DatabankObject.init(inst, properties);

    if (!this.verb) {
	this.verb = "post";
    }

    if (inst.actor) {
	inst.actor = Activity.toObject(inst.actor, Activity.PERSON);
    }

    if (inst.object) {
	inst.object = Activity.toObject(inst.object);
    }
};

Activity.verbs = ['add',
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

var i = 0, verb;

// Constants-like members for activity verbs

for (i = 0; i < Activity.verbs.length; i++) {
    verb = Activity.verbs[i];
    Activity[verb.toUpperCase().replace('-', '_')] = verb;
}

Activity.objectTypes = ['article',
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
			'video'];

var objectType;

// Constants-like members for activity object types

for (i = 0; i < Activity.objectTypes.length; i++) {
    objectType = Activity.objectTypes[i];
    Activity[objectType.toUpperCase().replace('-', '_')] = objectType;
}

Activity.toClass = function(type) {
    var module, className;
    module = require('./' + type);
    className = type.substring(0,1).toUpperCase() + type.substring(1, type.length).toLowerCase();
    return module[className];
};

Activity.toObject = function(props, defaultType) {
    var Cls, type; 

    // Try rational fallbacks
    type = props.objectType || defaultType || Activity.NOTE;

    if (Activity.objectTypes.indexOf(type) != -1) {
	Cls = Activity.toClass(type);
	return new Cls(props);
    } else {
	// XXX: is this really the best we can do?
	// XXX: extension mechanism
	// XXX: 'Other' object type
	return props;
    }
};

Activity.newId = function() {
    var buf = new Buffer(16);
    uuid('binary', buf);

    var id = buf.toString('base64');

    // XXX: optimize me

    id = id.replace(/\+/g, '-');
    id = id.replace(/\//g, '_');
    id = id.replace(/=/g, '');
    return id;
};

// For now, we make HTTP URIs. Maybe someday we'll
// do something else. I like HTTP URIs, though.

Activity.makeURI = function(type, uuid) {
    require('../activitypump').ActivityPump.makeURL('/' + type + '/' + uuid);
};

Activity.prototype.apply = function(actor, callback) {
    var Edge = require('./edge').Edge;

    // XXX: Polymorphism is probably the right thing here
    // but I kinda CBA. How's this: rewrite when we get over 5 case's...?

    switch (this.verb) {
    case Activity.POST:
	// Is this it...?
	this.object.save(function(err, result) {
	    callback(err, result);
	});
	break;
    case Activity.FOLLOW:
	if (!this.actor.id || !this.object.id) {
	    callback(new Error("No ID."));
	}
	// XXX: OStatus if necessary
	Edge.create({from: { id: this.actor.id, objectType: this.actor.objectType },
		     to: {id: this.object.id, objectType: this.object.objectType }},
		    callback);
	break;
    case Activity.STOP_FOLLOWING:
	var edges = [];
	// XXX: OStatus if necessary
	Edge.search({'from.id': this.actor.id, 'to.id': this.object.id}, function(err, edges) {
	    if (err) {
		callback(err);
	    } else if (edges.length === 0) { // that's bad
		callback(new Error("No such edge."));
	    } else if (edges.length > 1) { // that's worse
		// XXX: Kill 'em all
		callback(new Error("Too many edges."));
	    } else {
		edges[0].del(callback);
	    }
	});
	break;
    default:
	// XXX: fave/unfave, join/leave, ...?
	callback(null);
	break;
    }
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
