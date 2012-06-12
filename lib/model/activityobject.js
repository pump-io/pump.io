// activityobject.js
//
// utility superclass for activity stuff
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

var databank = require('databank'),
    _ = require('underscore'),
    Step = require('step'),
    NoSuchThingError = databank.NoSuchThingError,
    AlreadyExistsError = databank.AlreadyExistsError,
    DatabankObject = databank.DatabankObject,
    uuid = require('node-uuid'),
    URLMaker = require('../urlmaker').URLMaker,
    IDMaker = require('../idmaker').IDMaker,
    Stamper = require('../stamper').Stamper,
    Stream = require('./stream').Stream;

var UnknownTypeError = function(type) {
    Error.captureStackTrace(this, UnknownTypeError);
    this.name = 'UnknownTypeError';
    this.type = type;
    this.message = 'Unknown type: ' + type;
};

UnknownTypeError.prototype = new Error();
UnknownTypeError.prototype.constructor = UnknownTypeError;

var ActivityObject = function(properties) {
    ActivityObject.init(this, properties);
};

ActivityObject.init = DatabankObject.init;

ActivityObject.prototype = new DatabankObject({});

ActivityObject.beforeCreate = function(props, callback) {

    // XXX: I hope this works

    props.objectType = this.type;

    var now = Stamper.stamp();

    props.published = props.updated = now;

    if (!_(props).has('id')) {
        props.uuid = IDMaker.makeID();
        props.id   = ActivityObject.makeURI(this.type, props.uuid);
    }

    // Save the author by reference; don't save the whole thing

    ActivityObject.compressProperty(props, 'author', function(err) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, props);
        }
    });
};

ActivityObject.prototype.afterUpdate = 
ActivityObject.prototype.afterSave = 
ActivityObject.prototype.afterCreate = 
ActivityObject.prototype.afterGet = function(callback) {
    this.expand(callback);
};

ActivityObject.prototype.expand = function(callback) {
    ActivityObject.expandProperty(this, 'author', callback);
};

ActivityObject.prototype.beforeSave = function(callback) {

    var obj = this, 
        now = Stamper.stamp();

    this.updated = now;

    // Save the author by reference; don't save the whole thing

    ActivityObject.compressProperty(obj, 'author', function(err) {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });
};

ActivityObject.prototype.beforeUpdate = function(props, callback) {

    var immutable = ['id', 'objectType', 'uuid', 'published'],
        i, prop;

    for (i = 0; i < immutable.length; i++) {
        prop = immutable[i];
        if (props.hasOwnProperty(prop)) {
            delete props[prop];
        }
    }

    var now = Stamper.stamp();

    props.updated = now;

    // Save the author by reference; don't save the whole thing

    // Save the author by reference; don't save the whole thing

    ActivityObject.compressProperty(props, 'author', function(err) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, props);
        }
    });
};

// For now, we make HTTP URIs. Maybe someday we'll
// do something else. I like HTTP URIs, though.

ActivityObject.makeURI = function(type, uuid) {
    return URLMaker.makeURL('api/' + type + '/' + uuid);
};

ActivityObject.toClass = function(type) {
    var module, className;

    if (!type ||
        ActivityObject.objectTypes.indexOf(type.toLowerCase()) == -1) {
        return null;
    }
        
    module = require('./' + type);
    className = type.substring(0,1).toUpperCase() + type.substring(1, type.length).toLowerCase();
    return module[className];
};

ActivityObject.toObject = function(props, defaultType) {
    var Cls, type; 

    // Try rational fallbacks
    type = props.objectType || defaultType || ActivityObject.NOTE;

    if (ActivityObject.objectTypes.indexOf(type) != -1) {
        Cls = ActivityObject.toClass(type);
        return new Cls(props);
    } else {
        // XXX: is this really the best we can do?
        // XXX: extension mechanism
        // XXX: 'Other' object type
        return props;
    }
};

ActivityObject.getObject = function(type, id, callback) {
    var Cls;
    if (ActivityObject.objectTypes.indexOf(type) != -1) {
        Cls = ActivityObject.toClass(type);
        Cls.get(id, callback);
    } else {
        callback(new UnknownTypeError(type), null);
    }
};

ActivityObject.createObject = function(obj, callback) {
    var Cls, type = obj.objectType;
    if (ActivityObject.objectTypes.indexOf(type) != -1) {
        Cls = ActivityObject.toClass(type);
        Cls.create(obj, callback);
    } else {
        callback(new UnknownTypeError(type), null);
    }
};

ActivityObject.ensureObject = function(obj, callback) {
    var Cls, type = obj.objectType, id = obj.id;
    if (ActivityObject.objectTypes.indexOf(type) === -1) {
        callback(new UnknownTypeError(type), null);
    } else {
        Cls = ActivityObject.toClass(type);
        Cls.create(obj, function(err, result) {
            if (err) {
                if (err instanceof AlreadyExistsError) {
                    Cls.get(id, callback);
                } else {
                    callback(err, null);
                }
            } else {
                callback(null, result);
            }
        });
    }
};

ActivityObject.compressProperty = function(obj, name, callback) {
    // Easy enough!
    if (!_(obj).has(name)) {
        callback(null);
        return;
    }
    Step(
        function() {
            ActivityObject.ensureObject(obj[name], this);
        },
        function(err, sub) {
            var Cls;
            if (err) {
                callback(err);
            } else {
                Cls = ActivityObject.toClass(sub.objectType);
                if (!Cls) {
                    callback(new UnknownTypeError(sub.objectType));
                } else {
                    obj[name] = new Cls({id: sub.id,
                                         objectType: sub.objectType});
                    callback(null);
                }
            }
        }
    );
};

ActivityObject.expandProperty = function(obj, name, callback) {
    // Easy enough!
    if (!_(obj).has(name)) {
        callback(null);
        return;
    }
    Step(
        function() {
            ActivityObject.ensureObject(obj[name], this);
        },
        function(err, sub) {
            if (err) {
                callback(err);
            } else {
                obj[name] = sub;
                callback(null);
            }
        }
    );
};

ActivityObject.prototype.favoritedBy = function(id, callback) {
    var obj = this,
        name = 'favoriters:'+obj.id;
    Step(
        function() {
            Stream.get(name, this);
        },
        function(err, stream) {
            if (err && err instanceof NoSuchThingError) {
                Stream.create({name: name}, this);
            } else if (err) {
                throw err;
            } else {
                this(null, stream);
            }
        },
        function(err, stream) {
            if (err) throw err;
            stream.deliver(id, this);
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

ActivityObject.prototype.unfavoritedBy = function(id, callback) {
    var obj = this,
        name = 'favoriters:'+obj.id;
    Step(
        function() {
            Stream.get(name, this);
        },
        function(err, stream) {
            if (err && err instanceof NoSuchThingError) {
                Stream.create({name: name}, this);
            } else if (err) {
                throw err;
            } else {
                this(null, stream);
            }
        },
        function(err, stream) {
            if (err) throw err;
            stream.remove(id, this);
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

ActivityObject.objectTypes = ['article',
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

var objectType, i;

// Constants-like members for activity object types

for (i = 0; i < ActivityObject.objectTypes.length; i++) {
    objectType = ActivityObject.objectTypes[i];
    ActivityObject[objectType.toUpperCase().replace('-', '_')] = objectType;
}

exports.ActivityObject = ActivityObject;
exports.UnknownTypeError = UnknownTypeError;
