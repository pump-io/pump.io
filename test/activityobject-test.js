// activityobject-test.js
//
// Test the activityobject module's class methods
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
    Step = require('step'),
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    schema = require('../lib/schema').schema,
    URLMaker = require('../lib/urlmaker').URLMaker;

vows.describe('activityobject class interface').addBatch({
    'When we require the activityobject module': {
        topic: function() { 
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get('memory', params);

            db.connect({}, function(err) {
                var mod;

                DatabankObject.bank = db;
                
                mod = require('../lib/model/activityobject') || null;

                cb(null, mod);
            });
        },
        'we get a module': function(mod) {
            assert.isObject(mod);
        },
        'and we get its UnknownTypeError member': {
            topic: function(mod) {
                return mod.UnknownTypeError;
            },
            'it exists': function(ActivityObject) {
                assert.isFunction(ActivityObject);
            }
        },
        'and we get its ActivityObject member': {
            topic: function(mod) {
                return mod.ActivityObject;
            },
            'it exists': function(ActivityObject) {
                assert.isFunction(ActivityObject);
            },
            'it has a makeURI member': function(ActivityObject) {
                assert.isFunction(ActivityObject.makeURI);
            },
            'it has a toClass member': function(ActivityObject) {
                assert.isFunction(ActivityObject.toClass);
            },
            'it has a toObject member': function(ActivityObject) {
                assert.isFunction(ActivityObject.toObject);
            },
            'it has a getObject member': function(ActivityObject) {
                assert.isFunction(ActivityObject.getObject);
            },
            'it has a createObject member': function(ActivityObject) {
                assert.isFunction(ActivityObject.createObject);
            },
            'it has an ensureObject member': function(ActivityObject) {
                assert.isFunction(ActivityObject.ensureObject);
            },
            'it has an objectTypes member': function(ActivityObject) {
                assert.isArray(ActivityObject.objectTypes);
            },
            'it has constant-ish members for known types': function(ActivityObject) {
                assert.equal(ActivityObject.ARTICLE, 'article');
                assert.equal(ActivityObject.AUDIO, 'audio');
                assert.equal(ActivityObject.BADGE, 'badge');
                assert.equal(ActivityObject.BOOKMARK, 'bookmark');
                assert.equal(ActivityObject.COLLECTION, 'collection');
                assert.equal(ActivityObject.COMMENT, 'comment');
                assert.equal(ActivityObject.EVENT, 'event');
                assert.equal(ActivityObject.FILE, 'file');
                assert.equal(ActivityObject.GROUP, 'group');
                assert.equal(ActivityObject.IMAGE, 'image');
                assert.equal(ActivityObject.NOTE, 'note');
                assert.equal(ActivityObject.PERSON, 'person');
                assert.equal(ActivityObject.PLACE, 'place');
                assert.equal(ActivityObject.PRODUCT, 'product');
                assert.equal(ActivityObject.QUESTION, 'question');
                assert.equal(ActivityObject.REVIEW, 'review');
                assert.equal(ActivityObject.SERVICE, 'service');
                assert.equal(ActivityObject.VIDEO, 'video');
            },
            'and we make a new URI': {
                topic: function(ActivityObject) {
                    return ActivityObject.makeURI(ActivityObject.AUDIO, 'AAAAAAAAAAAAAAAAAAAAAAA');
                },
                'it returns a string': function(uri) {
                    assert.isString(uri);
                }
            },
            'and we get a class by typename': {
                topic: function(ActivityObject) {
                    return ActivityObject.toClass(ActivityObject.VIDEO);
                },
                'it returns the right one': function(Video) {
                    assert.equal(Video, require('../lib/model/video').Video);
                }
            },
            'and we get an object by properties': {
                topic: function(ActivityObject) {
                    var props = {
                        objectType: ActivityObject.REVIEW,
                        id: 'http://example.org/reviews/1',
                        content: "I hate your blog."
                    };
                    return ActivityObject.toObject(props);
                },
                'it exists': function(review) {
                    assert.isObject(review);
                },
                'it is the right type': function(review) {
                    assert.instanceOf(review, require('../lib/model/review').Review);
                },
                'it has the right properties': function(review) {
                    assert.equal(review.objectType, 'review');
                    assert.equal(review.id, 'http://example.org/reviews/1');
                    assert.equal(review.content, "I hate your blog.");
                }
            },
            'and we get a non-activityobject model object by its properties': {
                topic: function(ActivityObject) {
                    var props = {
                        objectType: 'user',
                        nickname: 'evan'
                    };
                    return ActivityObject.toObject(props);
                },
                'it fails': function(client) {
                    assert.isObject(client);
                }
            },
            'and we create an activityobject object': {
                topic: function(ActivityObject) {
                    var props = {
                        objectType: ActivityObject.ARTICLE,
                        content: "Blah blah blah."
                    };
                    ActivityObject.createObject(props, this.callback);
                },
                teardown: function(article) {
                    if (article && article.del) {
                        article.del(function(err) {});
                    }
                },
                'it works': function(err, article) {
                    assert.ifError(err);
                },
                'it exists': function(err, article) {
                    assert.isObject(article);
                },
                'it has the right class': function(err, article) {
                    assert.instanceOf(article, require('../lib/model/article').Article);
                },
                'it has the right passed-in attributes': function(err, article) {
                    assert.equal(article.objectType, 'article');
                    assert.equal(article.content, "Blah blah blah.");
                },
                'it has the right auto-created attributes': function(err, article) {
                    assert.isString(article.id);
                    assert.isString(article.published);
                    assert.isString(article.updated);
                },
                'and we get the same object': {
                    topic: function(article, ActivityObject) {
                        ActivityObject.getObject(ActivityObject.ARTICLE, article.id, this.callback);
                    },
                    'it works': function(err, article) {
                        assert.ifError(err);
                    },
                    'it exists': function(err, article) {
                        assert.isObject(article);
                    },
                    'it has the right class': function(err, article) {
                        assert.instanceOf(article, require('../lib/model/article').Article);
                    },
                    'it has the right passed-in attributes': function(err, article) {
                        assert.equal(article.objectType, 'article');
                        assert.equal(article.content, "Blah blah blah.");
                    },
                    'it has the right auto-created attributes': function(err, article) {
                        assert.isString(article.id);
                        assert.isString(article.published);
                        assert.isString(article.updated);
                    }
                }
            },
            'and we ensure a new activityobject object': {
                topic: function(ActivityObject) {
                    var props = {
                        id: 'urn:uuid:2b7cc63f-dd9a-438f-b6d3-846fee2634bf',
                        objectType: ActivityObject.GROUP,
                        displayName: "ActivityPump Devs"
                    };
                    ActivityObject.ensureObject(props, this.callback);
                },
                teardown: function(group) {
                    if (group && group.del) {
                        group.del(function(err) {});
                    }
                },
                'it works': function(err, article) {
                    assert.ifError(err);
                },
                'it exists': function(err, group) {
                    assert.isObject(group);
                },
                'it has the right class': function(err, group) {
                    assert.instanceOf(group, require('../lib/model/group').Group);
                },
                'it has the right passed-in attributes': function(err, group) {
                    assert.equal(group.objectType, 'group');
                    assert.equal(group.displayName, "ActivityPump Devs");
                },
                'it has the right auto-created attributes': function(err, group) {
                    assert.isString(group.id);
                    assert.isString(group.published);
                    assert.isString(group.updated);
                }
            },
            'and we ensure an existing activityobject object': {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Comment = require('../lib/model/comment').Comment,
                        props = {
                            objectType: ActivityObject.COMMENT,
                            content: "FIRST POST",
                            inReplyTo: {
                                objectType: ActivityObject.ARTICLE,
                                url: "http://example.net/articles/3"
                            }
                        };

                    Comment.create(props, function(err, comment) {
                        var p = {};
                        if (err) {
                            cb(err, null);
                        } else {
                            DatabankObject.copy(p, comment);
                            ActivityObject.ensureObject(p, cb);
                        }
                    });
                },
                teardown: function(comment) {
                    if (comment && comment.del) {
                        comment.del(function(err) {});
                    }
                },
                'it works': function(err, comment) {
                    assert.ifError(err);
                },
                'it exists': function(err, comment) {
                    assert.isObject(comment);
                },
                'it has the right class': function(err, comment) {
                    assert.instanceOf(comment, require('../lib/model/comment').Comment);
                },
                'it has the right passed-in attributes': function(err, comment) {
                    assert.equal(comment.objectType, 'comment');
                    assert.equal(comment.content, "FIRST POST");
                    assert.equal(comment.inReplyTo.url, "http://example.net/articles/3");
                    assert.equal(comment.inReplyTo.objectType, "article");

                },
                'it has the right auto-created attributes': function(err, comment) {
                    assert.isString(comment.id);
                    assert.isString(comment.published);
                    assert.isString(comment.updated);
                }
            },
            'and we create an activityobject with an author': {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Note = require('../lib/model/note').Note,
                        Person = require('../lib/model/person').Person,
                        props = {
                            objectType: ActivityObject.NOTE,
                            content: "HELLO WORLD"
                        },
                        author;

                    Step(
                        function() {
                            Person.create({displayName: 'peter', preferredUsername: 'p65'}, this);
                        },
                        function(err, person) {
                            if (err) throw err;
                            author = props.author = person;
                            Note.create(props, this);
                        },
                        function(err, note) {
                            cb(err, note, author);
                        }
                    );
                },
                'it works': function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object);
                },
                'results contain the author information': function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object.author);
                    assert.equal(object.author.id, author.id);
                    assert.equal(object.author.objectType, author.objectType);
                    assert.equal(object.author.displayName, author.displayName);
                    assert.equal(object.author.preferredUsername, author.preferredUsername);
                }
            },
            'and we create an activityobject with an author reference': {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Note = require('../lib/model/note').Note,
                        Person = require('../lib/model/person').Person,
                        props = {
                            objectType: ActivityObject.NOTE,
                            content: "HELLO WORLD"
                        },
                        author;

                    Step(
                        function() {
                            Person.create({displayName: 'quincy', preferredUsername: 'qbert'}, this);
                        },
                        function(err, person) {
                            if (err) throw err;
                            author = person;
                            props.author = {id: person.id, objectType: person.objectType};
                            Note.create(props, this);
                        },
                        function(err, note) {
                            cb(err, note, author);
                        }
                    );
                },
                'it works': function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object);
                },
                'results contain the author information': function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object.author);
                    assert.equal(object.author.id, author.id);
                    assert.equal(object.author.objectType, author.objectType);
                    assert.equal(object.author.displayName, author.displayName);
                    assert.equal(object.author.preferredUsername, author.preferredUsername);
                }
            },
            'and we update an activityobject with an author': {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Note = require('../lib/model/note').Note,
                        Person = require('../lib/model/person').Person,
                        props = {
                            objectType: ActivityObject.NOTE,
                            content: "HELLO WORLD"
                        },
                        author;
                    Step(
                        function() {
                            Person.create({displayName: 'randy', preferredUsername: 'rman99'}, this);
                        },
                        function(err, person) {
                            if (err) throw err;
                            author = person;
                            props.author = person;
                            Note.create(props, this);
                        },
                        function(err, note) {
                            if (err) throw err;
                            note.update({summary: "A helpful greeting"}, this);
                        },
                        function(err, note) {
                            cb(err, note, author);
                        }
                    );
                },
                'it works': function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object);
                },
                'results contain the author information': function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object.author);
                    assert.equal(object.author.id, author.id);
                    assert.equal(object.author.objectType, author.objectType);
                    assert.equal(object.author.displayName, author.displayName);
                    assert.equal(object.author.preferredUsername, author.preferredUsername);
                }
            },
            'and we update an activityobject with an author reference': {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Note = require('../lib/model/note').Note,
                        Person = require('../lib/model/person').Person,
                        props = {
                            objectType: ActivityObject.NOTE,
                            content: "HELLO WORLD"
                        },
                        author;

                    Step(
                        function() {
                            Person.create({displayName: 'steven', preferredUsername: 'billabong'}, this);
                        },
                        function(err, person) {
                            if (err) throw err;
                            author = person;
                            props.author = person;
                            Note.create(props, this);
                        },
                        function(err, note) {
                            if (err) throw err;
                            note.author = {id: note.author.id, objectType: note.author.objectType};
                            note.update({summary: "A helpful greeting"}, this);
                        },
                        function(err, note) {
                            cb(err, note, author);
                        }
                    );
                },
                'it works': function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object);
                },
                'results contain the author information': function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object.author);
                    assert.equal(object.author.id, author.id);
                    assert.equal(object.author.objectType, author.objectType);
                    assert.equal(object.author.displayName, author.displayName);
                    assert.equal(object.author.preferredUsername, author.preferredUsername);
                }
            }
        }
    }
})['export'](module);

