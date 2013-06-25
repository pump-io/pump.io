// collection.js
//
// data object representing an collection
//
// Copyright 2011-2012, E14N https://e14n.com/
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
    databank = require("databank"),
    DatabankObject = databank.DatabankObject,
    ActivityObject = require("./activityobject").ActivityObject,
    Stream = require("./stream").Stream,
    URLMaker = require("../urlmaker").URLMaker,
    AlreadyExistsError = databank.AlreadyExistsError;

var Collection = DatabankObject.subClass("collection", ActivityObject);

Collection.schema = ActivityObject.subSchema(["attachments",
                                              "inReplyTo"],
                                             ["objectTypes",
                                              "members"]);

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
                callback(null, user);
            }
        });
    } else {
        callback(null, false);
    }
};

Collection.checkList = function(props, callback) {

    var user;

    Step(
        function() {
            Collection.isList(props, this);
        },
        function(err, result) {
            if (err) throw err;
            user = result;
            if (!user) {
                callback(null, null);
            } else {
                Collection.search({"author.id": props.author.id, "displayName": props.displayName}, this);
            }
        },
        function(err, results) {
            var i, diff, hit = false;
            if (err) {
                return callback(err, null);
            }
            props.objectTypes.sort();
            for (i = 0; i < results.length; i++) {
                if (!_(results[i]).has("objectTypes")) {
                    continue;
                }
                results[i].objectTypes.sort();
                if (props.objectTypes.join(",") == results[i].objectTypes.join(",") &&
                    (!_(props).has('id') || props.id !== results[i].id)) {
                    hit = true;
                    break;
                }
            }

            if (hit) {
                return callback(new AlreadyExistsError("A folder for '" + props.objectTypes.join(",") + "' named '" + props.displayName + "' already exists."), null);
            } else {
                
                return callback(null, user);
            }
        }
    );
};

Collection.beforeCreate = function(props, callback) {

    var user;

    Step(
        function() {
            Collection.checkList(props, this);
        },
        function(err, result) {
            if (err) throw err;
            user = result;
            ActivityObject.beforeCreate.apply(Collection, [props, this]);
        },
        function(err, props) {
            if (err) {
                callback(err, null);
            } else {
                if (user) {
                    props.url = URLMaker.makeURL(user.nickname+"/list/"+props._uuid);
                }
                callback(null, props);
            }
        }
    );
};

Collection.prototype.afterCreate = function(callback) {

    var coll = this,
        User = require("./user").User,
        user;
    
    Step(
        function() {
            ActivityObject.prototype.afterCreate.apply(coll, [this]);
        },
        function(err) {
            if (err) throw err;
            Collection.isList(coll, this);
        },
        function(err, result) {
            if (err) throw err;
            user = result;
            if (!user) {
                callback(null);
            } else {
                Stream.create({name: coll.streamName()}, this);
            }
        },
        function(err, stream) {
            if (err) throw err;
            user.getLists(coll.objectTypes[0], this);
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

Collection.prototype.beforeEfface = function(callback) {

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
                Stream.get(coll.streamName(), this);
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
            user.getLists(coll.objectTypes[0], this);
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
    Stream.get(this.streamName(), callback);
};

Collection.prototype.expandFeeds = function(callback) {
    var coll = this;
    Step(
        function() {
            Collection.isList(coll, this);
        },
        function(err, isList) {
            if (err) throw err;
            if (!isList) {
                callback(null);
            } else {
                coll.getStream(this);
            }
        },
        function(err, stream) {
            if (err) throw err;
            stream.count(this.parallel());
            stream.getObjects(0, 4, this.parallel());
        },
        function(err, count, members) {
            if (err) {
                callback(err);
            } else {
                coll.members = {
                    totalItems: count,
                    url: URLMaker.makeURL("api/"+coll.objectType+"/"+coll._uuid+"/members")
                };
                if (members && members.length > 0) {
                    coll.members.items = members;
                }
                callback(null);
            }
        }
    );
};

Collection.prototype.streamName = function() {
    return "collection:"+this.id;
};

// Represents the public; everyone, everywhere
Collection.PUBLIC = "http://activityschema.org/collection/public";

exports.Collection = Collection;
