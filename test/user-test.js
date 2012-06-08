// user-test.js
//
// Test the user module
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

var assert = require('assert'),
    vows = require('vows'),
    databank = require('databank'),
    _ = require('underscore'),
    Step = require('step'),
    modelBatch = require('./lib/model').modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe('user module interface');

var testSchema = {
    'pkey': 'nickname',
    'fields': ['passwordHash',
               'published',
               'updated',
               'profile'],
    'indices': ['profile.id']};

var testData = {
    'create': {
        nickname: "evan",
        password: "trustno1",
        profile: {
            displayName: "Evan Prodromou"
        }
    },
    'update': {
        nickname: "evan",
        password: "correct horse battery staple" // the most secure password! see http://xkcd.com/936/
    }
};

// XXX: hack hack hack
// modelBatch hard-codes ActivityObject-style

var mb = modelBatch('user', 'User', testSchema, testData);

mb['When we require the user module']
['and we get its User class export']
['and we create an user instance']
['auto-generated fields are there'] = function(err, created) {
    assert.isString(created.passwordHash);
    assert.isString(created.published);
    assert.isString(created.updated);
};

suite.addBatch(mb);

suite.addBatch({
    'When we get the User class': {
        topic: function() {
            return require('../lib/model/user').User;
        },
        'it exists': function(User) {
            assert.isFunction(User);
        },
        'it has a fromPerson() method': function(User) {
            assert.isFunction(User.fromPerson);
        },
        'it has a checkCredentials() method': function(User) {
            assert.isFunction(User.checkCredentials);
        },
        'and we check the credentials for a non-existent user': {
            topic: function(User) {
                var cb = this.callback;
                User.checkCredentials('nosuchuser', 'passw0rd', this.callback);
            },
            'it returns null': function(err, found) {
                assert.ifError(err);
                assert.isNull(found);
            }
        },
        'and we create a user': {
            topic: function(User) {
                var props = {
                    nickname: 'tom',
                    password: '123456'
                };
                User.create(props, this.callback);
            },
            teardown: function(user) {
                if (user && user.del) {
                    user.del(function(err) {});
                }
            },
            'it works': function(user) {
                assert.isObject(user);
            },
            'it has the sanitize() method': function(user) {
                assert.isFunction(user.sanitize);
            },
            'it has the getProfile() method': function(user) {
                assert.isFunction(user.getProfile);
            },
            'it has the getStream() method': function(user) {
                assert.isFunction(user.getStream);
            },
            'it has the getInbox() method': function(user) {
                assert.isFunction(user.getInbox);
            },
            'it has the expand() method': function(user) {
                assert.isFunction(user.expand);
            },
            'it has the addToOutbox() method': function(user) {
                assert.isFunction(user.addToOutbox);
            },
            'it has the addToInbox() method': function(user) {
                assert.isFunction(user.addToInbox);
            },
            'it has the getFollowers() method': function(user) {
                assert.isFunction(user.getFollowers);
            },
            'it has the getFollowing() method': function(user) {
                assert.isFunction(user.getFollowing);
            },
            'it has the follow() method': function(user) {
                assert.isFunction(user.follow);
            },
            'it has the stopFollowing() method': function(user) {
                assert.isFunction(user.stopFollowing);
            },
            'and we check the credentials with the right password': {
                topic: function(user, User) {
                    User.checkCredentials('tom', '123456', this.callback);
                },
                'it works': function(err, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                }
            },
            'and we check the credentials with the wrong password': {
                topic: function(user, User) {
                    var cb = this.callback;
                    User.checkCredentials('tom', '654321', this.callback);
                },
                'it returns null': function(err, found) {
                    assert.ifError(err);
                    assert.isNull(found);
                }
            },
            'and we try to retrieve it from the person id': {
                topic: function(user, User) {
                    User.fromPerson(user.profile.id, this.callback);
                },
                'it works': function(err, found) {
                    assert.ifError(err);
                    assert.isObject(found);
                    assert.equal(found.nickname, 'tom');
                }
            },
            'and we try to get its profile': {
                topic: function(user) {
                    user.getProfile(this.callback);
                },
                'it works': function(err, profile) {
                    assert.ifError(err);
                    assert.isObject(profile);
                    assert.instanceOf(profile,
                                      require('../lib/model/person').Person);
                }
            }
        },
        'and we create a user and sanitize it': {
            topic: function(User) {
                var cb = this.callback,
                    props = {
                        nickname: 'dick',
                        password: 'foobar'
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
            'it works': function(err, user) {
                assert.ifError(err);
                assert.isObject(user);
            },
            'it is sanitized': function(err, user) {
                assert.isFalse(_(user).has('password'));
                assert.isFalse(_(user).has('passwordHash'));
            }
        },
        'and we create a new user and get its stream': {
            topic: function(User) {
                var cb = this.callback,
                    user = null,
                    props = {
                        nickname: 'harry',
                        password: 'un1c0rn'
                    };

                Step(
                    function() {
                        User.create(props, this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        user = results;
                        user.getStream(0, 20, this);
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
            'it works': function(err, results) {
                assert.ifError(err);
                assert.isObject(results.user);
                assert.isArray(results.activities);
            },
            'it is empty': function(err, results) {
                assert.lengthOf(results.activities, 0);
            },
            'and we add an activity to its stream': {
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
                        Activity = require('../lib/model/activity').Activity,
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
                'it works': function(err, results) {
                    assert.ifError(err);
                },
                'and we get the user stream': {
                    topic: function(results) {
                        var cb = this.callback,
                            user = results.user,
                            activity = results.activity;

                        user.getStream(0, 20, function(err, activities) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, {user: user,
                                          activity: activity,
                                          activities: activities});
                            }
                        });
                    },
                    'it works': function(err, results) {
                        assert.ifError(err);
                        assert.isArray(results.activities);
                    },
                    'it includes the added activity': function(err, results) {
                        assert.lengthOf(results.activities, 1);
                        assert.equal(results.activities[0].id, results.activity.id);
                    }
                }
            }
        },
        'and we create a new user and get its inbox': {
            topic: function(User) {
                var cb = this.callback,
                    user = null,
                    props = {
                        nickname: 'maurice',
                        password: 'cappadoccia'
                    };

                Step(
                    function() {
                        User.create(props, this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        user = results;
                        user.getInbox(0, 20, this);
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
            'it works': function(err, results) {
                assert.ifError(err);
                assert.isObject(results.user);
                assert.isArray(results.activities);
            },
            'it is empty': function(err, results) {
                assert.lengthOf(results.activities, 0);
            },
            'and we add an activity to its inbox': {
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
                        Activity = require('../lib/model/activity').Activity,
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
                'it works': function(err, results) {
                    assert.ifError(err);
                },
                'and we get the user inbox': {
                    topic: function(results) {
                        var cb = this.callback,
                            user = results.user,
                            activity = results.activity;

                        user.getInbox(0, 20, function(err, activities) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, {user: user,
                                          activity: activity,
                                          activities: activities});
                            }
                        });
                    },
                    'it works': function(err, results) {
                        assert.ifError(err);
                        assert.isArray(results.activities);
                    },
                    'it includes the added activity': function(err, results) {
                        assert.lengthOf(results.activities, 1);
                        assert.equal(results.activities[0].id, results.activity.id);
                    }
                }
            }
        },
        'and we create a pair of users': {
            topic: function(User) {
                var cb = this.callback;
                Step(
                    function() {
                        User.create({nickname: "shields", password: "wind"}, this.parallel());
                        User.create({nickname: "yarnell", password: "rope"}, this.parallel());
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
            'it works': function(err, users) {
                assert.ifError(err);
            },
            'and we make one follow the other': {
                topic: function(users) {
                    users.shields.follow(users.yarnell.profile.id, this.callback);
                },
                'it works': function(err) {
                    assert.ifError(err);
                },
                'and we check the first user\'s following list': {
                    topic: function(users) {
                        users.shields.getFollowing(0, 20, this.callback);
                    },
                    'it works': function(err, following) {
                        assert.ifError(err);
                        assert.isArray(following);
                    },
                    'it is the right size': function(err, following) {
                        assert.ifError(err);
                        assert.lengthOf(following, 1);
                    }
                },
                'and we check the second user\'s followers list': {
                    topic: function(users) {
                        users.yarnell.getFollowers(0, 20, this.callback);
                    },
                    'it works': function(err, followers) {
                        assert.ifError(err);
                        assert.isArray(followers);
                    },
                    'it is the right size': function(err, followers) {
                        assert.ifError(err);
                        assert.lengthOf(followers, 1);
                    }
                }
            }
        }
    }
});

suite['export'](module);
