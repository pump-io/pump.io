// activity.js
//
// data object representing an activity
//
// Copyright 2011,2012 StatusNet Inc.
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

var databank = require('databank'),
    Step = require('step'),
    dateFormat = require('dateformat'),
    URLMaker = require('../urlmaker').URLMaker,
    IDMaker = require('../idmaker').IDMaker,
    ActivityObject = require('./activityobject').ActivityObject,
    DatabankObject = databank.DatabankObject;

var Activity = DatabankObject.subClass('activity');

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
                             'uuid',
                             'updated',
                             'verb'],
                    indices: ['actor.id', 'object.id', 'uuid'] };

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

Activity.init = function(inst, properties) {

    DatabankObject.init(inst, properties);

    if (!this.verb) {
        this.verb = "post";
    }

    if (inst.actor) {
        inst.actor = ActivityObject.toObject(inst.actor, ActivityObject.PERSON);
    }

    if (inst.object) {
        inst.object = ActivityObject.toObject(inst.object);
    }
};

Activity.prototype.apply = function(defaultActor, callback) {

    var Edge = require('./edge').Edge;

    // Ensure an actor

    this.actor = this.actor || defaultActor;

    // XXX: Polymorphism is probably the right thing here
    // but I kinda CBA. How's this: rewrite when we get over 5 case's...?

    switch (this.verb) {
    case Activity.POST:
        // Force stub author data
        this.object.author = {objectType: this.actor.objectType,
                              id: this.actor.id};
        // Is this it...?
        ActivityObject.createObject(this.object, function(err, result) {
            callback(err, result);
        });
        break;
    case Activity.FOLLOW:
        if (!this.actor.id || !this.object.id) {
            callback(new Error("No ID."));
        }
        // XXX: OStatus if necessary
        Edge.create({id: this.actor.id + '->' + this.object.id,
                     from: { id: this.actor.id, objectType: this.actor.objectType },
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

// XXX: identical to save

Activity.beforeCreate = function(props, callback) {

    var now = dateFormat(new Date(), "isoDateTime", true);

    props.updated = now;

    if (!props.published) {
        props.published = now;
    }

    if (!props.id) {
        props.uuid = IDMaker.makeID();
        props.id   = ActivityObject.makeURI('activity', props.uuid);
        props.links = {
            self: URLMaker.makeURL('api/activity/' + props.uuid)
        };
        // FIXME: assumes person data was set and that it's a local actor
        props.url  = URLMaker.makeURL(props.actor.preferredUsername + '/activity/' + props.uuid);

        // default verb

        if (!props.verb) {
            props.verb = 'post';
        }
    }

    if (!props.actor) {
        callback(new Error("Activity has no actor"), null);
    }

    if (!props.object) {
        callback(new Error("Activity has no object"), null);
    }

    var actor = null,
        object = null;

    Step (
        function() {
            ActivityObject.ensureObject(props.actor, this);
        },
        function(err, result) {
            if (err) throw err;
            actor = result;
            ActivityObject.ensureObject(props.object, this);
        },
        function(err, result) {
            if (err) {
                callback(err, null);
                return;
            }
            object = result;
            // slim them down to references
            // FIXME: probably shouldn't overwrite attributes
            props.actor = {objectType: actor.objectType,
                         id: actor.id};
            props.object = {objectType: object.objectType,
                          id: object.id};
            callback(null, props);
        }
    );
};

Activity.prototype.afterCreate = function(callback) {
    this.expand(callback);
};

Activity.prototype.afterSave = function(callback) {
    this.expand(callback);
};

Activity.prototype.beforeUpdate = function(props, callback) {

    var now = dateFormat(new Date(), "isoDateTime", true);

    props.updated = now;

    callback(null, props);
};

// When save()'ing an activity, ensure the actor and object
// are persisted, then save them by reference.

Activity.prototype.beforeSave = function(callback) {

    var now = dateFormat(new Date(), "isoDateTime", true),
        act = this;

    act.updated = now;

    if (!act.published) {
        act.published = now;
    }

    if (!act.id) {
        act.uuid = IDMaker.makeID();
        act.id   = ActivityObject.makeURI('activity', act.uuid);
        act.links = {};
        act.links.self = URLMaker.makeURL('api/activity/' + act.uuid);
        // FIXME: assumes person data was set and that it's a local actor
        act.url  = URLMaker.makeURL(act.actor.preferredUsername + '/activity/' + act.uuid);
    }

    if (!act.actor) {
        callback(new Error("Activity has no actor"));
        return;
    }

    if (!act.object) {
        callback(new Error("Activity has no object"));
        return;
    }

    var actor = null,
        object = null;

    Step (
        function() {
            ActivityObject.ensureObject(act.actor, this);
        },
        function(err, result) {
            if (err) throw err;
            actor = result;
            ActivityObject.ensureObject(act.object, this);
        },
        function(err, result) {
            if (err) {
                callback(err);
                return;
            }
            object = result;
            // slim them down to references
            // FIXME: probably shouldn't overwrite attributes
            act.actor = {objectType: actor.objectType,
                         id: actor.id};
            act.object = {objectType: object.objectType,
                          id: object.id};
            callback(null);
        }
    );
};

// When get()'ing an activity, also get the actor and the object,
// which are saved by reference

Activity.prototype.afterGet = function(callback) {
    this.expand(callback);
};

Activity.prototype.expand = function(callback) {
    var act = this;

    Step(
        function() {
            act.expandActor(this.parallel());
            act.expandObject(this.parallel());
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, act);
            }
        }
    );
};

Activity.prototype.expandObject = function(callback) {
    var act = this;

    ActivityObject.getObject(this.object.objectType, this.object.id, function(err, object) {
        if (err) {
            callback(err, null);
        } else {
            // XXX: Check for the old object!
            act.object = object;
            if (act.verb == "post") {
                delete act.object.author;
            }
            callback(null, act);
        }
    });
};

Activity.prototype.expandActor = function(callback) {
    var act = this;

    ActivityObject.getObject(this.actor.objectType, this.actor.id, function(err, actor) {
        if (err) {
            callback(err, null);
        } else {
            // XXX: Check for the old actor!
            act.actor = actor;
            callback(null, this);
        }
    });
};

exports.Activity = Activity;
