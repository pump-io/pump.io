// activity-test.js
//
// Test the activity module
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

var assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    _ = require("underscore"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    schema = require("../lib/schema").schema,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("activity module interface");

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
             "uuid",
             "updated",
             "verb"],
    indices: ["actor.id", "object.id", "uuid"]
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
    assert.isString(created.uuid);
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

            var params = {schema: schema};

            var db = Databank.get("memory", params);

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
                        User.create({nickname: "alice", password: "monkey"}, this);
                    },
                    function(err, alice) {
                        if (err) throw err;
                        users.alice = alice;
                        User.create({nickname: "bob", password: "bob123"}, this);
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
                        User.create({nickname: "charlie", password: "123456"}, this);
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
                            act.sanitize(user);
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
                assert.isFalse(act.hasOwnProperty("uuid"));
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
                        User.create({nickname: "david", password: "123456"}, this.parallel());
                        User.create({nickname: "ethel", password: "123456"}, this.parallel());
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
                            act.sanitize(user2);
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
                assert.isFalse(act.hasOwnProperty("uuid"));
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
                        User.create({nickname: "frank", password: "123456"}, this);
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
                assert.isFalse(act.hasOwnProperty("uuid"));
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
        "and we check if a random person is a recipient": {
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
        }
    }
});

suite["export"](module);
