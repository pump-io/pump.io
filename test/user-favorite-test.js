// user-favorite-test.js
//
// Test the user favoriting mechanism
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
    schema = require('../lib/schema').schema,
    URLMaker = require('../lib/urlmaker').URLMaker,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe('user module interface');

suite.addBatch({
    'When we get the User class': {
        topic: function() { 

            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get('memory', params);

            db.connect({}, function(err) {
                var User;

                DatabankObject.bank = db;
                
                User = require('../lib/model/user').User || null;

                cb(null, User);
            });
        },
        'it exists': function(User) {
            assert.isFunction(User);
        },
        'and we create a user': {
            topic: function(User) {
                var props = {
                    nickname: 'bert',
                    password: 'pidgeons'
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
            'and it favorites a known object': {
                topic: function(user) {
                    var cb = this.callback,
                        Image = require('../lib/model/image').Image,
                        obj;
                    
                    Step(
                        function() {
                            Image.create({displayName: "Courage Wolf",
                                          url: "http://i0.kym-cdn.com/photos/images/newsfeed/000/159/986/Couragewolf1.jpg"}, this);
                        },
                        function(err, image) {
                            if (err) throw err;
                            obj = image;
                            user.favorite(image.id, image.objectType, this);
                        },
                        function(err) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(err, obj);
                            }
                        }
                    );
                },
                'it works': function(err, image) {
                    assert.ifError(err);
                },
                'and it unfavorites that object': {
                    topic: function(image, user) {
                        user.unfavorite(image.id, image.objectType, this.callback);
                    },
                    'it works': function(err) {
                        assert.ifError(err);
                    }
                }
            },
            'and it favorites an unknown object': {
                topic: function(user) {
                    var cb = this.callback;
                    
                    user.favorite("urn:uuid:5be685ef-f50b-458b-bfd3-3ca004eb0e89", "image", this.callback);
                },
                'it works': function(err) {
                    assert.ifError(err);
                },
                'and it unfavorites that object': {
                    topic: function(user) {
                        user.unfavorite("urn:uuid:5be685ef-f50b-458b-bfd3-3ca004eb0e89", "image", this.callback);
                    },
                    'it works': function(err) {
                        assert.ifError(err);
                    }
                }
            },
            'and it double-favorites an object': {
                topic: function(user) {
                    var cb = this.callback,
                        Video = require('../lib/model/video').Video,
                        obj;
                    
                    Step(
                        function() {
                            Video.create({displayName: "Winning",
                                          url: "http://www.youtube.com/watch?v=9QS0q3mGPGg"}, this);
                        },
                        function(err, video) {
                            if (err) throw err;
                            obj = video;
                            user.favorite(obj.id, obj.objectType, this);
                        },
                        function(err) {
                            if (err) throw err;
                            user.favorite(obj.id, obj.objectType, this);
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
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            },
            'and it unfavorites an object it never favorited': {
                topic: function(user) {
                    var cb = this.callback,
                        Audio = require('../lib/model/audio').Audio,
                        obj;
                    
                    Step(
                        function() {
                            Audio.create({displayName: "Spock",
                                          url: "http://musicbrainz.org/recording/c1038685-49f3-45d7-bb26-1372f1052126"}, this);
                        },
                        function(err, video) {
                            if (err) throw err;
                            obj = video;
                            user.unfavorite(obj.id, obj.objectType, this);
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
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            }
        },
        'and we get the list of favorites for a new user': {
            topic: function(User) {
                var cb = this.callback,
                    props = {
                        nickname: 'carroway',
                        password: 'feldspar'
                    };
                Step(
                    function() {
                        User.create(props, this);
                    },
                    function(err, user) {
                        if (err) throw err;
                        user.getFavorites(0, 20, this);
                    },
                    function(err, faves) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, faves);
                        }
                    }
                );
            },
            'it works': function(err, faves) {
                assert.ifError(err);
            },
            'it looks right': function(err, faves) {
                assert.ifError(err);
                assert.isArray(faves);
                assert.lengthOf(faves, 0);
            }
        }
    }
});

suite['export'](module);
