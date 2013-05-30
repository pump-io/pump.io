// user-test.js
//
// Test the user module
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
    _ = require("underscore"),
    Step = require("step"),
    Activity = require("../lib/model/activity").Activity,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("user module interface");

var testSchema = {
    "pkey": "nickname",
    "fields": ["_passwordHash",
               "email",
               "published",
               "updated",
               "profile"],
    "indices": ["profile.id", "email"]};

var testData = {
    "create": {
        nickname: "evan",
        password: "Quie3ien",
        profile: {
            displayName: "Evan Prodromou"
        }
    },
    "update": {
        nickname: "evan",
        password: "correct horse battery staple" // the most secure password! see http://xkcd.com/936/
    }
};

// XXX: hack hack hack
// modelBatch hard-codes ActivityObject-style

var mb = modelBatch("user", "User", testSchema, testData);

mb["When we require the user module"]
["and we get its User class export"]
["and we create an user instance"]
["auto-generated fields are there"] = function(err, created) {
    assert.isString(created._passwordHash);
    assert.isString(created.published);
    assert.isString(created.updated);
};

mb["When we require the user module"]
["and we get its User class export"]
["and we create an user instance"]
["passed-in fields are there"] = function(err, created) {
    _.each(testData.create, function(value, key) {
        if (key == "profile") {
            _.each(testData.create.profile, function(value, key) {
                assert.deepEqual(created.profile[key], value);
            });
        } else {
            assert.deepEqual(created[key], value); 
        }
    });
};

suite.addBatch(mb);

suite.addBatch({
    "When we get the User class": {
        topic: function() {
            return require("../lib/model/user").User;
        },
        "it exists": function(User) {
            assert.isFunction(User);
        },
        "it has a fromPerson() method": function(User) {
            assert.isFunction(User.fromPerson);
        },
        "it has a checkCredentials() method": function(User) {
            assert.isFunction(User.checkCredentials);
        },
        "and we check the credentials for a non-existent user": {
            topic: function(User) {
                var cb = this.callback;
                User.checkCredentials("nosuchuser", "passw0rd", this.callback);
            },
            "it returns null": function(err, found) {
                assert.ifError(err);
                assert.isNull(found);
            }
        },
        "and we create a user": {
            topic: function(User) {
                var props = {
                    nickname: "tom",
                    password: "Xae3aiju"
                };
                User.create(props, this.callback);
            },
            teardown: function(user) {
                if (user && user.del) {
                    user.del(function(err) {});
                }
            },
            "it works": function(user) {
                assert.isObject(user);
            },
            "it has the sanitize() method": function(user) {
                assert.isFunction(user.sanitize);
            },
            "it has the getProfile() method": function(user) {
                assert.isFunction(user.getProfile);
            },
            "it has the getOutboxStream() method": function(user) {
                assert.isFunction(user.getOutboxStream);
            },
            "it has the getInboxStream() method": function(user) {
                assert.isFunction(user.getInboxStream);
            },
            "it has the getMajorOutboxStream() method": function(user) {
                assert.isFunction(user.getMajorOutboxStream);
            },
            "it has the getMajorInboxStream() method": function(user) {
                assert.isFunction(user.getMajorInboxStream);
            },
            "it has the getMinorOutboxStream() method": function(user) {
                assert.isFunction(user.getMinorOutboxStream);
            },
            "it has the getMinorInboxStream() method": function(user) {
                assert.isFunction(user.getMinorInboxStream);
            },
            "it has the getDirectInboxStream() method": function(user) {
                assert.isFunction(user.getDirectInboxStream);
            },
            "it has the getMinorDirectInboxStream() method": function(user) {
                assert.isFunction(user.getMinorDirectInboxStream);
            },
            "it has the getMajorDirectInboxStream() method": function(user) {
                assert.isFunction(user.getMajorDirectInboxStream);
            },
            "it has the getDirectMinorInboxStream() method": function(user) {
                assert.isFunction(user.getDirectMinorInboxStream);
            },
            "it has the getDirectMajorInboxStream() method": function(user) {
                assert.isFunction(user.getDirectMajorInboxStream);
            },
            "it has the getLists() method": function(user) {
                assert.isFunction(user.getLists);
            },
            "it has the expand() method": function(user) {
                assert.isFunction(user.expand);
            },
            "it has the addToOutbox() method": function(user) {
                assert.isFunction(user.addToOutbox);
            },
            "it has the addToInbox() method": function(user) {
                assert.isFunction(user.addToInbox);
            },
            "it has the getFollowers() method": function(user) {
                assert.isFunction(user.getFollowers);
            },
            "it has the getFollowing() method": function(user) {
                assert.isFunction(user.getFollowing);
            },
            "it has the followerCount() method": function(user) {
                assert.isFunction(user.followerCount);
            },
            "it has the followingCount() method": function(user) {
                assert.isFunction(user.followingCount);
            },
            "it has the follow() method": function(user) {
                assert.isFunction(user.follow);
            },
            "it has the stopFollowing() method": function(user) {
                assert.isFunction(user.stopFollowing);
            },
            "it has the addFollower() method": function(user) {
                assert.isFunction(user.addFollower);
            },
            "it has the addFollowing() method": function(user) {
                assert.isFunction(user.addFollowing);
            },
            "it has the removeFollower() method": function(user) {
                assert.isFunction(user.removeFollower);
            },
            "it has the removeFollowing() method": function(user) {
                assert.isFunction(user.removeFollowing);
            },
            "it has the addToFavorites() method": function(user) {
                assert.isFunction(user.addToFavorites);
            },
            "it has the removeFromFavorites() method": function(user) {
                assert.isFunction(user.removeFromFavorites);
            },
            "it has the favoritesStream() method": function(user) {
                assert.isFunction(user.favoritesStream);
            },
            "it has the uploadsStream() method": function(user) {
                assert.isFunction(user.uploadsStream);
            },
            "it has the followingStream() method": function(user) {
                assert.isFunction(user.followingStream);
            },
            "it has the followersStream() method": function(user) {
                assert.isFunction(user.followersStream);
            },
            "it has a profile attribute": function(user) {
                assert.isObject(user.profile);
                assert.instanceOf(user.profile, require("../lib/model/person").Person);
                assert.isString(user.profile.id);
            },
            "and we check the credentials with the right password": {
                topic: function(user, User) {
                    User.checkCredentials("tom", "Xae3aiju", this.callback);
                },
                "it works": function(err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                }
            },
            "and we check the credentials with the wrong password": {
                topic: function(user, User) {
                    var cb = this.callback;
                    User.checkCredentials("tom", "654321", this.callback);
                },
                "it returns null": function(err, found) {
                    assert.ifError(err);
                    assert.isNull(found);
                }
            },
            "and we try to retrieve it from the person id": {
                topic: function(user, User) {
                    User.fromPerson(user.profile.id, this.callback);
                },
                "it works": function(err, found) {
                    assert.ifError(err);
                    assert.isObject(found);
                    assert.equal(found.nickname, "tom");
                }
            },
            "and we try to get its profile": {
                topic: function(user) {
                    user.getProfile(this.callback);
                },
                "it works": function(err, profile) {
                    assert.ifError(err);
                    assert.isObject(profile);
                    assert.instanceOf(profile,
                                      require("../lib/model/person").Person);
                }
            }
        },
        "and we create a user and sanitize it": {
            topic: function(User) {
                var cb = this.callback,
                    props = {
                        nickname: "dick",
                        password: "Aaf7Ieki"
                    };
                    
                User.create(props, function(err, user) {
                    if (err) {
                        cb(err, null);
                    } else {
                        user.sanitize();
                        cb(null, user);
                    }
                });
            },
            teardown: function(user) {
                if (user) {
                    user.del(function(err) {});
                }
            },
            "it works": function(err, user) {
                assert.ifError(err);
                assert.isObject(user);
            },
            "it is sanitized": function(err, user) {
                assert.isFalse(_(user).has("password"));
                assert.isFalse(_(user).has("_passwordHash"));
            }
        },
        "and we create a new user and get its stream": {
            topic: function(User) {
                var cb = this.callback,
                    user = null,
                    props = {
                        nickname: "harry",
                        password: "Ai9AhSha"
                    };

                Step(
                    function() {
                        User.create(props, this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        user = results;
                        user.getOutboxStream(this);
                    },
                    function(err, outbox) {
                        if (err) throw err;
                        outbox.getIDs(0, 20, this);
                    },
                    function(err, ids) {
                        if (err) throw err;
                        Activity.readArray(ids, this);
                    },
                    function(err, activities) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(err, {user: user,
                                     activities: activities});
                        }
                    }
                );
            },
            teardown: function(results) {
                if (results) {
                    results.user.del(function(err) {});
                }
            },
            "it works": function(err, results) {
                assert.ifError(err);
                assert.isObject(results.user);
                assert.isArray(results.activities);
            },
            "it is empty": function(err, results) {
                assert.lengthOf(results.activities, 0);
            },
            "and we add an activity to its stream": {
                topic: function(results) {
                    var cb = this.callback,
                        user = results.user,
                        props = {
                            verb: "checkin",
                            object: {
                                objectType: "place",
                                displayName: "Les Folies",
                                url: "http://nominatim.openstreetmap.org/details.php?place_id=5001033",
                                position: "+45.5253965-73.5818537/",
                                address: {
                                    streetAddress: "701 Mont-Royal Est",
                                    locality: "Montreal",
                                    region: "Quebec",
                                    postalCode: "H2J 2T5"
                                }
                            }
                        },
                        Activity = require("../lib/model/activity").Activity,
                        act = new Activity(props);
                    
                    Step(
                        function() {
                            act.apply(user.profile, this);
                        },
                        function(err) {
                            if (err) throw err;
                            act.save(this);
                        },
                        function(err) {
                            if (err) throw err;
                            user.addToOutbox(act, this);
                        },
                        function(err) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, {user: user,
                                          activity: act});
                            }
                        }
                    );
                },
                "it works": function(err, results) {
                    assert.ifError(err);
                },
                "and we get the user stream": {
                    topic: function(results) {
                        var cb = this.callback,
                            user = results.user,
                            activity = results.activity;

                        Step(
                            function() {
                                user.getOutboxStream(this);
                            },
                            function(err, outbox) {
                                if (err) throw err;
                                outbox.getIDs(0, 20, this);
                            },
                            function(err, ids) {
                                if (err) throw err;
                                Activity.readArray(ids, this);
                            },
                            function(err, activities) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    cb(null, {user: user,
                                              activity: activity,
                                              activities: activities});
                                }
                            }
                        );
                    },
                    "it works": function(err, results) {
                        assert.ifError(err);
                        assert.isArray(results.activities);
                    },
                    "it includes the added activity": function(err, results) {
                        assert.lengthOf(results.activities, 1);
                        assert.equal(results.activities[0].id, results.activity.id);
                    }
                }
            }
        },
        "and we create a new user and get its lists stream": {
            topic: function(User) {
                var props = {
                        nickname: "gary",
                        password: "eiFoT2Va"
                    };
                Step(
                    function() {
                        User.create(props, this);
                    },
                    function(err, user) {
                        if (err) throw err;
                        user.getLists("person", this);
                    },
                    this.callback
                );
            },
            "it works": function(err, stream) {
                assert.ifError(err);
                assert.isObject(stream);
            },
            "and we get the count of lists": {
                topic: function(stream) {
                    stream.count(this.callback);
                },
                "it is zero": function(err, count) {
                    assert.ifError(err);
                    assert.equal(count, 0);
                }
            },
            "and we get the first few lists": {
                topic: function(stream) {
                    stream.getItems(0, 20, this.callback);
                },
                "it is an empty list": function(err, ids) {
                    assert.ifError(err);
                    assert.isArray(ids);
                    assert.lengthOf(ids, 0);
                }
            }
        },
        "and we create a new user and get its galleries stream": {
            topic: function(User) {
                var props = {
                        nickname: "chumwick",
                        password: "eiFoT2Va"
                    };
                Step(
                    function() {
                        User.create(props, this);
                    },
                    function(err, user) {
                        if (err) throw err;
                        user.getLists("image", this);
                    },
                    this.callback
                );
            },
            "it works": function(err, stream) {
                assert.ifError(err);
                assert.isObject(stream);
            },
            "and we get the count of lists": {
                topic: function(stream) {
                    stream.count(this.callback);
                },
                "it is five": function(err, count) {
                    assert.ifError(err);
                    assert.equal(count, 1);
                }
            },
            "and we get the first few lists": {
                topic: function(stream) {
                    stream.getItems(0, 20, this.callback);
                },
                "it is a single-element list": function(err, ids) {
                    assert.ifError(err);
                    assert.isArray(ids);
                    assert.lengthOf(ids, 1);
                }
            }
        },
        "and we create a new user and get its inbox": {
            topic: function(User) {
                var cb = this.callback,
                    user = null,
                    props = {
                        nickname: "maurice",
                        password: "cappadoccia1"
                    };

                Step(
                    function() {
                        User.create(props, this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        user = results;
                        user.getInboxStream(this);
                    },
                    function(err, inbox) {
                        if (err) throw err;
                        inbox.getIDs(0, 20, this);
                    },
                    function(err, ids) {
                        if (err) throw err;
                        Activity.readArray(ids, this);
                    },
                    function(err, activities) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(err, {user: user,
                                     activities: activities});
                        }
                    }
                );
            },
            teardown: function(results) {
                if (results) {
                    results.user.del(function(err) {});
                }
            },
            "it works": function(err, results) {
                assert.ifError(err);
                assert.isObject(results.user);
                assert.isArray(results.activities);
            },
            "it is empty": function(err, results) {
                assert.lengthOf(results.activities, 0);
            },
            "and we add an activity to its inbox": {
                topic: function(results) {
                    var cb = this.callback,
                        user = results.user,
                        props = {
                            actor: {
                                id: "urn:uuid:8f7be1de-3f48-4a54-bf3f-b4fc18f3ae77",
                                objectType: "person",
                                displayName: "Abraham Lincoln"
                            },
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "Remember to get eggs, bread, and milk."
                            }
                        },
                        Activity = require("../lib/model/activity").Activity,
                        act = new Activity(props);
                    
                    Step(
                        function() {
                            act.apply(user.profile, this);
                        },
                        function(err) {
                            if (err) throw err;
                            act.save(this);
                        },
                        function(err) {
                            if (err) throw err;
                            user.addToInbox(act, this);
                        },
                        function(err) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, {user: user,
                                          activity: act});
                            }
                        }
                    );
                },
                "it works": function(err, results) {
                    assert.ifError(err);
                },
                "and we get the user inbox": {
                    topic: function(results) {
                        var cb = this.callback,
                            user = results.user,
                            activity = results.activity;

                        Step(
                            function() {
                                user.getInboxStream(this);
                            },
                            function(err, inbox) {
                                if (err) throw err;
                                inbox.getIDs(0, 20, this);
                            },
                            function(err, ids) {
                                if (err) throw err;
                                Activity.readArray(ids, this);
                            },
                            function(err, activities) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    cb(null, {user: user,
                                              activity: activity,
                                              activities: activities});
                                }
                            }
                        );
                    },
                    "it works": function(err, results) {
                        assert.ifError(err);
                        assert.isArray(results.activities);
                    },
                    "it includes the added activity": function(err, results) {
                        assert.lengthOf(results.activities, 1);
                        assert.equal(results.activities[0].id, results.activity.id);
                    }
                }
            }
        },
        "and we create a pair of users": {
            topic: function(User) {
                var cb = this.callback;
                Step(
                    function() {
                        User.create({nickname: "shields", password: "1walk1nTheWind"}, this.parallel());
                        User.create({nickname: "yarnell", password: "1Mpull1ngArope"}, this.parallel());
                    },
                    function(err, shields, yarnell) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, {shields: shields, yarnell: yarnell});
                        }
                    }
                );
            },
            "it works": function(err, users) {
                assert.ifError(err);
            },
            "and we make one follow the other": {
                topic: function(users) {
                    users.shields.follow(users.yarnell, this.callback);
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we check the first user's following list": {
                    topic: function(users) {
                        var cb = this.callback;
                        users.shields.getFollowing(0, 20, function(err, following) {
                            cb(err, following, users.yarnell);
                        });
                    },
                    "it works": function(err, following, other) {
                        assert.ifError(err);
                        assert.isArray(following);
                    },
                    "it is the right size": function(err, following, other) {
                        assert.ifError(err);
                        assert.lengthOf(following, 1);
                    },
                    "it has the right data": function(err, following, other) {
                        assert.ifError(err);
                        assert.equal(following[0].id, other.profile.id);
                    }
                },
                "and we check the first user's following count": {
                    topic: function(users) {
                        users.shields.followingCount(this.callback);
                    },
                    "it works": function(err, fc) {
                        assert.ifError(err);
                    },
                    "it is correct": function(err, fc) {
                        assert.ifError(err);
                        assert.equal(fc, 1);
                    }
                },
                "and we check the second user's followers list": {
                    topic: function(users) {
                        var cb = this.callback;
                        users.yarnell.getFollowers(0, 20, function(err, following) {
                            cb(err, following, users.shields);
                        });
                    },
                    "it works": function(err, followers, other) {
                        assert.ifError(err);
                        assert.isArray(followers);
                    },
                    "it is the right size": function(err, followers, other) {
                        assert.ifError(err);
                        assert.lengthOf(followers, 1);
                    },
                    "it has the right data": function(err, followers, other) {
                        assert.ifError(err);
                        assert.equal(followers[0].id, other.profile.id);
                    }
                },
                "and we check the second user's followers count": {
                    topic: function(users) {
                        users.yarnell.followerCount(this.callback);
                    },
                    "it works": function(err, fc) {
                        assert.ifError(err);
                    },
                    "it is correct": function(err, fc) {
                        assert.ifError(err);
                        assert.equal(fc, 1);
                    }
                }
            }
        },
        "and we create another pair of users following": {
            topic: function(User) {
                var cb = this.callback,
                    users = {};
                Step(
                    function() {
                        User.create({nickname: "captain", password: "b34chboyW/AHat"}, this.parallel());
                        User.create({nickname: "tenille", password: "Muskr4t|Sus13"}, this.parallel());
                    },
                    function(err, captain, tenille) {
                        if (err) throw err;
                        users.captain = captain;
                        users.tenille = tenille;
                        captain.follow(tenille, this);
                    },
                    function(err) {
                        if (err) throw err;
                        users.captain.stopFollowing(users.tenille, this);
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
            "it works": function(err, users) {
                assert.ifError(err);
            },
            "and we check the first user's following list": {
                topic: function(users) {
                    var cb = this.callback;
                    users.captain.getFollowing(0, 20, this.callback);
                },
                "it works": function(err, following, other) {
                    assert.ifError(err);
                    assert.isArray(following);
                },
                "it is the right size": function(err, following, other) {
                    assert.ifError(err);
                    assert.lengthOf(following, 0);
                }
            },
            "and we check the first user's following count": {
                topic: function(users) {
                    users.captain.followingCount(this.callback);
                },
                "it works": function(err, fc) {
                    assert.ifError(err);
                },
                "it is correct": function(err, fc) {
                    assert.ifError(err);
                    assert.equal(fc, 0);
                }
            },
            "and we check the second user's followers list": {
                topic: function(users) {
                    users.tenille.getFollowers(0, 20, this.callback);
                },
                "it works": function(err, followers, other) {
                    assert.ifError(err);
                    assert.isArray(followers);
                },
                "it is the right size": function(err, followers, other) {
                    assert.ifError(err);
                    assert.lengthOf(followers, 0);
                }
            },
            "and we check the second user's followers count": {
                topic: function(users) {
                    users.tenille.followerCount(this.callback);
                },
                "it works": function(err, fc) {
                    assert.ifError(err);
                },
                "it is correct": function(err, fc) {
                    assert.ifError(err);
                    assert.equal(fc, 0);
                }
            }
        },
        "and one user follows another twice": {
            topic: function(User) {
                var cb = this.callback,
                    users = {};
                Step(
                    function() {
                        User.create({nickname: "boris", password: "squirrel"}, this.parallel());
                        User.create({nickname: "natasha", password: "moose"}, this.parallel());
                    },
                    function(err, boris, natasha) {
                        if (err) throw err;
                        users.boris = boris;
                        users.natasha = natasha;
                        users.boris.follow(users.natasha, this);
                    },
                    function(err) {
                        if (err) throw err;
                        users.boris.follow(users.natasha, this);
                    },
                    function(err) {
                        if (err) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    }
                );
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and one user stops following a user they never followed": {
            topic: function(User) {
                var cb = this.callback,
                    users = {};
                Step(
                    function() {
                        User.create({nickname: "rocky", password: "flying"}, this.parallel());
                        User.create({nickname: "bullwinkle", password: "rabbit"}, this.parallel());
                    },
                    function(err, rocky, bullwinkle) {
                        if (err) throw err;
                        users.rocky = rocky;
                        users.bullwinkle = bullwinkle;
                        users.rocky.stopFollowing(users.bullwinkle, this);
                    },
                    function(err) {
                        if (err) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    }
                );
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we create a bunch of users": {
            topic: function(User) {
                var cb = this.callback,
                    MAX_USERS = 50;

                Step(
                    function() {
                        var i, group = this.group();
                        for (i = 0; i < MAX_USERS; i++) {
                            User.create({nickname: "clown"+i, password: "Ha6quo6I" + i}, group());
                        }
                    },
                    function(err, users) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, users);
                        }
                    }
                );
            },
            "it works": function(err, users) {
                assert.ifError(err);
                assert.isArray(users);
                assert.lengthOf(users, 50);
            },
            "and they all follow someone": {
                topic: function(users) {
                    var cb = this.callback,
                        MAX_USERS = 50;

                    Step(
                        function() {
                            var i, group = this.group();
                            for (i = 1; i < users.length; i++) {
                                users[i].follow(users[0], group());
                            }
                        },
                        function(err) {
                            cb(err);
                        }
                    );
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we check the followed user's followers list": {
                    topic: function(users) {
                        users[0].getFollowers(0, users.length + 1, this.callback);
                    },
                    "it works": function(err, followers) {
                        assert.ifError(err);
                        assert.isArray(followers);
                        assert.lengthOf(followers, 49);
                    }
                },
                "and we check the followed user's followers count": {
                    topic: function(users) {
                        users[0].followerCount(this.callback);
                    },
                    "it works": function(err, fc) {
                        assert.ifError(err);
                    },
                    "it is correct": function(err, fc) {
                        assert.ifError(err);
                        assert.equal(fc, 49);
                    }
                },
                "and we check the following users' following lists": {
                    topic: function(users) {
                        var cb = this.callback,
                            MAX_USERS = 50;

                        Step(
                            function() {
                                var i, group = this.group();
                                for (i = 1; i < users.length; i++) {
                                    users[i].getFollowing(0, 20, group());
                                }
                            },
                            cb
                        );
                    },
                    "it works": function(err, lists) {
                        var i;
                        assert.ifError(err);
                        assert.isArray(lists);
                        assert.lengthOf(lists, 49);
                        for (i = 0; i < lists.length; i++) {
                            assert.isArray(lists[i]);
                            assert.lengthOf(lists[i], 1);
                        }
                    }
                },
                "and we check the following users' following counts": {
                    topic: function(users) {
                        var cb = this.callback,
                            MAX_USERS = 50;

                        Step(
                            function() {
                                var i, group = this.group();
                                for (i = 1; i < users.length; i++) {
                                    users[i].followingCount(group());
                                }
                            },
                            cb
                        );
                    },
                    "it works": function(err, counts) {
                        var i;
                        assert.ifError(err);
                        assert.isArray(counts);
                        assert.lengthOf(counts, 49);
                        for (i = 0; i < counts.length; i++) {
                            assert.equal(counts[i], 1);
                        }
                    }
                }
            }
        }
    }
});

var emptyStreamContext = function(streamgetter) {
    return {
        topic: function(user) {
            var callback = this.callback;
            Step(
                function() {
                    streamgetter(user, this);
                },
                function(err, str) {
                    if (err) throw err;
                    str.getIDs(0, 20, this);
                },
                callback
            );
        },
        "it's empty": function(err, activities) {
            assert.ifError(err);
            assert.isEmpty(activities);
        }
    };
};

var streamCountContext = function(streamgetter, targetCount) {
    var ctx = {
        topic: function(act, user) {
            var callback = this.callback;
            Step(
                function() {
                    streamgetter(user, this);
                },
                function(err, str) {
                    if (err) throw err;
                    str.getIDs(0, 20, this);
                },
                function(err, activities) {
                    callback(err, act, activities);
                }
            );
        }
    },
    label = (targetCount > 0) ? "it's in there" : "it's not in there";

    ctx[label] = function(err, act, activities) {
        var matches;
        assert.ifError(err);
        assert.isObject(act);
        assert.isArray(activities);
        matches = activities.filter(function(item) {
            return (item == act.id);
        });
        assert.lengthOf(matches, targetCount);
    };

    return ctx;
};

var inStreamContext = function(streamgetter) {
    return streamCountContext(streamgetter, 1);
};

var notInStreamContext = function(streamgetter) {
    return streamCountContext(streamgetter, 0);
};

// Tests for major, minor streams

suite.addBatch({
    "When we create a new user": {
        topic: function() {
            var User = require("../lib/model/user").User,
                props = {
                    nickname: "archie",
                    password: "B0Y|the/way|Glenn+Miller|played"
                };
            User.create(props, this.callback);
        },
        "it works": function(err, user) {
            assert.ifError(err);
        },
        "and we check their minor inbox": 
        emptyStreamContext(function(user, callback) {
            user.getMinorInboxStream(callback);
        }),
        "and we check their minor outbox": 
        emptyStreamContext(function(user, callback) {
            user.getMinorOutboxStream(callback);
        }),
        "and we check their major inbox": 
        emptyStreamContext(function(user, callback) {
            user.getMajorInboxStream(callback);
        }),
        "and we check their major inbox": 
        emptyStreamContext(function(user, callback) {
            user.getMajorOutboxStream(callback);
        })
    },
    "When we create another user": {
        topic: function() {
            var User = require("../lib/model/user").User,
                props = {
                    nickname: "edith",
                    password: "s0ngz|that|made|Th3|h1t|P4r4de"
                };
            User.create(props, this.callback);
        },
        "it works": function(err, user) {
            assert.ifError(err);
        },
        "and we add a major activity": {
            topic: function(user) {
                var act,
                    props = {
                        actor: user.profile,
                        verb: "post",
                        object: {
                            objectType: "note",
                            content: "Cling peaches"
                        }
                    },
                    callback = this.callback;

                Step(
                    function() {
                        Activity.create(props, this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        act = result;
                        user.addToInbox(act, this.parallel());
                        user.addToOutbox(act, this.parallel());
                    },
                    function(err) {
                        if (err) {
                            callback(err, null, null);
                        } else {
                            callback(null, act, user);
                        }
                    }
                );
            },
            "it works": function(err, activity, user) {
                assert.ifError(err);
            },
            "and we check their minor inbox": 
            notInStreamContext(function(user, callback) {
                user.getMinorInboxStream(callback);
            }),
            "and we check their minor outbox": 
            notInStreamContext(function(user, callback) {
                user.getMinorOutboxStream(callback);
            }),
            "and we check their major inbox":
            inStreamContext(function(user, callback) {
                user.getMajorInboxStream(callback);
            }),
            "and we check their major outbox":
            inStreamContext(function(user, callback) {
                user.getMajorOutboxStream(callback);
            })
        }
    },
    "When we create yet another user": {
        topic: function() {
            var User = require("../lib/model/user").User,
                props = {
                    nickname: "gloria",
                    password: "0h,d4DDY!"
                };
            User.create(props, this.callback);
        },
        "it works": function(err, user) {
            assert.ifError(err);
        },
        "and we add a minor activity": {
            topic: function(user) {
                var act,
                    props = {
                        actor: user.profile,
                        verb: "favorite",
                        object: {
                            objectType: "image",
                            id: "3740ed6e-fa2b-11e1-9287-70f1a154e1aa"
                        }
                    },
                    callback = this.callback;

                Step(
                    function() {
                        Activity.create(props, this);
                    },
                    function(err, result) {
                        if (err) throw err;
                        act = result;
                        user.addToInbox(act, this.parallel());
                        user.addToOutbox(act, this.parallel());
                    },
                    function(err) {
                        if (err) {
                            callback(err, null, null);
                        } else {
                            callback(null, act, user);
                        }
                    }
                );
            },
            "it works": function(err, activity, user) {
                assert.ifError(err);
            },
            "and we check their minor inbox": 
            inStreamContext(function(user, callback) {
                user.getMinorInboxStream(callback);
            }),
            "and we check their minor outbox": 
            inStreamContext(function(user, callback) {
                user.getMinorOutboxStream(callback);
            }),
            "and we check their major inbox":
            notInStreamContext(function(user, callback) {
                user.getMajorInboxStream(callback);
            }),
            "and we check their major outbox":
            notInStreamContext(function(user, callback) {
                user.getMajorOutboxStream(callback);
            })
        }
    }
});

// Test user nickname rules

var goodNickname = function(nickname) {
    return {
        topic: function() {
            var User = require("../lib/model/user").User,
                props = {
                    nickname: nickname,
                    password: "Kei1goos"
                };
            User.create(props, this.callback);
        },
        "it works": function(err, user) {
            assert.ifError(err);
            assert.isObject(user);
        },
        "the nickname is correct": function(err, user) {
            assert.ifError(err);
            assert.isObject(user);
            assert.equal(nickname, user.nickname);
        }
    };
};

var badNickname = function(nickname) {
    return {
        topic: function() {
            var User = require("../lib/model/user").User,
                props = {
                    nickname: nickname,
                    password: "AQuah5co"
                },
                callback = this.callback;
            User.create(props, function(err, user) {
                if (err && err instanceof User.BadNicknameError) {
                    callback(null);
                } else {
                    callback(new Error("Unexpected success"));
                }
            });
        },
        "it fails correctly": function(err) {
            assert.ifError(err);
        }
    };
};

suite.addBatch({
    "When we create a new user with a long nickname less than 64 chars": 
    goodNickname("james_james_morrison_morrison_weatherby_george_dupree"),
    "When we create a user with a nickname with a -": 
    goodNickname("captain-caveman"),
    "When we create a user with a nickname with a _": 
    goodNickname("captain_caveman"),
    "When we create a user with a nickname with a .": 
    goodNickname("captain.caveman"),
    "When we create a user with a nickname with capital letters": 
    goodNickname("CaptainCaveman"),
    "When we create a user with a nickname with one char": 
    goodNickname("c"),
    "When we create a new user with a nickname longer than 64 chars": 
    badNickname("adolphblainecharlesdavidearlfrederickgeraldhubertirvimjohn"+
                "kennethloydmartinnerooliverpaulquincyrandolphshermanthomasuncas"+
                "victorwillianxerxesyancyzeus"),
    "When we create a new user with a nickname with a forbidden character": 
    badNickname("arnold/palmer"),
    "When we create a new user with a nickname with a blank": 
    badNickname("Captain Caveman"),
    "When we create a new user with an empty nickname": 
    badNickname(""),
    "When we create a new user with nickname 'api'": 
    badNickname("api"),
    "When we create a new user with nickname 'oauth'": 
    badNickname("oauth")
});

var activityMakerContext = function(maker, rest) {

    var ctx = {

        topic: function(toUser, fromUser) {
            var Activity = require("../lib/model/activity").Activity,
                callback = this.callback,
                theAct;

            Step(
                function() {
                    var act = maker(toUser, fromUser);
                    Activity.create(act, this);
                },
                function(err, act) {
                    if (err) throw err;
                    theAct = act;
                    toUser.addToInbox(act, this);
                },
                function(err) {
                    callback(err, theAct);
                }
            );
        },
        "it works": function(err, act) {
            assert.ifError(err);
            assert.isObject(act);
        }
    };

    _.extend(ctx, rest);

    return ctx;
};

// Tests for direct, direct-major, and direct-minor streams

suite.addBatch({
    "When we get the User class": {
        topic: function() {
            return require("../lib/model/user").User;
        },
        "it works": function(User) {
            assert.isFunction(User);
        },
        "and we create a new user": {
            topic: function(User) {
                var props = {
                    nickname: "george",
                    password: "moving-on-up"
                };
                User.create(props, this.callback);
            },
            "it works": function(err, user) {
                assert.ifError(err);
            },
            "and we check their direct inbox": 
            emptyStreamContext(function(user, callback) {
                user.getDirectInboxStream(callback);
            }),
            "and we check their direct minor inbox":
            emptyStreamContext(function(user, callback) {
                user.getMinorDirectInboxStream(callback);
            }),
            "and we check their direct major inbox":
            emptyStreamContext(function(user, callback) {
                user.getMajorDirectInboxStream(callback);
            })
        },
        "and we create a pair of users": {
            topic: function(User) {
                var props1 = {
                    nickname: "louise",
                    password: "moving-on-up2"
                },
                    props2 = {
                        nickname: "florence",
                        password: "maid/up1"
                    };
                Step(
                    function() {
                        User.create(props2, this.parallel());
                        User.create(props1, this.parallel());
                    },
                    this.callback
                );
            },
            "it works": function(err, toUser, fromUser) {
                assert.ifError(err);
                assert.isObject(fromUser);
                assert.isObject(toUser);
            },
            "and one user sends a major activity to the other": 
            activityMakerContext(
                function(toUser, fromUser) {
                    return {
                        actor: fromUser.profile,
                        to: [toUser.profile],
                        verb: "post",
                        object: {
                            objectType: "note",
                            content: "Please get the door"
                        }
                    };
                },
                {
                    "and we check the recipient's direct inbox": 
                    inStreamContext(function(user, callback) {
                        user.getDirectInboxStream(callback);
                    }),
                    "and we check the recipient's direct minor inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectMinorInboxStream(callback);
                    }),
                    "and we check the recipient's direct major inbox": 
                    inStreamContext(function(user, callback) {
                        user.getDirectMajorInboxStream(callback);
                    })
                }),
            "and one user sends a minor activity to the other": 
            activityMakerContext(
                function(toUser, fromUser) {
                    return {
                        actor: fromUser.profile,
                        to: [toUser.profile],
                        verb: "favorite",
                        object: {
                            id: "urn:uuid:c6591278-0418-11e2-ade3-70f1a154e1aa",
                            objectType: "audio"
                        }
                    };
                },
                {
                    "and we check the recipient's direct inbox": 
                    inStreamContext(function(user, callback) {
                        user.getDirectInboxStream(callback);
                    }),
                    "and we check the recipient's direct minor inbox": 
                    inStreamContext(function(user, callback) {
                        user.getDirectMinorInboxStream(callback);
                    }),
                    "and we check the recipient's direct major inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectMajorInboxStream(callback);
                    })
                }),
            "and one user sends a major activity bto the other": 
            activityMakerContext(
                function(toUser, fromUser) {
                    return {
                        actor: fromUser.profile,
                        bto: [toUser.profile],
                        verb: "post",
                        object: {
                            objectType: "note",
                            content: "Please wash George's underwear."
                        }
                    };
                },
                {
                    "and we check the recipient's direct inbox": 
                    inStreamContext(function(user, callback) {
                        user.getDirectInboxStream(callback);
                    }),
                    "and we check the recipient's direct minor inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectMinorInboxStream(callback);
                    }),
                    "and we check the recipient's direct major inbox": 
                    inStreamContext(function(user, callback) {
                        user.getDirectMajorInboxStream(callback);
                    })
                }),
            "and one user sends a minor activity bto the other": 
            activityMakerContext(
                function(toUser, fromUser) {
                    return {
                        actor: fromUser.profile,
                        bto: [toUser.profile],
                        verb: "favorite",
                        object: {
                            id: "urn:uuid:5982b964-0414-11e2-8ced-70f1a154e1aa",
                            objectType: "service"
                        }
                    };
                },
                {
                    "and we check the recipient's direct inbox": 
                    inStreamContext(function(user, callback) {
                        user.getDirectInboxStream(callback);
                    }),
                    "and we check the recipient's direct minor inbox": 
                    inStreamContext(function(user, callback) {
                        user.getDirectMinorInboxStream(callback);
                    }),
                    "and we check the recipient's direct major inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectMajorInboxStream(callback);
                    })
                }),
            "and one user sends a minor activity to the public":
            activityMakerContext(
                function(toUser, fromUser) {
                    return {
                        actor: fromUser.profile,
                        to: [{
                            id: "http://activityschema.org/collection/public",
                            objectType: "collection"
                        }],
                        verb: "favorite",
                        object: {
                            id: "urn:uuid:0e6b0f90-0413-11e2-84fb-70f1a154e1aa",
                            objectType: "video"
                        }
                    };
                },
                {
                    "and we check the other user's direct inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectInboxStream(callback);
                    }),
                    "and we check the other user's direct minor inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectMinorInboxStream(callback);
                    }),
                    "and we check the other user's direct major inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectMajorInboxStream(callback);
                    })
                }
            ),
            "and one user sends a major activity and cc's the other":
            activityMakerContext(
                function(toUser, fromUser) {
                    return {
                        actor: fromUser.profile,
                        cc: [toUser.profile],
                        verb: "post",
                        object: {
                            id: "I'm tired.",
                            objectType: "note"
                        }
                    };
                },
                {
                    "and we check the other user's direct inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectInboxStream(callback);
                    }),
                    "and we check the other user's direct minor inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectMinorInboxStream(callback);
                    }),
                    "and we check the other user's direct major inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectMajorInboxStream(callback);
                    })
                }
            ),
            "and one user sends a major activity and bcc's the other":
            activityMakerContext(
                function(toUser, fromUser) {
                    return {
                        actor: fromUser.profile,
                        bcc: [toUser.profile],
                        verb: "post",
                        object: {
                            id: "It's hot.",
                            objectType: "note"
                        }
                    };
                },
                {
                    "and we check the other user's direct inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectInboxStream(callback);
                    }),
                    "and we check the other user's direct minor inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectMinorInboxStream(callback);
                    }),
                    "and we check the other user's direct major inbox": 
                    notInStreamContext(function(user, callback) {
                        user.getDirectMajorInboxStream(callback);
                    })
                }
            )
        }
    }
});

suite.addBatch({
    "When we get the User class": {
        topic: function() {
            return require("../lib/model/user").User;
        },
        "it works": function(User) {
            assert.isFunction(User);
        },
        "and we create a new user": {
            topic: function(User) {
                var props = {
                    nickname: "whatever",
                    password: "no-energy"
                };
                User.create(props, this.callback);
            },
            "it works": function(err, user) {
                assert.ifError(err);
            },
            "and we check their direct inbox": 
            emptyStreamContext(function(user, callback) {
                user.uploadsStream(callback);
            })
        }
    }
});

// Test followersStream, followingStream

suite.addBatch({
    "When we get the User class": {
        topic: function() {
            return require("../lib/model/user").User;
        },
        "it works": function(User) {
            assert.isFunction(User);
        },
        "and we create a new user": {
            topic: function(User) {
                var props = {
                    nickname: "booboo",
                    password: "my-daughters-furbie"
                };
                User.create(props, this.callback);
            },
            "it works": function(err, user) {
                assert.ifError(err);
            },
            "and we check their following stream": 
            emptyStreamContext(function(user, callback) {
                user.followingStream(callback);
            }),
            "and we check their followers stream": 
            emptyStreamContext(function(user, callback) {
                user.followersStream(callback);
            })
        }
    }
});

suite["export"](module);
