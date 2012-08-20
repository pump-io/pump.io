// distributor.js
//
// Distributes a newly-received activity to recipients
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

var _ = require("underscore"),
    Step = require("step"),
    databank = require("databank"),
    ActivityObject = require("./model/activityobject").ActivityObject,
    Collection = require("./model/collection").Collection,
    User = require("./model/user").User,
    Person = require("./model/person").Person,
    Edge = require("./model/edge").Edge,
    NoSuchThingError = databank.NoSuchThingError;

var Distributor = {
    distribute: function(activity, callback) {
        var dtor = this,
            recipients = dtor.recipientsOf(activity),
            distribution = {};

        Step(
            function() {
                var i, group = this.group();
                for (i = 0; i < recipients.length; i++) {
                    dtor.toRecipient(recipients[i], activity, group());
                }
            },
            callback
        );
    },
    recipientsOf: function(activity) {
        var props = ["to", "cc", "bto", "bcc"],
            recipients = [];

        props.forEach(function(prop) {
            if (_(activity).has(prop) && _(activity[prop]).isArray()) {
                recipients = recipients.concat(activity[prop]);
            }
        });

        return recipients;
    },
    toRecipient: function(recipient, activity, callback) {
        switch (recipient.objectType) {
        case ActivityObject.PERSON:
            this.toPerson(recipient, activity, callback);
            break;
        case ActivityObject.COLLECTION:
            this.toCollection(recipient, activity, callback);
            break;
        default:
            // TODO: log and cry
            return;
        }
    },
    toPerson: function(person, activity, callback) {
        var dtor = this;

        Step(
            function() {
                User.fromPerson(person.id, this);
            },
            function(err, user) {
                if (err) {
                    callback(err);
                } else if (!user) {
                    callback(null);
                } else {
                    user.addToInbox(activity, callback);
                }
            }
        );
    },
    toCollection: function(collection, activity, callback) {
        var dtor = this,
            actor = activity.actor;

        if (collection.id == Collection.PUBLIC) {
            dtor.toFollowers(activity, callback);
            return;
        }

        Step(
            function() {
                var cb = this;
                if (actor && actor.objectType === "person" && actor instanceof Person) {
                    actor.followersURL(cb);
                } else {
                    cb(null, null);
                }
            },
            function(err, url) {
                if (err) throw err;
                if (url && url == collection.id) {
                    dtor.toFollowers(activity, callback);
                } else {
                    // Usually stored by reference, so get the full object
                    ActivityObject.getObject(collection.objectType,
                                             collection.id,
                                             this);

                }
            },
            function(err, result) {
                if (err && err instanceof NoSuchThingError) {
                    callback(null);
                } else if (err) {
                    throw err;
                } else {
                    // XXX: assigning to function param
                    collection = result;
                    Collection.isList(collection, this);
                }
            },
            function(err, isList) {
                if (err) {
                    callback(err);
                } else if (isList && (collection.author.id == actor.id)) {
                    dtor.toList(collection, activity, callback);
                } else {
                    // XXX: log, bemoan
                    callback(null);
                }
            }
        );
    },
    toFollowers: function(activity, callback) {
        var dtor = this;

        // XXX: use followers stream instead

        Step(
            function() {
                Edge.search({"to.id": activity.actor.id}, this);
            },
            function(err, edges) {
                var i, group = this.group();
                if (err) throw err;
                for (i = 0; i < edges.length; i++) {
                    Person.get(edges[i].to.id, group());
                }
            },
            function(err, people) {
                if (err) throw err;
                var i, group = this.group();
                for (i = 0; i < people.length; i++) {
                    dtor.toPerson(people[i], activity, group());
                }
            },
            callback
        );
    }
};

module.exports = Distributor;
