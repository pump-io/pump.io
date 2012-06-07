// tombstone.js
//
// A record of a deleted object
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
    Stamper = require('../stamper').Stamper,
    Step = require('step'),
    DatabankObject = databank.DatabankObject,
    NoSuchThingError = databank.NoSuchThingError;

var Tombstone = DatabankObject.subClass('tombstone');

Tombstone.schema = {
    pkey: 'typeuuid',
    fields: ['objectType',
             'uuid',
             'created',
             'updated',
             'deleted']
};

Tombstone.makeKey = function(type, uuid) {
    return type + '/' + uuid;
};

Tombstone.mark = function(obj, callback) {

    if (!_(obj).isObject()) {
        callback(new Error("Can only tombstone objects"));
        return;
    }

    if (!_(obj).has('uuid') || !_(obj).has('objectType')) {
        callback(new Error("Invalid object for tombstoning"));
        return;
    }

    Tombstone.markFull(obj, obj.objectType, obj.uuid, callback);
};

Tombstone.markFull = function(obj, type, uuid, callback) {
    var ts = new Tombstone();

    ts.uuid       = uuid;
    ts.objectType = type;
    
    if (_(obj).has('published')) {
        ts.created = obj.published;
    } else if (_(obj).has('created')) {
        ts.created = obj.created;
    }

    if (_(obj).has('updated')) {
        ts.updated = obj.updated;
    }

    ts.save(callback); 
};

Tombstone.beforeCreate = function(props, callback) {

    props.typeuuid = Tombstone.makeKey(props.type, props.uuid);
    props.deleted = Stamper.stamp();

    callback(null, props);
};

Tombstone.prototype.beforeSave = function(callback) {

    if (!_(this).has('typeuuid')) {
        this.typeuuid = Tombstone.makeKey(this.objectType, this.uuid);
    }
    if (!_(this).has('deleted')) {
        this.deleted = Stamper.stamp();
    }

    callback(null);
};

Tombstone.lookup = function(type, uuid, callback) {
    Tombstone.get(Tombstone.makeKey(type, uuid), callback);
};

exports.Tombstone = Tombstone;
