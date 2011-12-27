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

var databank = require('databank'),
    DatabankObject = databank.DatabankObject,
    NoSuchThingError = databank.NoSuchThingError,
    dateFormat = require('dateformat'),
    uuid = require('node-uuid');

var UnknownTypeError = function(type) {
    Error.captureStackTrace(this, UnknownTypeError);
    this.name = 'UnknownTypeError';
    this.type = type;
    this.message = 'Unknown type: ' + type;
};

UnknownTypeError.prototype = new Error();
UnknownTypeError.prototype.constructor = UnknownTypeError;

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

Activity.getObject = function(type, id, callback) {
    var Cls;
    if (Activity.objectTypes.indexOf(type) != -1) {
        Cls = Activity.toClass(type);
        Cls.get(id, callback);
    } else {
        callback(new UnknownTypeError(type), null);
    }
};

Activity.createObject = function(obj, callback) {
    var Cls, type = obj.objectType;
    if (Activity.objectTypes.indexOf(type) != -1) {
        Cls = Activity.toClass(type);
        Cls.create(obj, callback);
    } else {
        callback(new UnknownTypeError(type), null);
    }
};

Activity.ensureObject = function(obj, callback) {
    var Cls, type = obj.objectType, id = obj.id;
    if (Activity.objectTypes.indexOf(type) === -1) {
        callback(new UnknownTypeError(type), null);
    } else {
        Cls = Activity.toClass(type);
        Cls.get(id, function(err, result) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    Cls.create(obj, callback);
                } else {
                    callback(err, null);
                }
            } else {
                callback(null, result);
            }
        });
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
    // Crazy syntax to avoid circular require
    return require('../activitypump').ActivityPump.makeURL(type + '/' + uuid);
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
        Activity.createObject(this.object, function(err, result) {
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

// When save()'ing an activity, ensure the actor and object
// are persisted, then save them by reference.

Activity.prototype.defaultSave = Activity.prototype.save;

Activity.prototype.save = function(callback) {

    var now = dateFormat(new Date(), "isoDateTime", true),
        act = this;

    act.updated = now;

    if (!act.published) {
        act.published = now;
    }

    if (!act.id) {
        act.uuid = Activity.newId();
        act.id   = Activity.makeURI('activity', act.uuid);
    }

    if (!act.actor) {
        callback(new Error("Activity has no actor"), null);
    }

    if (!act.object) {
        callback(new Error("Activity has no object"), null);
    }
    
    Activity.ensureObject(act.actor, function(err, actor) {
        if (err) {
            callback(err);
        } else {
            Activity.ensureObject(act.object, function(err, object) {
                if (err) {
                    callback(err);
                } else {
                    // slim them down to references
		    // FIXME: probably shouldn't overwrite attributes
                    act.actor = {objectType: actor.objectType,
                                 id: actor.id};
                    act.object = {objectType: object.objectType,
                                  id: object.id};
                    act.defaultSave(callback);
                }
            });
        }
    });
};

// When get()'ing an activity, also get the actor and the object,
// which are saved by reference

Activity.defaultGet = Activity.get;

Activity.get = function(id, callback) {
    Activity.defaultGet(id, function(err, activity) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, activity);
        }
    });
};

Activity.prototype.expand = function(callback) {
    this.expandActor(function(err) {
        if (err) {
            callback(err);
        } else {
            this.expandObject(function(err) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }
    });
};

Activity.prototype.expandObject = function(callback) {
    Activity.getObject(this.actor.objectType, this.actor.id, function(err, actor) {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });
};

Activity.prototype.expandActor = function(callback) {
    Activity.getObject(this.actor.objectType, this.actor.id, function(err, actor) {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });
};

exports.Activity = Activity;
