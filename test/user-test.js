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
        }
    }
});

suite.export(module);
