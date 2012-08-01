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
    Step = require("step"),
    DatabankObject = require("databank").DatabankObject,
    ActivityObject = require("./activityobject").ActivityObject,
    Stream = require("./stream").Stream;

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

Collection.isList = function(props, callback) {
    var User = require("./user").User;

    if (_(props).has('author') &&
        _(props.author).isObject() &&
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

Collection.checkList = function(props, callback) {
    Collection.isList(props, function(err, isList) {
        if (err) {
            callback(err, null);
        } else if (!isList) {
            callback(null, props);
        } else {
            Collection.search({"author.id": props.author.id, "displayName": props.displayName}, function(err, results) {
                var i, hit = false;
                if (err) {
                    callback(err, null);
                } else if (results.length === 0) {
                    callback(null, props);
                } else {
                    for (i = 0; i < results.length; i++) {
                        if (JSON.stringify(results[i].objectTypes) === JSON.stringify(props.objectTypes)) {
                            hit = true;
                            break;
                        }
                    }
                    if (hit) {
                        callback(new Error("A folder for '" + props.objectTypes.join(",") + "' named '" + props.displayName + "'already exists."), null);
                    } else {
                        callback(null, props);
                    }
                }
            });
        }
    });
};

Collection.beforeCreate = function(props, callback) {

    Step(
        function() {
            Collection.checkList(props, this);
        },
        function(err, props) {
            if (err) throw err;
            ActivityObject.beforeCreate.apply(Collection, [props, this]);
        },
        function(err, props) {
            if (err) {
                callback(err, null);
            } else {
                // Overwritten by ActivityObject; must re-write
                callback(null, props);
            }
        }
    );
};

Collection.prototype.afterCreate = function(callback) {

    var coll = this,
        User = require("./user").User;
    
    Step(
        function() {
            Collection.isList(coll, this);
        },
        function(err, isList) {
            if (err) throw err;
            if (!isList) {
                callback(null);
            } else {
                Stream.create({name: "collection:"+coll.id}, this);
            }
        },
        function(err, stream) {
            if (err) throw err;
            User.fromPerson(coll.author.id, this);
        },
        function(err, user) {
            if (err) throw err;
            user.getLists(this);
        },
        function(err, lists) {
            if (err) throw err;
            lists.deliver(coll.id, this);
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

Collection.prototype.afterDel = function(callback) {
    var coll = this,
        User = require("./user").User;
    
    Step(
        function() {
            Collection.isList(coll, this);
        },
        function(err, isList) {
            if (err) throw err;
            if (!isList) {
                callback(null);
            } else {
                Stream.get("collection:"+coll.id, this);
            }
        },
        function(err, stream) {
            if (err) throw err;
            stream.del(this);
        },
        function(err) {
            if (err) throw err;
            User.fromPerson(coll.author.id, this);
        },
        function(err, user) {
            if (err) throw err;
            user.getLists(this);
        },
        function(err, stream) {
            if (err) throw err;
            stream.remove(coll.id, this);
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

Collection.prototype.getStream = function(callback) {
    Stream.get("collection:"+this.id, callback);
};

Collection.prototype.expandFeeds = function(callback) {
    callback(null);
};

exports.Collection = Collection;
