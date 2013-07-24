// activity-test.js
//
// Test the activity module
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

var assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    _ = require("underscore"),
    fs = require("fs"),
    path = require("path"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    schema = require("../lib/schema").schema,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("activity module interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var testSchema = {
    pkey: "id", 
    fields: ["actor",
             "content",
             "generator",
             "icon",
             "id",
             "object",
             "published",
             "provider",
             "target",
             "title",
             "url",
             "_uuid",
             "to",
             "cc",
             "bto",
             "bcc",
             "_received",
             "updated",
             "verb"],
    indices: ["actor.id", "object.id", "_uuid"]
};

var testData = {
    "create": {
        actor: {
            id: "urn:uuid:8f64087d-fffc-4fe0-9848-c18ae611cafd",
            displayName: "Delbert Fnorgledap",
            objectType: "person"
        },
        verb: "post",
        object: {
            id: "urn:uuid:9c9bbb2e-ddb7-11e2-abe4-2c8158efb9e9",
            objectType: "note",
            content: "Feeling groovy."
        }
    },
    "update": {
        mood: {
            displayName: "groovy"
        }
    }
};

var testVerbs = ["accept",
                 "access",
                 "acknowledge",
                 "add",
                 "agree",
                 "append",
                 "approve",
                 "archive",
                 "assign",
                 "at",
                 "attach",
                 "attend",
                 "author",
                 "authorize",
                 "borrow",
                 "build",
                 "cancel",
                 "close",
                 "complete",
                 "confirm",
                 "consume",
                 "checkin",
                 "close",
                 "create",
                 "delete",
                 "deliver",
                 "deny",
                 "disagree",
                 "dislike",
                 "experience",
                 "favorite",
                 "find",
                 "follow",
                 "give",
                 "host",
                 "ignore",
                 "insert",
                 "install",
                 "interact",
                 "invite",
                 "join",
                 "leave",
                 "like",
                 "listen",
                 "lose",
                 "make-friend",
                 "open",
                 "play",
                 "post",
                 "present",
                 "purchase",
                 "qualify",
                 "read",
                 "receive",
                 "reject",
                 "remove",
                 "remove-friend",
                 "replace",
                 "request",
                 "request-friend",
                 "resolve",
                 "return",
                 "retract",
                 "rsvp-maybe",
                 "rsvp-no",
                 "rsvp-yes",
                 "satisfy",
                 "save",
                 "schedule",
                 "search",
                 "sell",
                 "send",
                 "share",
                 "sponsor",
                 "start",
                 "stop-following",
                 "submit",
                 "tag",
                 "terminate",
                 "tie",
                 "unfavorite",
                 "unlike",
                 "unsatisfy",
                 "unsave",
                 "unshare",
                 "update",
                 "use",
                 "watch",
                 "win"];

var mb = modelBatch("activity", "Activity", testSchema, testData);

mb["When we require the activity module"]
["and we get its Activity class export"]
["and we create an activity instance"]
["auto-generated fields are there"] = function(err, created) {
    assert.isString(created.id);
    assert.isString(created._uuid);
    assert.isString(created.published);
    assert.isString(created.updated);
    assert.isObject(created.links);
    assert.isObject(created.links.self);
    assert.isString(created.links.self.href);
};

// Since actor, object will have some auto-created stuff, we only
// check that their attributes match

mb["When we require the activity module"]
["and we get its Activity class export"]
["and we create an activity instance"]
["passed-in fields are there"] = function(err, created) {
    var prop, orig = testData.create, child, cprop;
    for (prop in _(orig).keys()) {
        if (_.isObject(orig[prop])) {
            assert.include(created, prop);
            child = orig[prop];
            for (cprop in _(child).keys()) {
                assert.include(created[prop], cprop);
                assert.equal(created[prop][cprop], child[cprop]);
            }
        } else {
            assert.equal(created[prop], orig[prop]);
        }
    }
};

suite.addBatch(mb);

suite.addBatch({
    "When we get the Activity class": {
        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {

                var mod;

                if (err) {
                    cb(err, null);
                    return;
                }

                DatabankObject.bank = db;
                
                mod = require("../lib/model/activity");

                if (!mod) {
                    cb(new Error("No module"), null);
                    return;
                }

                cb(null, mod.Activity);
            });
        },
        "it works": function(err, Activity) {
            assert.ifError(err);
            assert.isFunction(Activity);
        },
        "it has the right verbs": function(err, Activity) {
            var i;
            assert.isArray(Activity.verbs);
            for (i = 0; i < testVerbs.length; i++) {
                assert.includes(Activity.verbs, testVerbs[i]);
            }
            for (i = 0; i < Activity.verbs.length; i++) {
                assert.includes(testVerbs, Activity.verbs[i]);
            }
        },
        "it has a const-like member for each verb": function(err, Activity) {
            var i, verb, name;
            for (i = 0; i < testVerbs.length; i++) {
                verb = testVerbs[i];
                name = verb.toUpperCase().replace("-", "_");
                assert.equal(Activity[name], verb);
            }
        },
        "it has a postOf() class method": function(err, Activity) {
            assert.isFunction(Activity.postOf);
        },
        "and we create an instance": {
            topic: function(Activity) {
                return new Activity({});
            },
            "it has the expand() method": function(activity) {
                assert.isFunction(activity.expand);
            },
            "it has the sanitize() method": function(activity) {
                assert.isFunction(activity.sanitize);
            },
            "it has the checkRecipient() method": function(activity) {
                assert.isFunction(activity.checkRecipient);
            },
            "it has the recipients() method": function(activity) {
                assert.isFunction(activity.recipients);
            },
            "it has the isMajor() method": function(activity) {
                assert.isFunction(activity.isMajor);
            },
            "it has the addReceived() method": function(activity) {
                assert.isFunction(activity.addReceived);
            }
        },
        "and we apply() a new post activity": {
            topic: function(Activity) {
                var cb = this.callback,
                    act = new Activity({
                        actor: {
                            id: "urn:uuid:8f64087d-fffc-4fe0-9848-c18ae611cafd",
                            displayName: "Delbert Fnorgledap",
                            objectType: "person"
                        },
                        verb: "post",
                        object: {
                            objectType: "note",
                            content: "Feeling groovy."
                        }
                    });
                
                act.apply(null, function(err) {
                    if (err) {
                        cb(err, null);
                    } else {
                        cb(null, act);
                    }
                });
            },
            "it works": function(err, activity) {
                assert.ifError(err);
                assert.isObject(activity);
            },
            "and we fetch its object": {
                topic: function(activity) {
                    var Note = require("../lib/model/note").Note;
                    Note.get(activity.object.id, this.callback);
                },
                "it exists": function(err, note) {
                    assert.ifError(err);
                    assert.isObject(note);
                },
                "it has the right author": function(err, note) {
                    assert.equal(note.author.id, "urn:uuid:8f64087d-fffc-4fe0-9848-c18ae611cafd");
                }
            },
            "and we save() the activity": {
                topic: function(activity) {
                    var cb = this.callback;
                    activity.save(function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, activity);
                        }
                    });
                },
                "it works": function(err, activity) {
                    assert.ifError(err);
                    assert.isObject(activity);
                    assert.instanceOf(activity,
                                      require("../lib/model/activity").Activity);
                },
                "its object properties have ids": function(err, activity) {
                    assert.isString(activity.actor.id);
                    assert.isString(activity.object.id);
                },
                "its object properties are objects": function(err, activity) {
                    assert.isObject(activity.actor);
                    assert.instanceOf(activity.actor, require("../lib/model/person").Person);
                    assert.isObject(activity.object);
                    assert.instanceOf(activity.object, require("../lib/model/note").Note);
                },
                "its object properties are expanded": function(err, activity) {
                    assert.isString(activity.actor.displayName);
                    assert.isString(activity.object.content);
                },
                "its object property has a likes property": function(err, activity) {
                    assert.ifError(err);
                    assert.includes(activity.object, "likes");
                    assert.isObject(activity.object.likes);
                    assert.includes(activity.object.likes, "totalItems");
                    assert.isNumber(activity.object.likes.totalItems);
                    assert.includes(activity.object.likes, "url");
                    assert.isString(activity.object.likes.url);
                },
                "and we get the stored activity": {
                    topic: function(saved, activity, Activity) {
                        Activity.get(activity.id, this.callback);
                    },
                    "it works": function(err, copy) {
                        assert.ifError(err);
                        assert.isObject(copy);
                    },
                    "its object properties are expanded": function(err, activity) {
                        assert.isString(activity.actor.displayName);
                        assert.isString(activity.object.content);
                    },
                    "its object properties are objects": function(err, activity) {
                        assert.isObject(activity.actor);
                        assert.instanceOf(activity.actor, require("../lib/model/person").Person);
                        assert.isObject(activity.object);
                        assert.instanceOf(activity.object, require("../lib/model/note").Note);
                    },
                    "its object property has a likes property": function(err, activity) {
                        assert.ifError(err);
                        assert.includes(activity.object, "likes");
                        assert.isObject(activity.object.likes);
                        assert.includes(activity.object.likes, "totalItems");
                        assert.isNumber(activity.object.likes.totalItems);
                        assert.includes(activity.object.likes, "url");
                        assert.isString(activity.object.likes.url);
                    }
                }
            }
        },
        "and we apply() a new follow activity": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    users = {},
                    cb = this.callback;

                Step(
                    function() {
                        User.create({nickname: "alice", password: "funky_monkey"}, this);
                    },
                    function(err, alice) {
                        if (err) throw err;
                        users.alice = alice;
                        User.create({nickname: "bob", password: "bob*1234"}, this);
                    },
                    function(err, bob) {
                        if (err) throw err;
                        users.bob = bob;
                        var act = new Activity({actor: users.alice.profile,
                                                verb: "follow",
                                                object: users.bob.profile});
                        act.apply(users.alice.profile, this);
                    },
                    function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, users);
                        }
                    }
                );
            },
            teardown: function(users) {
                Step(
                    function() {
                        users.alice.del(this.parallel());
                        users.bob.del(this.parallel());
                    },
                    function(err) {
                        // ignore
                    }
                );
            },
            "it works": function(err, users) {
                assert.ifError(err);
                assert.isObject(users);
                assert.isObject(users.alice);
                assert.isObject(users.bob);
            },
            "and we check the follow lists": {
                topic: function(users) {
                    var cb = this.callback,
                        following, followers;

                    Step(
                        function() {
                            users.alice.getFollowing(0, 20, this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            following = results;
                            users.bob.getFollowers(0, 20, this);
                        },
                        function(err, results) {
                            if (err) {
                                cb(err, null);
                            } else {
                                followers = results;
                                cb(err, {users: users, following: following, followers: followers});
                            }
                        }
                    );
                },
                "it works": function(err, res) {
                    assert.ifError(err);
                },
                "following list is correct": function(err, res) {
                    assert.isArray(res.following);
                    assert.lengthOf(res.following, 1);
                    assert.equal(res.following[0].id, res.users.bob.profile.id);
                },
                "followers list is correct": function(err, res) {
                    assert.isArray(res.followers);
                    assert.lengthOf(res.followers, 1);
                    assert.equal(res.followers[0].id, res.users.alice.profile.id);
                },
                "and we apply() a stop-following activity": {
                    topic: function(res, users, Activity) {
                        var act = new Activity({actor: users.alice.profile,
                                                verb: "stop-following",
                                                object: users.bob.profile});
                        act.apply(users.alice.profile, this.callback);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we check for the follow lists again": {
                        topic: function(res, users) {
                            var cb = this.callback,
                                following, followers;

                            Step(
                                function() {
                                    users.alice.getFollowing(0, 20, this);
                                },
                                function(err, results) {
                                    if (err) throw err;
                                    following = results;
                                    users.bob.getFollowers(0, 20, this);
                                },
                                function(err, results) {
                                    if (err) {
                                        cb(err, null);
                                    } else {
                                        followers = results;
                                        cb(err, {users: users, following: following, followers: followers});
                                    }
                                }
                            );
                        },
                        "it works": function(err, res) {
                            assert.ifError(err);
                        },
                        "following list is correct": function(err, res) {
                            assert.isArray(res.following);
                            assert.lengthOf(res.following, 0);
                        },
                        "followers list is correct": function(err, res) {
                            assert.isArray(res.followers);
                            assert.lengthOf(res.followers, 0);
                        }
                    }
                }
            }
        },
        "and we sanitize() an activity for the actor": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    user,
                    cb = this.callback;

                Step(
                    function() {
                        User.create({nickname: "charlie", password: "one two three four five six"}, this);
                    },
                    function(err, result) {
                        var act;
                        if (err) throw err;
                        user = result;
                        act = {
                            actor: user.profile,
                            verb: "post",
                            bto: [
                                {
                                    objectType: "person",
                                    id: "urn:uuid:b59554e4-e576-11e1-b0ff-5cff35050cf2"
                                }
                            ],
                            bcc: [
                                {
                                    objectType: "person",
                                    id: "urn:uuid:c456d228-e576-11e1-89dd-5cff35050cf2"
                                }
                            ],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) {
                            cb(err, null);
                        } else {
                            act.sanitize(user.profile);
                            cb(err, act);
                        }
                    }
                );
            },
            "it works": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
            },
            "uuid is invisible": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
                assert.isFalse(act.hasOwnProperty("_uuid"));
            },
            "bcc is visible": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
                assert.isTrue(act.hasOwnProperty("bcc"));
            },
            "bto is visible": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
                assert.isTrue(act.hasOwnProperty("bto"));
            }
        },
        "and we sanitize() an activity for another user": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    user1, user2,
                    cb = this.callback;

                Step(
                    function() {
                        User.create({nickname: "david", password: "fig*leaf"}, this.parallel());
                        User.create({nickname: "ethel", password: "Mer-man!"}, this.parallel());
                    },
                    function(err, result1, result2) {
                        var act;
                        if (err) throw err;
                        user1 = result1;
                        user2 = result2;
                        act = {
                            actor: user1.profile,
                            verb: "post",
                            bto: [
                                {
                                    objectType: "person",
                                    id: "urn:uuid:b59554e4-e576-11e1-b0ff-5cff35050cf2"
                                }
                            ],
                            bcc: [
                                {
                                    objectType: "person",
                                    id: "urn:uuid:c456d228-e576-11e1-89dd-5cff35050cf2"
                                }
                            ],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) {
                            cb(err, null);
                        } else {
                            act.sanitize(user2.profile);
                            cb(err, act);
                        }
                    }
                );
            },
            "it works": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
            },
            "uuid is invisible": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
                assert.isFalse(act.hasOwnProperty("_uuid"));
            },
            "bcc is invisible": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
                assert.isFalse(act.hasOwnProperty("bcc"));
            },
            "bto is invisible": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
                assert.isFalse(act.hasOwnProperty("bto"));
            }
        },
        "and we sanitize() an activity for anonymous user": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    cb = this.callback;

                Step(
                    function() {
                        User.create({nickname: "frank", password: "N. Stein"}, this);
                    },
                    function(err, user) {
                        var act;
                        if (err) throw err;
                        act = {
                            actor: user.profile,
                            verb: "post",
                            bto: [
                                {
                                    objectType: "person",
                                    id: "urn:uuid:b59554e4-e576-11e1-b0ff-5cff35050cf2"
                                }
                            ],
                            bcc: [
                                {
                                    objectType: "person",
                                    id: "urn:uuid:c456d228-e576-11e1-89dd-5cff35050cf2"
                                }
                            ],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) {
                            cb(err, null);
                        } else {
                            act.sanitize();
                            cb(err, act);
                        }
                    }
                );
            },
            "it works": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
            },
            "uuid is invisible": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
                assert.isFalse(act.hasOwnProperty("_uuid"));
            },
            "bcc is invisible": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
                assert.isFalse(act.hasOwnProperty("bcc"));
            },
            "bto is invisible": function(err, act) {
                assert.ifError(err);
                assert.isObject(act);
                assert.isFalse(act.hasOwnProperty("bto"));
            }
        },
        "and we check if a direct addressee is a recipient": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    cb = this.callback,
                    p1 = {
                        objectType: "person",
                        id: "urn:uuid:f58c37a4-e5c9-11e1-9613-70f1a154e1aa"
                    },
                    p2 = {
                        objectType: "person",
                        id: "urn:uuid:b59554e4-e576-11e1-b0ff-5cff35050cf2"
                    };

                Step(
                    function() {
                        var act = {
                            actor: p1,
                            verb: "post",
                            to: [p2],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) throw err;
                        act.checkRecipient(p2, this);
                    },
                    cb
                );
            },
            "it works": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
            },
            "it returns true": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
                assert.isTrue(isRecipient);
            }
        },
        "and we check if empty user is a recipient of a public activity": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    Collection = require("../lib/model/collection").Collection,
                    cb = this.callback,
                    p1 = {
                        objectType: "person",
                        id: "urn:uuid:7bb4c51a-e88d-11e1-b9d8-0024beb67924"
                    },
                    p2 = {
                        objectType: "collection",
                        id: Collection.PUBLIC
                    };

                Step(
                    function() {
                        var act = {
                            actor: p1,
                            verb: "post",
                            to: [p2],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) throw err;
                        act.checkRecipient(null, this);
                    },
                    cb
                );
            },
            "it works": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
            },
            "it returns true": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
                assert.isTrue(isRecipient);
            }
        },
        "and we check if a random user is a recipient of a public activity": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    Collection = require("../lib/model/collection").Collection,
                    cb = this.callback,
                    p1 = {
                        objectType: "person",
                        id: "urn:uuid:c123c0d0-e89a-11e1-89fa-0024beb67924"
                    },
                    p2 = {
                        objectType: "collection",
                        id: Collection.PUBLIC
                    },
                    p3 = {
                        objectType: "person",
                        id: "urn:uuid:c48045a0-e89a-11e1-a855-0024beb67924"
                    };

                Step(
                    function() {
                        var act = {
                            actor: p1,
                            verb: "post",
                            to: [p2],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) throw err;
                        act.checkRecipient(p3, this);
                    },
                    cb
                );
            },
            "it works": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
            },
            "it returns true": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
                assert.isTrue(isRecipient);
            }
        },
        "and we check if a random person is a recipient of a directed activity": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    cb = this.callback,
                    p1 = {
                        objectType: "person",
                        id: "urn:uuid:f931e182-e5ca-11e1-af82-70f1a154e1aa"
                    },
                    p2 = {
                        objectType: "person",
                        id: "urn:uuid:f9325900-e5ca-11e1-bbc3-70f1a154e1aa"
                    },
                    p3 = {
                        objectType: "person",
                        id: "urn:uuid:f932cd0e-e5ca-11e1-8e1e-70f1a154e1aa"
                    };

                Step(
                    function() {
                        var act = {
                            actor: p1,
                            verb: "post",
                            to: [p2],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) throw err;
                        act.checkRecipient(p3, this);
                    },
                    cb
                );
            },
            "it works": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
            },
            "it returns false": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
                assert.isFalse(isRecipient);
            }
        },
        "and we check if a list member is a recipient of an activity sent to a list": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    Collection = require("../lib/model/collection").Collection,
                    cb = this.callback,
                    user1,
                    user2,
                    list;
                

                Step(
                    function() {
                        var props1 = {
                            nickname: "pat",
                            password: "the*bunny"
                        },
                            props2 = {
                            nickname: "tap",
                            password: "i|would|tap|that"
                        };
                        User.create(props1, this.parallel());
                        User.create(props2, this.parallel());
                    },
                    function(err, result1, result2) {
                        if (err) throw err;
                        user1 = result1;
                        user2 = result2;
                        Collection.create({author: user1.profile,
                                           displayName: "Test 1",
                                           objectTypes: ["person"]},
                                          this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        list = result;
                        list.getStream(this);
                    },
                    function(err, stream) {
                        var val = {id: user2.profile.id,
                                   objectType: user2.profile.objectType};
                        if (err) throw err;
                        stream.deliverObject(val, this);
                    },
                    function(err) {
                        if (err) throw err;
                        var act = {
                            actor: user1.profile,
                            verb: "post",
                            to: [list],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) throw err;
                        act.checkRecipient(user2.profile, this);
                    },
                    cb
                );
            },
            "it works": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
            },
            "it returns true": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
                assert.isTrue(isRecipient);
            }
        },
        "and we check if a list non-member is a recipient of an activity sent to a list": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    Collection = require("../lib/model/collection").Collection,
                    cb = this.callback,
                    user1,
                    user2,
                    list;
                

                Step(
                    function() {
                        var props1 = {
                            nickname: "jim",
                            password: "dandy,fella"
                        },
                            props2 = {
                            nickname: "zed",
                            password: "is*dead,baby"
                        };
                        User.create(props1, this.parallel());
                        User.create(props2, this.parallel());
                    },
                    function(err, result1, result2) {
                        if (err) throw err;
                        user1 = result1;
                        user2 = result2;
                        Collection.create({author: user1.profile,
                                           displayName: "Test 1",
                                           objectTypes: ["person"]},
                                          this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        list = result;
                        var act = {
                            actor: user1.profile,
                            verb: "post",
                            to: [list],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) throw err;
                        act.checkRecipient(user2.profile, this);
                    },
                    cb
                );
            },
            "it works": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
            },
            "it returns false": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
                assert.isFalse(isRecipient);
            }
        },
        "and we check if a follower is a recipient of an activity sent to followers": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    cb = this.callback,
                    user1,
                    user2;
                

                Step(
                    function() {
                        var props1 = {
                            nickname: "robert",
                            password: "'srules!"
                        },
                            props2 = {
                            nickname: "kevin",
                            password: "*m1tn1ck*"
                        };
                        User.create(props1, this.parallel());
                        User.create(props2, this.parallel());
                    },
                    function(err, result1, result2) {
                        if (err) throw err;
                        user1 = result1;
                        user2 = result2;
                        user2.follow(user1, this);
                    },
                    function(err) {
                        if (err) throw err;
                        user1.profile.followersURL(this);
                    },
                    function(err, url) {
                        if (err) throw err;
                        if (!url) throw new Error("Bad URL");
                        var act = {
                            actor: user1.profile,
                            verb: "post",
                            to: [{
                                objectType: "collection",
                                id: url
                            }],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) throw err;
                        act.checkRecipient(user2.profile, this);
                    },
                    cb
                );
            },
            "it works": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
            },
            "it returns true": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
                assert.isTrue(isRecipient);
            }
        },
        "and we check if a non-follower is a recipient of an activity sent to followers": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    cb = this.callback,
                    user1,
                    user2;
                

                Step(
                    function() {
                        var props1 = {
                            nickname: "steve",
                            password: "mcqu33n."
                        },
                            props2 = {
                            nickname: "keith",
                            password: "r1ch4rds"
                        };
                        User.create(props1, this.parallel());
                        User.create(props2, this.parallel());
                    },
                    function(err, result1, result2) {
                        if (err) throw err;
                        user1 = result1;
                        user2 = result2;
                        user1.profile.followersURL(this);
                    },
                    function(err, url) {
                        if (err) throw err;
                        if (!url) throw new Error("Bad URL");
                        var act = {
                            actor: user1.profile,
                            verb: "post",
                            to: [{
                                objectType: "collection",
                                id: url
                            }],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) throw err;
                        act.checkRecipient(user2.profile, this);
                    },
                    cb
                );
            },
            "it works": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
            },
            "it returns false": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
                assert.isFalse(isRecipient);
            }
        },
        "and we check if a list non-member is a recipient of an activity sent to a list": {
            topic: function(Activity) {
                var User = require("../lib/model/user").User,
                    Collection = require("../lib/model/collection").Collection,
                    cb = this.callback,
                    user1,
                    user2,
                    list;
                

                Step(
                    function() {
                        var props1 = {
                            nickname: "jim",
                            password: "dee*dee*dee"
                        },
                            props2 = {
                            nickname: "zed",
                            password: "over*my*head"
                        };
                        User.create(props1, this.parallel());
                        User.create(props2, this.parallel());
                    },
                    function(err, result1, result2) {
                        if (err) throw err;
                        user1 = result1;
                        user2 = result2;
                        Collection.create({author: user1.profile,
                                           displayName: "Test 1",
                                           objectTypes: ["person"]},
                                          this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        list = result;
                        var act = {
                            actor: user1.profile,
                            verb: "post",
                            to: [list],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                        Activity.create(act, this);
                    },
                    function(err, act) {
                        if (err) throw err;
                        act.checkRecipient(user2.profile, this);
                    },
                    cb
                );
            },
            "it works": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
            },
            "it returns false": function(err, isRecipient) {
                assert.ifError(err);
                assert.isBoolean(isRecipient);
                assert.isFalse(isRecipient);
            }
        },
        "and we look for the post activity of a known object": {
            topic: function(Activity) {
                var Note = require("../lib/model/note").Note,
                    cb = this.callback,
                    p1 = {
                        objectType: "person",
                        id: "urn:uuid:bda39c62-e5d1-11e1-baf4-70f1a154e1aa"
                    },
                    act;

                Step(
                    function() {
                        act = new Activity({
                            actor: p1,
                            verb: Activity.POST,
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        });
                        act.apply(p1, this);
                    },
                    function(err) {
                        if (err) throw err;
                        act.save(this);
                    },
                    function(err, act) {
                        if (err) throw err;
                        Note.get(act.object.id, this);
                    },
                    function(err, note) {
                        if (err) throw err;
                        Activity.postOf(note, this);
                    },
                    function(err, found) {
                        cb(err, act, found);
                    }
                );
            },
            "it works": function(err, posted, found) {
                assert.ifError(err);
            },
            "it finds the right activity": function(err, posted, found) {
                assert.ifError(err);
                assert.isObject(posted);
                assert.isObject(found);
                assert.equal(posted.id, found.id);
            }
        },
        "and we look for the post activity of an unposted object": {
            topic: function(Activity) {
                var Note = require("../lib/model/note").Note,
                    cb = this.callback;

                Step(
                    function() {
                        Note.create({content: "Hello, world."}, this);
                    },
                    function(err, note) {
                        if (err) throw err;
                        Activity.postOf(note, this);
                    },
                    function(err, found) {
                        if (err) {
                            cb(err);
                        } else if (found) {
                            cb(new Error("Unexpected success"));
                        } else {
                            cb(null);
                        }
                    }
                );
            },
            "it works": function(err) {
                assert.ifError(err);
            }
        },
        "and we check if posting a note is major": {
            topic: function(Activity) {
                var act = new Activity({
                    id: "85931c96-fa24-11e1-8bf3-70f1a154e1aa",
                    actor: {
                        objectType: "person",
                        displayName: "A. Person",
                        id: "76c50ecc-fa24-11e1-bc3b-70f1a154e1aa"
                    },
                    verb: "post",
                    object: {
                        id: "aaf962f6-fa24-11e1-b0e6-70f1a154e1aa",
                        objectType: "note",
                        content: "Hello, world!"
                    }
                });
                return act.isMajor();
            },
            "it is major": function(isMajor) {
                assert.isTrue(isMajor);
            }
        },
        "and we check if favoriting a note is major": {
            topic: function(Activity) {
                var act = new Activity({
                    id: "076f1a4e-fa25-11e1-b51d-70f1a154e1aa",
                    actor: {
                        objectType: "person",
                        displayName: "A. Nother Person",
                        id: "100c05ea-fa25-11e1-a634-70f1a154e1aa"
                    },
                    verb: "favorite",
                    object: {
                        id: "237a9998-fa25-11e1-9444-70f1a154e1aa",
                        objectType: "note"
                    }
                });
                return act.isMajor();
            },
            "it is not major": function(isMajor) {
                assert.isFalse(isMajor);
            }
        },
        "and we check if posting a comment is major": {
            topic: function(Activity) {
                var act = new Activity({
                    id: "urn:uuid:076f1a4e-fa25-11e1-b51d-70f1a154e1aa",
                    actor: {
                        objectType: "person",
                        displayName: "Some Other Person",
                        id: "urn:uuid:4d895fe2-01f2-11e2-a185-70f1a154e1aa"
                    },
                    verb: "post",
                    object: {
                        id: "urn:uuid:5d09e0f4-01f2-11e2-aa15-70f1a154e1aa",
                        objectType: "comment"
                    }
                });
                return act.isMajor();
            },
            "it is not major": function(isMajor) {
                assert.isFalse(isMajor);
            }
        },
        "and we check if creating a list is major": {
            topic: function(Activity) {
                var act = new Activity({
                    id: "urn:uuid:385507e8-43dd-11e2-8e9b-2c8158efb9e9",
                    actor: {
                        objectType: "person",
                        displayName: "A. Nother Person",
                        id: "urn:uuid:79768f4e-43dd-11e2-8cbf-2c8158efb9e9"
                    },
                    verb: "create",
                    object: {
                        id: "urn:uuid:87cf740c-43dd-11e2-ae8a-2c8158efb9e9",
                        objectType: "collection",
                        objectTypes: ["person"]
                    }
                });
                return act.isMajor();
            },
            "it is not major": function(isMajor) {
                assert.isFalse(isMajor);
            }
        },
        "and we check if posting a list is major": {
            topic: function(Activity) {
                var act = new Activity({
                    id: "urn:uuid:8f45a5a8-43dd-11e2-a389-2c8158efb9e9",
                    actor: {
                        objectType: "person",
                        displayName: "A. Nother Person",
                        id: "urn:uuid:9444f0c2-43dd-11e2-ac26-2c8158efb9e9"
                    },
                    verb: "post",
                    object: {
                        id: "urn:uuid:9a6c6886-43dd-11e2-bd09-2c8158efb9e9",
                        objectType: "collection",
                        objectTypes: ["person"]
                    }
                });
                return act.isMajor();
            },
            "it is not major": function(isMajor) {
                assert.isFalse(isMajor);
            }
        },
        "and we check if creating an image is major": {
            topic: function(Activity) {
                var act = new Activity({
                    id: "urn:uuid:a5a0b220-43dd-11e2-9480-2c8158efb9e9",
                    actor: {
                        objectType: "person",
                        displayName: "A. Nother Person",
                        id: "urn:uuid:aa9a9e76-43dd-11e2-8974-2c8158efb9e9"
                    },
                    verb: "create",
                    object: {
                        id: "urn:uuid:b779f4a2-43dd-11e2-8714-2c8158efb9e9",
                        objectType: "image",
                        displayName: "My dog"
                    }
                });
                return act.isMajor();
            },
            "it is major": function(isMajor) {
                assert.isTrue(isMajor);
            }
        }
    }
});

var contentCheck = function(actor, verb, object, expected) {
    return {
        topic: function(Activity) {
            var callback = this.callback,
                Collection = require("../lib/model/collection").Collection,
                thePublic = {
                    objectType: "collection",
                    id: Collection.PUBLIC
                },
                act = new Activity({actor: actor,
                                    to: [thePublic],
                                    verb: verb,
                                    object: object});
            
            Step(
                function() {
                    // First, ensure recipients
                    act.ensureRecipients(this);
                },
                function(err) {
                    if (err) throw err;
                    // Then, apply the activity
                    act.apply(null, this);
                },
                function(err) {
                    if (err) throw err;
                    // Then, save the activity
                    act.save(this);
                },
                function(err, saved) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, act);
                    }
                }
            );
        },
        "it works": function(err, act) {
            assert.ifError(err);
        },
        "content is correct": function(err, act) {
            assert.ifError(err);
            assert.include(act, "content");
            assert.isString(act.content);
            assert.equal(act.content, expected);
        }
    };
};

suite.addBatch({
    "When we get the Activity class": {
        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {

                var mod;

                if (err) {
                    cb(err, null);
                    return;
                }

                DatabankObject.bank = db;
                
                mod = require("../lib/model/activity");

                if (!mod) {
                    cb(new Error("No module"), null);
                    return;
                }

                cb(null, mod.Activity);
            });
        },
        "it works": function(err, Activity) {
            assert.ifError(err);
            assert.isFunction(Activity);
        },
        "and a person with no url posts a note":
        contentCheck({objectType: "person",
                      id: "cbf1f0ca-2e10-11e2-8174-70f1a154e1aa",
                      displayName: "Jessie Belnap"},
                     "post",
                     {objectType: "note",
                      id: "f4f859a0-2e10-11e2-9af6-70f1a154e1aa",
                      content: "Hello, world."},
                     "Jessie Belnap posted a note"),
        "and a person with an url posts a note":
        contentCheck({objectType: "person",
                      id: "e67c969c-2e11-11e2-86dc-70f1a154e1aa",
                      url: "http://malloryfellman.example/",
                      displayName: "Mallory Fellman"},
                     "post",
                     {objectType: "note",
                      id: "a453c0fa-2e12-11e2-9214-70f1a154e1aa",
                      content: "Hello, world."},
                     "<a href='http://malloryfellman.example/'>Mallory Fellman</a> posted a note"),
        "and a person with no url plays a video":
        contentCheck({objectType: "person",
                      id: "6958bee6-2e13-11e2-be89-70f1a154e1aa",
                      displayName: "Mathew Penniman"},
                     "play",
                     {objectType: "video",
                      url: "http://www.youtube.com/watch?v=J---aiyznGQ",
                      displayName: "Keyboard Cat"},
                     "Mathew Penniman played <a href='http://www.youtube.com/watch?v=J---aiyznGQ'>Keyboard Cat</a>"),
        "and a person with no url closes a file":
        contentCheck({objectType: "person",
                      id: "5abbfc3a-2e14-11e2-b27c-70f1a154e1aa",
                      displayName: "Clayton Barto"},
                     "close",
                     {objectType: "file",
                      id: "8e5b739a-2e14-11e2-ab8e-70f1a154e1aa"},
                     "Clayton Barto closed a file"),
        "and a person posts a comment in reply to an image":
        contentCheck({objectType: "person",
                      id: "dc3c3572-2e14-11e2-91fc-70f1a154e1aa",
                      displayName: "Lorrie Tynan"},
                     "post",
                     {objectType: "comment",
                      id: "f58da61e-2e14-11e2-a207-70f1a154e1aa",
                      inReplyTo: {
                          objectType: "image",
                          id: "0d61105a-2e15-11e2-b6b4-70f1a154e1aa",
                          author: {
                              displayName: "Karina Cosenza",
                              id: "259e793c-2e15-11e2-b437-70f1a154e1aa",
                              objectType: "person"
                          }
                      }
                     },
                     "Lorrie Tynan posted a comment in reply to an image")
    }
});

// Test that adding a receiver works

suite.addBatch({
    "When we get the Activity class": {
        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {

                var mod;

                if (err) {
                    cb(err, null);
                    return;
                }

                DatabankObject.bank = db;
                
                mod = require("../lib/model/activity");

                if (!mod) {
                    cb(new Error("No module"), null);
                    return;
                }

                cb(null, mod.Activity);
            });
        },
        "it works": function(err, Activity) {
            assert.ifError(err);
            assert.isFunction(Activity);
        },
        "and we create an activity directed to a list": {
            topic: function(Activity) {
                var act = {
                    actor: {
                        id: "acct:juan@social.example",
                        objectType: "person"
                    },
                    to: [{objectType: "collection",
                          id: "http://social.example/api/collection/juan/friends"}],
                    verb: "post",
                    object: {
                        objectType: "note",
                        content: "Hello, world!"
                    }
                };

                Activity.create(act, this.callback);
            },
            "it works": function(err, activity) {
                assert.ifError(err);
            },
            "and we add another recipient": {
                topic: function(activity) {
                    var other = {
                        id: "acct:gerald@photo.example",
                        objectType: "person"
                    };
                    activity.addReceived(other, this.callback);
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we examine the activity": {
                    topic: function(activity) {
                        return activity;
                    },
                    "it has a _received property": function(activity) {
                        assert.isArray(activity._received);
                    },
                    "the _received property contains the value we added": function(activity) {
                        assert.isArray(activity._received);
                        assert.isObject(_.find(activity._received, function(item) {
                            return (item.id == "acct:gerald@photo.example" && item.objectType == "person");
                        }));
                    }
                },
                "and we check to see if the added person is a recipient": {
                    topic: function(activity) {
                        var other = {
                            id: "acct:gerald@photo.example",
                            objectType: "person"
                        };
                        activity.checkRecipient(other, this.callback);
                    },
                    "it works": function(err, isRecipient) {
                        assert.ifError(err);
                    },
                    "it is a recipient": function(err, isRecipient) {
                        assert.ifError(err);
                        assert.isTrue(isRecipient);
                    }
                },
                "and we get the list of recipients": {
                    topic: function(activity) {
                        return activity.recipients();
                    },
                    "our added object is a recipient": function(recipients) {
                        assert.isObject(_.find(recipients, function(item) {
                            return (item.id == "acct:gerald@photo.example" && item.objectType == "person");
                        }));
                    }
                }
            }
        }
    }
});

suite["export"](module);
