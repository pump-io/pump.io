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
    OAuth = require("oauth").OAuth,
    Queue = require("./jankyqueue").Queue,
    ActivityObject = require("./model/activityobject").ActivityObject,
    Collection = require("./model/collection").Collection,
    User = require("./model/user").User,
    Person = require("./model/person").Person,
    Edge = require("./model/edge").Edge,
    Credentials = require("./model/credentials").Credentials,
    NoSuchThingError = databank.NoSuchThingError;

var Distributor = function(activity) {
    this.activity = activity;
    this.delivered = {};
    this.expanded = false;
    this.q = new Queue(Distributor.QUEUE_MAX);
};

Distributor.QUEUE_MAX = 25;

Distributor.prototype.distribute = function(callback) {
    var dtor = this,
        recipients = dtor.activity.recipients(),
        distribution = {};

    Step(
        function() {
            var i, group = this.group();
            for (i = 0; i < recipients.length; i++) {
                dtor.toRecipient(recipients[i], group());
            }
        },
        callback
    );
};

Distributor.prototype.toRecipient = function(recipient, callback) {
    var dtor = this;
    switch (recipient.objectType) {
    case ActivityObject.PERSON:
        dtor.toPerson(recipient, callback);
        break;
    case ActivityObject.COLLECTION:
        dtor.toCollection(recipient, callback);
        break;
    default:
        // TODO: log and cry
        return;
    }
};

Distributor.prototype.toPerson = function(person, callback) {

    var dtor = this,
        deliverToPerson = function(person, callback) {
            Step(
                function() {
                    User.fromPerson(person.id, this);
                },
                function(err, user) {
                    if (err) throw err;
                    if (user) {
                        user.addToInbox(dtor.activity, callback);
                    } else {
                        dtor.toRemotePerson(person, callback);
                    }
                }
            );
        };

    if (_(dtor.delivered).has(person.id)) {
        // skip dupes
        callback(null);
        return;
    }

    dtor.delivered[person.id] = 1;
    dtor.q.enqueue(deliverToPerson, [person], callback);
};

Distributor.prototype.toRemotePerson = function(person, callback) {

    var dtor = this,
        endpoint;

    Step(
        function() {
            if (!dtor.expanded) {
                dtor.activity.actor.expandFeeds(this);
                dtor.expanded = true;
            } else {
                this(null);
            }
        },
        function(err) {
            if (err) throw err;
            person.getInbox(this);
        },
        function(err, result) {
            if (err) {
                throw err;
            }
            endpoint = result;
            Credentials.getFor(dtor.activity.actor.id, endpoint, this);
        },
        function(err, cred) {
            var sanitized, oa, toSend;
            if (err) throw err;
            // FIXME: use Activity.sanitize() instead
            sanitized = _(dtor.activity).clone();
            if (_(sanitized).has("bto")) {
                delete sanitized.bto;
            }
            if (_(sanitized).has("bcc")) {
                delete sanitized.bcc;
            }

            oa = new OAuth(null,
                           null,
                           cred.client_id,
                           cred.client_secret,
                           "1.0",
                           null,
                           "HMAC-SHA1",
                           null, // nonce size; use default
                           {"User-Agent": "activitypump/0.1.0"});
    
            toSend = JSON.stringify(sanitized);

            oa.post(endpoint, null, null, toSend, "application/json", this);
        },
        function(err, body, resp) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

Distributor.prototype.toCollection = function(collection, callback) {
    var dtor = this,
        actor = dtor.activity.actor;

    if (collection.id == Collection.PUBLIC) {
        dtor.toFollowers(callback);
        return;
    }

    Step(
        function() {
            var cb = this;
            if (actor && actor.objectType === "person" &&
                actor instanceof Person) {
                actor.followersURL(cb);
            } else {
                cb(null, null);
            }
        },
        function(err, url) {
            if (err) throw err;
            if (url && url == collection.id) {
                dtor.toFollowers(callback);
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
                dtor.toList(collection, callback);
            } else {
                // XXX: log, bemoan
                callback(null);
            }
        }
    );
};

Distributor.prototype.toFollowers = function(callback) {
    var dtor = this;

    // XXX: use followers stream instead

    Step(
        function() {
            Edge.search({"to.id": dtor.activity.actor.id}, this);
        },
        function(err, edges) {
            var i, group = this.group();
            if (err) throw err;
            for (i = 0; i < edges.length; i++) {
                Person.get(edges[i].from.id, group());
            }
        },
        function(err, people) {
            if (err) throw err;
            var i, group = this.group();
            for (i = 0; i < people.length; i++) {
                dtor.toPerson(people[i], group());
            }
        },
        callback
    );
};

module.exports = Distributor;
