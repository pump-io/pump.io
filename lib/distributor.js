// distributor.js
//
// Distributes a newly-received activity to recipients
//
// Copyright 2012, E14N https://e14n.com/
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

var path = require("path"),
    _ = require("underscore"),
    Step = require("step"),
    databank = require("databank"),
    OAuth = require("oauth-evanp").OAuth,
    Queue = require("jankyqueue"),
    cluster = require("cluster"),
    View = require("express").View,
    Firehose = require("./firehose"),
    Mailer = require("./mailer"),
    version = require("./version").version,
    URLMaker = require("./urlmaker").URLMaker,
    ActivityObject = require("./model/activityobject").ActivityObject,
    Collection = require("./model/collection").Collection,
    User = require("./model/user").User,
    Person = require("./model/person").Person,
    Edge = require("./model/edge").Edge,
    Credentials = require("./model/credentials").Credentials,
    NoSuchThingError = databank.NoSuchThingError;

var QUEUE_MAX = 25;
var MAX_CHUNK = 100;
var VIEW_ROOT = path.join(__dirname, "..", "public", "template");

var Distributor = function(activity) {

    var dtor = this,
        dinfo = function(obj, msg) {
            if (Distributor.log) {
                Distributor.log.info(obj, msg);
            }
        },
        derror = function(err) {
            if (Distributor.log) {
                Distributor.log.error(err);
            }
        },
        delivered = {},
        expanded = false,
        q = new Queue(QUEUE_MAX),
        toRecipient = function(recipient, callback) {
            switch (recipient.objectType) {
            case ActivityObject.PERSON:
                toPerson(recipient, callback);
                break;
            case ActivityObject.COLLECTION:
                toCollection(recipient, callback);
                break;
            default:
                callback(null);
                return;
            }
        },
        toPerson = function(person, callback) {

            var deliverToPerson = function(person, callback) {
                Step(
                    function() {
                        User.fromPerson(person.id, this);
                    },
                    function(err, user) {
                        var recipients;
                        if (err) throw err;
                        if (user) {
                            dinfo({nickname: user.nickname,
                                   id: activity.id},
                                  "Delivering activity to local user.");
                            user.addToInbox(activity, callback);
                            inboxUpdates(user);
                        } else {
                            toRemotePerson(person, 0, callback);
                        }
                    }
                );
            };

            if (_(delivered).has(person.id)) {
                // skip dupes
                callback(null);
                return;
            }

            delivered[person.id] = 1;
            q.enqueue(deliverToPerson, [person], callback);
        },
        toRemotePerson = function(person, retries, callback) {

            var endpoint,
                cred;

            dinfo({person: person.id,
                   activity: activity.id},
                  "Delivering activity to remote person.");

            Step(
                function() {
                    if (!expanded) {
                        activity.actor.expandFeeds(this);
                        expanded = true;
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
                    Credentials.getFor(activity.actor.id, endpoint, this);
                },
                function(err, results) {
                    var sanitized, oa, toSend;
                    if (err) throw err;
                    cred = results;
                    // FIXME: use Activity.sanitize() instead
                    sanitized = _(activity).clone();
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
                                   {"User-Agent": "pump.io/"+version});
                    
                    toSend = JSON.stringify(sanitized);

                    oa.post(endpoint, null, null, toSend, "application/json", this);
                },
                function(err, body, resp) {
                    if (err) {
                        if (retries === 0 && err.statusCode == 401) { // expired key
                            cred.del(function(err) {
                                if (err) {
                                    callback(err);
                                } else {
                                    toRemotePerson(person, retries+1, callback);
                                }
                            });
                        } else {
                            callback(err);
                        }
                    } else {
                        callback(null);
                    }
                }
            );
        },
        toCollection = function(collection, callback) {
            var actor = activity.actor;

            if (collection.id == Collection.PUBLIC) {
                dinfo({activity: activity.id},
                      "Delivering activity to public.");
                toFollowers(callback);
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
                        dinfo({activity: activity.id},
                              "Delivering activity to followers.");
                        toFollowers(callback);
                    } else {
                        // Usually stored by reference, so get the full object
                        ActivityObject.getObject(collection.objectType,
                                                 collection.id,
                                                 this);

                    }
                },
                function(err, result) {
                    if (err && err.name == "NoSuchThingError") {
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
                        dinfo({list: collection.id, activity: activity.id},
                              "Delivering activity to followers.");
                        toList(collection, callback);
                    } else {
                        // XXX: log, bemoan
                        callback(null);
                    }
                }
            );
        },
        toList = function(list, callback) {
            var str,
                doMore = function(last, callback) {
                    var members;
                    
                    Step(
                        function() {
                            if (last) {
                                str.getObjectsGreaterThan(last, MAX_CHUNK, this);
                            } else {
                                str.getObjects(0, MAX_CHUNK, this);
                            }
                        },
                        function(err, results) {
                            var group;
                            if (err) throw err;
                            members = results;
                            if (members.length === 0) {
                                this(null);
                                return;
                            } else {
                                group = this.group();
                                _.each(members, function(member) {
                                    if (member.objectType == ActivityObject.PERSON) {
                                        toPerson(member, group());
                                    } else {
                                        // XXX: LOG AND WEEP
                                    }
                                });
                            }
                        },
                        function(err) {
                            if (err) throw err;
                            if (members.length >= MAX_CHUNK) {
                                doMore(members[members.length - 1], this);
                            } else {
                                this(null);
                            }
                        },
                        callback
                    );
                };

            Step(
                function() {
                    list.getStream(this);
                },
                function(err, results) {
                    if (err) throw err;
                    str = results;
                    doMore(null, this);
                },
                callback
            );
        },
        toFollowers = function(callback) {

            // XXX: use followers stream instead

            Step(
                function() {
                    Edge.search({"to.id": activity.actor.id}, this);
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
                        toPerson(people[i], group());
                    }
                },
                callback
            );
        },
        // Send a message to the dispatch process
        // to note an update of this feed with this activity
        sendUpdate = function(url) {
            if (cluster.isWorker) {
                cluster.worker.send({cmd: "update",
                                     url: url,
                                     activity: activity});
            }
            return;
        },
        directRecipients = function(act) {
            var props = ["to", "bto"],
                recipients = [];

            props.forEach(function(prop) {
                if (_(act).has(prop) && _(act[prop]).isArray()) {
                    recipients = recipients.concat(act[prop]);
                }
            });

            // XXX: ensure uniqueness
            return recipients;
        },
        // Send updates for each applicable inbox feed
        // for this user. Covers main inbox, major/minor inbox,
        // direct inbox, and major/minor direct inbox 
        inboxUpdates = function(user) {

            var isDirectTo = function(user) {
                var recipients = directRecipients(activity);
                return _.any(recipients, function(item) {
                    return item.id == user.profile.id &&
                        item.objectType == user.profile.objectType;
                });
            };

            sendUpdate(URLMaker.makeURL("/api/user/"+user.nickname+"/inbox"));
            if (activity.isMajor()) {
                sendUpdate(URLMaker.makeURL("/api/user/"+user.nickname+"/inbox/major"));
            } else {
                sendUpdate(URLMaker.makeURL("/api/user/"+user.nickname+"/inbox/minor"));
            }
            if (isDirectTo(user)) {
                sendUpdate(URLMaker.makeURL("/api/user/"+user.nickname+"/inbox/direct"));
                if (activity.isMajor()) {
                    sendUpdate(URLMaker.makeURL("/api/user/"+user.nickname+"/inbox/direct/major"));
                } else {
                    sendUpdate(URLMaker.makeURL("/api/user/"+user.nickname+"/inbox/direct/minor"));
                }
            }
        },
        // Send updates for each applicable outbox feed
        // for this user. Covers main feed, major/minor feed
        outboxUpdates = function(user) {
            sendUpdate(URLMaker.makeURL("/api/user/"+user.nickname+"/feed"));
            if (activity.isMajor()) {
                sendUpdate(URLMaker.makeURL("/api/user/"+user.nickname+"/feed/major"));
            } else {
                sendUpdate(URLMaker.makeURL("/api/user/"+user.nickname+"/feed/minor"));
            }
        },
        cache = {},
        notifyByEmail = function(user, activity, callback) {

            var options = {defaultEngine: "utml",
                           root: VIEW_ROOT},
                hview = View.compile("activity-notification-html",
                                     cache,
                                     "activity-notification-html",
                                     options),
                tview = View.compile("activity-notification-text",
                                     cache,
                                     "activity-notification-text",
                                     options),
                html,
                text;

            // XXX: More specific template based on verb and object objectType

            try {
                html = hview.fn({principal: user.profile, principalUser: user, activity: activity});
                text = tview.fn({principal: user.profile, principalUser: user, activity: activity});
            } catch (err) {
                callback(err, null);
                return;
            }

            // XXX: Better subject

            Mailer.sendEmail({to: user.email,
                              subject: "Activity notification",
                              text: text,
                              attachment: {data: html,
                                           type: "text/html",
                                           alternative: true}},
                             callback);
        };

    dtor.distribute = function(callback) {
        var actor = activity.actor,
            recipients = activity.recipients(),
            toRecipients = function(cb) {
                Step(
                    function() {
                        var i, group = this.group();
                        for (i = 0; i < recipients.length; i++) {
                            toRecipient(recipients[i], persevere(group()));
                        }
                    },
                    cb
                );
            },
            toDispatch = function(cb) {
                Step(
                    function() {
                        User.fromPerson(actor.id, this);
                    },
                    function(err, user) {
                        if (err) throw err;
                        if (user) {
                            // Send updates
                            outboxUpdates(user);
                            // Also inbox!
                            inboxUpdates(user);
                        }
                        this(null);
                    },
                    cb
                );
            },
            toEmail = function(cb) {
                var direct = directRecipients(activity),
                    people = _.where(direct, {objectType: ActivityObject.PERSON});

                Step(
                    function() {
                        var group = this.group();

                        _.each(people, function(person) {

                            var user,
                                callback = persevere(group());

                            Step(
                                function() {
                                    User.fromPerson(person.id, this);
                                },
                                function(err, results) {
                                    if (err) throw err;
                                    user = results;
                                    if (!user) {
                                        callback(null);
                                        return;
                                    }
                                    if (!user.email) {
                                        callback(null);
                                        return;
                                    }
                                    user.expand(this);
                                },
                                function(err) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        notifyByEmail(user, activity, callback);
                                    }
                                }
                            );
                        });
                    },
                    cb
                );
            },
            toFirehose = function(cb) {

                var recipients = activity.recipients(),
                    pub = _.where(recipients, {id: Collection.PUBLIC});

                // If it's not a public activity, skip

                if (!pub || pub.length === 0) {
                    cb(null);
                    return;
                }

                // If the actor is a local user, ping the firehose

                Step(
                    function() {
                        User.fromPerson(actor.id, this);
                    },
                    function(err, user) {
                        if (err) throw err;
                        
                        if (!user) {
                            this(null);
                        } else {
                            Firehose.ping(activity, this);
                        }
                    },
                    persevere(cb)
                );
            },
            persevere = function(callback) {
                return function(err) {
                    var args = (arguments.length > 1) ? Array.prototype.slice.call(arguments, 1) : [];
                    if (err) {
                        derror(err);
                    }
                    args.unshift(null);
                    callback.apply(null, args);
                };
            };

        Step(
            function() {
                if (!expanded) {
                    actor.expandFeeds(this);
                    expanded = true;
                } else {
                    this(null);
                }
            },
            function(err) {
                if (err) throw err;
                toRecipients(persevere(this.parallel()));
                toDispatch(persevere(this.parallel()));
                toFirehose(persevere(this.parallel()));
                toEmail(persevere(this.parallel()));
            },
            callback
        );
    };
};

module.exports = Distributor;
