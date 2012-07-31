// collection.js
//
// data object representing an collection
//
// Copyright 2011-2012, StatusNet Inc.
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

var _ = require("underscore"),
    DatabankObject = require("databank").DatabankObject,
    ActivityObject = require("./activityobject").ActivityObject;

var Collection = DatabankObject.subClass("collection", ActivityObject);

Collection.schema = {
    pkey: "id",
    fields: ["author",
             "displayName",
             "image",
             "objectTypes",
             "published",
             "summary",
             "updated",
             "url"]
};

Collection.isFolder = function(props, callback) {
    var User = require("./user").User;

    if (_(props).has('author') &&
        _(props.author).has('id') &&
        _(props).has('objectTypes') &&
        _(props).has('displayName') &&
        _(props.objectTypes).isArray() &&
        props.objectTypes.length === 1) {
        User.fromPerson(props.author.id, function(err, user) {
            if (err) {
                callback(err, null);
            } else if (!user) {
                callback(null, false);
            } else {
                callback(null, true);
            }
        });
    } else {
        callback(null, false);
    }
};

Collection.checkFolder = function(props, callback) {
};

Collection.beforeCreate = function(props, callback) {
    Collection.checkFolder(props, function(err, props) {
        if (err) {
            callback(err, null);
        } else {
            Collection.parent.beforeCreate(props, callback);
        }
    });
};

Collection.prototype.afterCreate = function(callback) {
    Collection.checkFolder(props, function(err, props) {
        if (err) {
            callback(err, null);
        } else {
            Collection.parent.beforeCreate(props, callback);
        }
    });
};

Collection.prototype.afterDel = function(callback) {
};

exports.Collection = Collection;
