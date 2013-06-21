// activityobject-test.js
//
// Test the activityobject module's class methods
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
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    schema = require("../lib/schema").schema,
    URLMaker = require("../lib/urlmaker").URLMaker;

var suite = vows.describe("activityobject class interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch({
    "When we require the activityobject module": {
        topic: function() { 
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {
                var mod;

                DatabankObject.bank = db;
                
                mod = require("../lib/model/activityobject") || null;

                cb(null, mod);
            });
        },
        "we get a module": function(mod) {
            assert.isObject(mod);
        },
        "and we get its UnknownTypeError member": {
            topic: function(mod) {
                return mod.UnknownTypeError;
            },
            "it exists": function(ActivityObject) {
                assert.isFunction(ActivityObject);
            }
        },
        "and we get its ActivityObject member": {
            topic: function(mod) {
                return mod.ActivityObject;
            },
            "it exists": function(ActivityObject) {
                assert.isFunction(ActivityObject);
            },
            "it has a makeURI member": function(ActivityObject) {
                assert.isFunction(ActivityObject.makeURI);
            },
            "it has a toClass member": function(ActivityObject) {
                assert.isFunction(ActivityObject.toClass);
            },
            "it has a toObject member": function(ActivityObject) {
                assert.isFunction(ActivityObject.toObject);
            },
            "it has a getObject member": function(ActivityObject) {
                assert.isFunction(ActivityObject.getObject);
            },
            "it has a createObject member": function(ActivityObject) {
                assert.isFunction(ActivityObject.createObject);
            },
            "it has an ensureObject member": function(ActivityObject) {
                assert.isFunction(ActivityObject.ensureObject);
            },
            "it has a compressProperty member": function(ActivityObject) {
                assert.isFunction(ActivityObject.compressProperty);
            },
            "it has an expandProperty member": function(ActivityObject) {
                assert.isFunction(ActivityObject.expandProperty);
            },
            "it has a getObjectStream member": function(ActivityObject) {
                assert.isFunction(ActivityObject.getObjectStream);
            },
            "it has a sameID member": function(ActivityObject) {
                assert.isFunction(ActivityObject.sameID);
            },
            "it has a canonicalID member": function(ActivityObject) {
                assert.isFunction(ActivityObject.canonicalID);
            },
            "it has an objectTypes member": function(ActivityObject) {
                assert.isArray(ActivityObject.objectTypes);
            },
            "it has constant-ish members for known types": function(ActivityObject) {
                assert.equal(ActivityObject.ALERT, "alert");
                assert.equal(ActivityObject.APPLICATION, "application");
                assert.equal(ActivityObject.ARTICLE, "article");
                assert.equal(ActivityObject.AUDIO, "audio");
                assert.equal(ActivityObject.BADGE, "badge");
                assert.equal(ActivityObject.BINARY, "binary");
                assert.equal(ActivityObject.BOOKMARK, "bookmark");
                assert.equal(ActivityObject.COLLECTION, "collection");
                assert.equal(ActivityObject.COMMENT, "comment");
                assert.equal(ActivityObject.DEVICE, "device");
                assert.equal(ActivityObject.EVENT, "event");
                assert.equal(ActivityObject.FILE, "file");
                assert.equal(ActivityObject.GAME, "game");
                assert.equal(ActivityObject.GROUP, "group");
                assert.equal(ActivityObject.IMAGE, "image");
                assert.equal(ActivityObject.ISSUE, "issue");
                assert.equal(ActivityObject.JOB, "job");
                assert.equal(ActivityObject.NOTE, "note");
                assert.equal(ActivityObject.OFFER, "offer");
                assert.equal(ActivityObject.ORGANIZATION, "organization");
                assert.equal(ActivityObject.PAGE, "page");
                assert.equal(ActivityObject.PERSON, "person");
                assert.equal(ActivityObject.PLACE, "place");
                assert.equal(ActivityObject.PROCESS, "process");
                assert.equal(ActivityObject.PRODUCT, "product");
                assert.equal(ActivityObject.QUESTION, "question");
                assert.equal(ActivityObject.REVIEW, "review");
                assert.equal(ActivityObject.SERVICE, "service");
                assert.equal(ActivityObject.TASK, "task");
                assert.equal(ActivityObject.VIDEO, "video");
            },
            "and we make a new URI": {
                topic: function(ActivityObject) {
                    return ActivityObject.makeURI(ActivityObject.AUDIO, "AAAAAAAAAAAAAAAAAAAAAAA");
                },
                "it returns a string": function(uri) {
                    assert.isString(uri);
                }
            },
            "and we get a class by typename": {
                topic: function(ActivityObject) {
                    return ActivityObject.toClass(ActivityObject.VIDEO);
                },
                "it returns the right one": function(Video) {
                    assert.equal(Video, require("../lib/model/video").Video);
                }
            },
            "and we get a class by unknown typename": {
                topic: function(ActivityObject) {
                    return ActivityObject.toClass("http://underwear.example/type/boxer-briefs");
                },
                "it returns the Other": function(Other) {
                    assert.equal(Other, require("../lib/model/other").Other);
                }
            },
            "and we get an object by properties": {
                topic: function(ActivityObject) {
                    var props = {
                        objectType: ActivityObject.REVIEW,
                        id: "http://example.org/reviews/1",
                        content: "I hate your blog."
                    };
                    return ActivityObject.toObject(props);
                },
                "it exists": function(review) {
                    assert.isObject(review);
                },
                "it is the right type": function(review) {
                    assert.instanceOf(review, require("../lib/model/review").Review);
                },
                "it has the right properties": function(review) {
                    assert.equal(review.objectType, "review");
                    assert.equal(review.id, "http://example.org/reviews/1");
                    assert.equal(review.content, "I hate your blog.");
                },
                "it has an expand() method": function(review) {
                    assert.isFunction(review.expand);
                },
                "it has a favoritedBy() method": function(review) {
                    assert.isFunction(review.favoritedBy);
                },
                "it has an unfavoritedBy() method": function(review) {
                    assert.isFunction(review.unfavoritedBy);
                },
                "it has a getFavoriters() method": function(review) {
                    assert.isFunction(review.getFavoriters);
                },
                "it has a favoritersCount() method": function(review) {
                    assert.isFunction(review.favoritersCount);
                },
                "it has an expandFeeds() method": function(review) {
                    assert.isFunction(review.expandFeeds);
                },
                "it has an efface() method": function(review) {
                    assert.isFunction(review.efface);
                },
                "it has an isFollowable() method": function(review) {
                    assert.isFunction(review.isFollowable);
                },
                "it has a getSharesStream() method": function(review) {
                    assert.isFunction(review.getSharesStream);
                },
                "it has a sharesCount() method": function(review) {
                    assert.isFunction(review.sharesCount);
                }
            },
            "and we get a non-activityobject model object by its properties": {
                topic: function(ActivityObject) {
                    var props = {
                        objectType: "user",
                        nickname: "evan"
                    };
                    return ActivityObject.toObject(props);
                },
                "it is an Other": function(user) {
                    assert.instanceOf(user, require("../lib/model/other").Other);
                    assert.equal(user.objectType, "user");
                }
            },
            "and we get a weird made-up object by its properties": {
                topic: function(ActivityObject) {
                    var props = {
                        objectType: "http://condiment.example/type/spice",
                        displayName: "Cinnamon"
                    };
                    return ActivityObject.toObject(props);
                },
                "it is an Other": function(cinnamon) {
                    assert.instanceOf(cinnamon, require("../lib/model/other").Other);
                    assert.equal(cinnamon.objectType, "http://condiment.example/type/spice");
                }
            },
           "and we create an activityobject object": {
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
                "it works": function(err, article) {
                    assert.ifError(err);
                },
                "it exists": function(err, article) {
                    assert.isObject(article);
                },
                "it has the right class": function(err, article) {
                    assert.instanceOf(article, require("../lib/model/article").Article);
                },
                "it has the right passed-in attributes": function(err, article) {
                    assert.equal(article.objectType, "article");
                    assert.equal(article.content, "Blah blah blah.");
                },
                "it has the right auto-created attributes": function(err, article) {
                    assert.isString(article.id);
                    assert.isString(article.published);
                    assert.isString(article.updated);
                },
                "and we get the same object": {
                    topic: function(article, ActivityObject) {
                        ActivityObject.getObject(ActivityObject.ARTICLE, article.id, this.callback);
                    },
                    "it works": function(err, article) {
                        assert.ifError(err);
                    },
                    "it exists": function(err, article) {
                        assert.isObject(article);
                    },
                    "it has the right class": function(err, article) {
                        assert.instanceOf(article, require("../lib/model/article").Article);
                    },
                    "it has the right passed-in attributes": function(err, article) {
                        assert.equal(article.objectType, "article");
                        assert.equal(article.content, "Blah blah blah.");
                    },
                    "it has the right auto-created attributes": function(err, article) {
                        assert.isString(article.id);
                        assert.isString(article.published);
                        assert.isString(article.updated);
                    }
                }
            },
            "and we create an activityobject of unknown type": {
                topic: function(ActivityObject) {
                    var props = {
                        objectType: "http://orange.example/type/seed",
                        displayName: "Seed #3451441"
                    };
                    ActivityObject.createObject(props, this.callback);
                },
                "it works": function(err, seed) {
                    assert.ifError(err);
                    assert.isObject(seed);
                    assert.instanceOf(seed, require("../lib/model/other").Other);
                    assert.equal(seed.objectType, "http://orange.example/type/seed");
                }
            },
            "and we ensure a new activityobject object": {
                topic: function(ActivityObject) {
                    var props = {
                        id: "urn:uuid:2b7cc63f-dd9a-438f-b6d3-846fee2634bf",
                        objectType: ActivityObject.GROUP,
                        displayName: "pump.io Devs"
                    };
                    ActivityObject.ensureObject(props, this.callback);
                },
                teardown: function(group) {
                    if (group && group.del) {
                        group.del(function(err) {});
                    }
                },
                "it works": function(err, article) {
                    assert.ifError(err);
                },
                "it exists": function(err, group) {
                    assert.isObject(group);
                },
                "it has the right class": function(err, group) {
                    assert.instanceOf(group, require("../lib/model/group").Group);
                },
                "it has the right passed-in attributes": function(err, group) {
                    assert.equal(group.objectType, "group");
                    assert.equal(group.displayName, "pump.io Devs");
                },
                "it has the right auto-created attributes": function(err, group) {
                    assert.isString(group.id);
                }
            },
            "and we ensure an existing activityobject object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Comment = require("../lib/model/comment").Comment,
                        props = {
                            objectType: ActivityObject.COMMENT,
                            content: "FIRST POST",
                            inReplyTo: {
                                objectType: ActivityObject.ARTICLE,
                                id: "http://example.net/articles/3"
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
                "it works": function(err, comment) {
                    assert.ifError(err);
                },
                "it exists": function(err, comment) {
                    assert.isObject(comment);
                },
                "it has the right class": function(err, comment) {
                    assert.instanceOf(comment, require("../lib/model/comment").Comment);
                },
                "it has the right passed-in attributes": function(err, comment) {
                    assert.equal(comment.objectType, "comment");
                    assert.equal(comment.content, "FIRST POST");
                    assert.equal(comment.inReplyTo.id, "http://example.net/articles/3");
                    assert.equal(comment.inReplyTo.objectType, "article");

                },
                "it has the right auto-created attributes": function(err, comment) {
                    assert.isString(comment.id);
                    assert.isString(comment.published);
                    assert.isString(comment.updated);
                }
            },
            "and we ensure an activityobject of unrecognized type": {
                topic: function(ActivityObject) {
                    var props = {
                        id: "urn:uuid:4fcc9eda-0469-11e2-a4d5-70f1a154e1aa",
                        objectType: "http://utensil.example/type/spoon",
                        displayName: "My spoon"
                    };
                    ActivityObject.ensureObject(props, this.callback);
                },
                "it works": function(err, article) {
                    assert.ifError(err);
                },
                "it exists": function(err, spoon) {
                    assert.ifError(err);
                    assert.isObject(spoon);
                },
                "it has the right class": function(err, spoon) {
                    assert.instanceOf(spoon, require("../lib/model/other").Other);
                    assert.equal(spoon.objectType, "http://utensil.example/type/spoon");
                }
            },
            "and we compress an existing object property of an object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Image = require("../lib/model/image").Image,
                        Person = require("../lib/model/person").Person,
                        image = new Image({
                            author: {
                                id: "urn:uuid:8a9d0e92-3210-4ea3-920f-3950ca8d5306",
                                displayName: "Barney Miller",
                                objectType: "person"
                            },
                            url: "http://example.net/images/1.jpg"
                        });
                    ActivityObject.compressProperty(image, "author", function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, image);
                        }
                    });
                },
                "it works": function(err, image) {
                    assert.ifError(err);
                },
                "the property is compressed": function(err, image) {
                    assert.ifError(err);
                    assert.include(image, "author");
                    assert.isObject(image.author);
                    assert.instanceOf(image.author, require("../lib/model/person").Person);
                    assert.include(image.author, "id");
                    assert.isString(image.author.id);
                    assert.equal(image.author.id, "urn:uuid:8a9d0e92-3210-4ea3-920f-3950ca8d5306");
                    assert.include(image.author, "objectType");
                    assert.isString(image.author.objectType);
                    assert.equal(image.author.objectType, "person");
                    assert.isFalse(_(image.author).has("displayName"));
                }
            },
            "and we compress a non-existent object property of an object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Image = require("../lib/model/image").Image,
                        image = new Image({
                            url: "http://example.net/images/2.jpg"
                        });
                    ActivityObject.compressProperty(image, "author", function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, image);
                        }
                    });
                },
                "it works": function(err, image) {
                    assert.ifError(err);
                },
                "the property remains non-existent": function(err, image) {
                    assert.ifError(err);
                    assert.isFalse(_(image).has("author"));
                }
            },
            "and we expand an existing object property of an object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Image = require("../lib/model/image").Image,
                        Person = require("../lib/model/person").Person,
                        image;

                    Step(
                        function() {
                            Person.create({id: "urn:uuid:bbd313d1-6f8d-4d72-bc05-bde69ba795d7",
                                           displayName: "Theo Kojak"},
                                          this);
                        },
                        function(err, person) {
                            if (err) throw err;
                            image = new Image({
                                url: "http://example.net/images/1.jpg",
                                author: {id: person.id, objectType: "person"}
                            });
                            ActivityObject.expandProperty(image, "author", this);
                        },
                        function(err) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, image);
                            }
                        }
                    );
                },
                "it works": function(err, image) {
                    assert.ifError(err);
                },
                "the property is expanded": function(err, image) {
                    assert.ifError(err);
                    assert.include(image, "author");
                    assert.isObject(image.author);
                    assert.instanceOf(image.author, require("../lib/model/person").Person);
                    assert.include(image.author, "id");
                    assert.isString(image.author.id);
                    assert.equal(image.author.id, "urn:uuid:bbd313d1-6f8d-4d72-bc05-bde69ba795d7");
                    assert.include(image.author, "objectType");
                    assert.isString(image.author.objectType);
                    assert.equal(image.author.objectType, "person");
                    assert.include(image.author, "displayName");
                    assert.isString(image.author.displayName);
                    assert.equal(image.author.displayName, "Theo Kojak");
                }
            },
            "and we expand a non-existent object property of an object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Image = require("../lib/model/image").Image,
                        image = new Image({
                            url: "http://example.net/images/4.jpg"
                        });
                    ActivityObject.expandProperty(image, "author", function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, image);
                        }
                    });
                },
                "it works": function(err, image) {
                    assert.ifError(err);
                },
                "the property remains non-existent": function(err, image) {
                    assert.ifError(err);
                    assert.isFalse(_(image).has("author"));
                }
            },
            "and we compress a scalar property of an object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Image = require("../lib/model/image").Image,
                        image = new Image({
                            url: "http://example.net/images/5.jpg"
                        });
                    ActivityObject.compressProperty(image, "url", function(err) {
                        if (err) {
                            cb(null, image);
                        } else {
                            cb(new Error("Unexpected success"), null);
                        }
                    });
                },
                "it fails correctly": function(err, image) {
                    assert.ifError(err);
                },
                "the property remains non-existent": function(err, image) {
                    assert.ifError(err);
                    assert.isString(image.url);
                    assert.equal(image.url, "http://example.net/images/5.jpg");
                }
            },
            "and we expand a scalar property of an object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Image = require("../lib/model/image").Image,
                        image = new Image({
                            url: "http://example.net/images/6.jpg"
                        });
                    ActivityObject.expandProperty(image, "url", function(err) {
                        if (err) {
                            cb(null, image);
                        } else {
                            cb(new Error("Unexpected success"), null);
                        }
                    });
                },
                "it fails correctly": function(err, image) {
                    assert.ifError(err);
                },
                "the property remains non-existent": function(err, image) {
                    assert.ifError(err);
                    assert.isString(image.url);
                    assert.equal(image.url, "http://example.net/images/6.jpg");
                }
            },
            "and we create an activityobject with an author": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Note = require("../lib/model/note").Note,
                        Person = require("../lib/model/person").Person,
                        props = {
                            objectType: ActivityObject.NOTE,
                            content: "HELLO WORLD"
                        },
                        author;

                    Step(
                        function() {
                            Person.create({displayName: "peter", preferredUsername: "p65"}, this);
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
                "it works": function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object);
                },
                "results contain the author information": function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object.author);
                    assert.equal(object.author.id, author.id);
                    assert.equal(object.author.objectType, author.objectType);
                    assert.equal(object.author.displayName, author.displayName);
                    assert.equal(object.author.preferredUsername, author.preferredUsername);
                }
            },
            "and we create an activityobject with an author reference": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Note = require("../lib/model/note").Note,
                        Person = require("../lib/model/person").Person,
                        props = {
                            objectType: ActivityObject.NOTE,
                            content: "HELLO WORLD"
                        },
                        author;

                    Step(
                        function() {
                            Person.create({displayName: "quincy", preferredUsername: "qbert"}, this);
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
                "it works": function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object);
                },
                "results contain the author information": function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object.author);
                    assert.equal(object.author.id, author.id);
                    assert.equal(object.author.objectType, author.objectType);
                    assert.equal(object.author.displayName, author.displayName);
                    assert.equal(object.author.preferredUsername, author.preferredUsername);
                }
            },
            "and we update an activityobject with an author": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Note = require("../lib/model/note").Note,
                        Person = require("../lib/model/person").Person,
                        props = {
                            objectType: ActivityObject.NOTE,
                            content: "HELLO WORLD"
                        },
                        author;
                    Step(
                        function() {
                            Person.create({displayName: "randy", preferredUsername: "rman99"}, this);
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
                "it works": function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object);
                },
                "results contain the author information": function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object.author);
                    assert.equal(object.author.id, author.id);
                    assert.equal(object.author.objectType, author.objectType);
                    assert.equal(object.author.displayName, author.displayName);
                    assert.equal(object.author.preferredUsername, author.preferredUsername);
                }
            },
            "and we update an activityobject with an author reference": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Note = require("../lib/model/note").Note,
                        Person = require("../lib/model/person").Person,
                        props = {
                            objectType: ActivityObject.NOTE,
                            content: "HELLO WORLD"
                        },
                        author;

                    Step(
                        function() {
                            Person.create({displayName: "steven", preferredUsername: "billabong"}, this);
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
                "it works": function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object);
                },
                "results contain the author information": function(err, object, author) {
                    assert.ifError(err);
                    assert.isObject(object.author);
                    assert.equal(object.author.id, author.id);
                    assert.equal(object.author.objectType, author.objectType);
                    assert.equal(object.author.displayName, author.displayName);
                    assert.equal(object.author.preferredUsername, author.preferredUsername);
                }
            },
            "and we get a non-existent stream of objects": {
                topic: function(ActivityObject) {
                    ActivityObject.getObjectStream("person", "nonexistent", 0, 20, this.callback);
                },
                "it works": function(err, objects) {
                    assert.ifError(err);
                },
                "it returns an empty array": function(err, objects) {
                    assert.ifError(err);
                    assert.isArray(objects);
                    assert.lengthOf(objects, 0);
                }
            },
            "and we get an empty object stream": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Stream = require("../lib/model/stream").Stream;

                    Step(
                        function() {
                            Stream.create({name: "activityobject-test-1"}, this);
                        },
                        function(err, stream) {
                            if (err) throw err;
                            ActivityObject.getObjectStream("person", "activityobject-test-1", 0, 20, cb);
                        }
                    );
                },
                "it works": function(err, objects) {
                    assert.ifError(err);
                },
                "it returns an empty array": function(err, objects) {
                    assert.ifError(err);
                    assert.isArray(objects);
                    assert.lengthOf(objects, 0);
                }
            },
            "and we get an object stream with stuff in it": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Stream = require("../lib/model/stream").Stream,
                        Service = require("../lib/model/service").Service,
                        stream;

                    Step(
                        function() {
                            Stream.create({name: "activityobject-test-2"}, this);
                        },
                        function(err, results) {
                            var i, group = this.group();
                            if (err) throw err;
                            stream = results;
                            for (i = 0; i < 100; i++) {
                                Service.create({displayName: "Service #" + i}, group());
                            }
                        },
                        function(err, services) {
                            var i, group = this.group();
                            if (err) throw err;
                            for (i = 0; i < 100; i++) {
                                stream.deliver(services[i].id, group());
                            }
                        },
                        function(err) {
                            if (err) throw err;
                            ActivityObject.getObjectStream("service", "activityobject-test-2", 0, 20, cb);
                        }
                    );
                },
                "it works": function(err, objects) {
                    assert.ifError(err);
                },
                "it returns a non-empty array": function(err, objects) {
                    assert.ifError(err);
                    assert.isArray(objects);
                    assert.lengthOf(objects, 20);
                },
                "members are the correct type": function(err, objects) {
                    var Service = require("../lib/model/service").Service;
                    assert.ifError(err);
                    for (var i = 0; i < objects.length; i++) {
                        assert.isObject(objects[i]);
                        assert.instanceOf(objects[i], Service);
                    }
                }
            },
            "and we get the favoriters of a brand-new object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Place = require("../lib/model/place").Place;

                    Step(
                        function() {
                            Place.create({displayName: "Mount Everest",
                                          "position": "+27.5916+086.5640+8850/"},
                                         this);
                        },
                        function(err, place) {
                            if (err) throw err;
                            place.getFavoriters(0, 20, this);
                        },
                        function(err, favers) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, favers);
                            }
                        }
                    );
                },
                "it works": function(err, objects) {
                    assert.ifError(err);
                },
                "it returns an empty array": function(err, objects) {
                    assert.ifError(err);
                    assert.isArray(objects);
                    assert.lengthOf(objects, 0);
                }
            },
            "and we get the favoriters count of a brand-new object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Place = require("../lib/model/place").Place;

                    Step(
                        function() {
                            Place.create({displayName: "South Pole",
                                          "position": "-90.0000+0.0000/"},
                                         this);
                        },
                        function(err, place) {
                            if (err) throw err;
                            place.favoritersCount(this);
                        },
                        function(err, count) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, count);
                            }
                        }
                    );
                },
                "it works": function(err, count) {
                    assert.ifError(err);
                },
                "it returns zero": function(err, count) {
                    assert.ifError(err);
                    assert.equal(count, 0);
                }
            },
            "and we add a favoriter for an object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Place = require("../lib/model/place").Place,
                        Person = require("../lib/model/person").Person,
                        place = null,
                        person = null;
                    
                    Step(
                        function() {
                            Place.create({displayName: "North Pole",
                                          "position": "+90.0000+0.0000/"},
                                         this.parallel());
                            Person.create({displayName: "Robert Peary"},
                                          this.parallel());
                        },
                        function(err, results1, results2) {
                            if (err) throw err;
                            place = results1;
                            person = results2;
                            place.favoritedBy(person.id, this);
                        },
                        function(err) {
                            if (err) {
                                cb(err, null, null);
                            } else {
                                cb(null, place, person);
                            }
                        }
                    );
                },
                "it worked": function(err, place, person) {
                    assert.ifError(err);
                },
                "and we get its favoriters list": {
                    topic: function(place, person) {
                        var cb = this.callback;
                        place.getFavoriters(0, 20, function(err, favers) {
                            cb(err, favers, person);
                        });
                    },
                    "it worked": function(err, favers, person) {
                        assert.ifError(err);
                    } ,
                    "it is the right size": function(err, favers, person) {
                        assert.ifError(err);
                        assert.isArray(favers);
                        assert.lengthOf(favers, 1);
                    },
                    "it contains our data": function(err, favers, person) {
                        assert.ifError(err);
                        assert.equal(favers[0].id, person.id);
                    }
                },
                "and we get its favoriters count": {
                    topic: function(place, person) {
                        place.favoritersCount(this.callback);
                    },
                    "it works": function(err, count) {
                        assert.ifError(err);
                    },
                    "it returns one": function(err, count) {
                        assert.ifError(err);
                        assert.equal(count, 1);
                    }
                }
            },
            "and we add then remove a favoriter for an object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Place = require("../lib/model/place").Place,
                        Person = require("../lib/model/person").Person,
                        place = null,
                        person = null;
                    
                    Step(
                        function() {
                            Place.create({displayName: "Montreal",
                                          "position": "+45.5124-73.5547/"},
                                         this.parallel());
                            Person.create({displayName: "Evan Prodromou"},
                                          this.parallel());
                        },
                        function(err, results1, results2) {
                            if (err) throw err;
                            place = results1;
                            person = results2;
                            place.favoritedBy(person.id, this);
                        },
                        function(err) {
                            if (err) throw err;
                            place.unfavoritedBy(person.id, this);
                        },
                        function(err) {
                            if (err) {
                                cb(err, null, null);
                            } else {
                                cb(null, place, person);
                            }
                        }
                    );
                },
                "and we get its favoriters list": {
                    topic: function(place, person) {
                        var cb = this.callback;
                        place.getFavoriters(0, 20, function(err, favers) {
                            cb(err, favers, person);
                        });
                    },
                    "it worked": function(err, favers, person) {
                        assert.ifError(err);
                    } ,
                    "it is the right size": function(err, favers, person) {
                        assert.ifError(err);
                        assert.isArray(favers);
                        assert.lengthOf(favers, 0);
                    }
                },
                "and we get its favoriters count": {
                    topic: function(place, person) {
                        place.favoritersCount(this.callback);
                    },
                    "it works": function(err, count) {
                        assert.ifError(err);
                    },
                    "it returns zero": function(err, count) {
                        assert.ifError(err);
                        assert.equal(count, 0);
                    }
                }
            },
            "and we expand the feeds for an object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Place = require("../lib/model/place").Place,
                        place = null;
                    
                    Step(
                        function() {
                            Place.create({displayName: "San Francisco",
                                          "position": "+37.7771-122.4196/"},
                                         this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            place = results;
                            place.expandFeeds(this);
                        },
                        function(err) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, place);
                            }
                        }
                    );
                },
                "it works": function(err, place) {
                    assert.ifError(err);
                },
                "it adds the 'likes' property": function(err, place) {
                    assert.ifError(err);
                    assert.includes(place, "likes");
                    assert.isObject(place.likes);
                    assert.includes(place.likes, "totalItems");
                    assert.equal(place.likes.totalItems, 0);
                    assert.includes(place.likes, "url");
                    assert.isString(place.likes.url);
                }
            },
            "and we create then efface an object": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Comment = require("../lib/model/comment").Comment,
                        comment;
                    
                    Step(
                        function() {
                            var props = {
                                author: {
                                    id: "mailto:evan@status.net",
                                    objectType: "person"
                                },
                                inReplyTo: {
                                    url: "http://scripting.com/stories/2012/07/25/anOpenTwitterlikeEcosystem.html",
                                    objectType: "article"
                                },
                                content: "Right on, Dave."
                            };
                            Comment.create(props, this);

                        },
                        function(err, results) {
                            if (err) throw err;
                            comment = results;
                            comment.efface(this);
                        },
                        function(err) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, comment);
                            }
                        }
                    );
                },
                "it works": function(err, comment) {
                    assert.ifError(err);
                },
                "it looks right": function(err, comment) {
                    assert.ifError(err);
                    assert.ok(comment.id);
                    assert.ok(comment.objectType);
                    assert.ok(comment.author);
                    assert.ok(comment.inReplyTo);
                    assert.ok(comment.published);
                    assert.ok(comment.updated);
                    assert.ok(comment.deleted);
                    assert.isUndefined(comment.content);
                }
            },
            "and we canonicalize an http: ID": {
                topic: function(ActivityObject) {
                    return ActivityObject.canonicalID("http://social.example/user/1");
                },
                "it is unchanged": function(id) {
                    assert.equal(id, "http://social.example/user/1");
                }
            },
            "and we canonicalize an https: ID": {
                topic: function(ActivityObject) {
                    return ActivityObject.canonicalID("https://photo.example/user/1");
                },
                "it is unchanged": function(id) {
                    assert.equal(id, "https://photo.example/user/1");
                }
            },
            "and we canonicalize an acct: ID": {
                topic: function(ActivityObject) {
                    return ActivityObject.canonicalID("acct:user@checkin.example");
                },
                "it is unchanged": function(id) {
                    assert.equal(id, "acct:user@checkin.example");
                }
            },
            "and we canonicalize a bare Webfinger": {
                topic: function(ActivityObject) {
                    return ActivityObject.canonicalID("user@checkin.example");
                },
                "it is unchanged": function(id) {
                    assert.equal(id, "acct:user@checkin.example");
                }
            },
            "and we compare an acct: URI and a bare Webfinger": {
                topic: function(ActivityObject) {
                    return ActivityObject.sameID("acct:user@checkin.example", "user@checkin.example");
                },
                "it is a match": function(res) {
                    assert.isTrue(res);
                }
            },
            "and we check if a person is followable": {
                topic: function(ActivityObject) {
                    var Person = require("../lib/model/person").Person,
                        joey = new Person({displayName: "Joey", objectType: "person"});
                    return joey.isFollowable();
                },
                "it is": function(res) {
                    assert.isTrue(res);
                }
            },
            "and we check if a review is followable": {
                topic: function(ActivityObject) {
                    var Review = require("../lib/model/review").Review,
                        badReview = new Review({displayName: "You suck", objectType: "review"});
                    return badReview.isFollowable();
                },
                "it is not": function(res) {
                    assert.isFalse(res);
                }
            },
            "and we check if an object with an activity outbox is followable": {
                topic: function(ActivityObject) {
                    var Review = require("../lib/model/review").Review,
                        badReview = new Review({displayName: "You suck",
                                                objectType: "review",
                                                links: {
                                                    "activity-outbox": {
                                                        href: "http://example.com/review/outbox"
                                                    }
                                                }
                                               });
                    return badReview.isFollowable();
                },
                "it is": function(res) {
                    assert.isTrue(res);
                }
            },
            "and we trim a collection": {
                topic: function(ActivityObject) {
                    var props = {
                        likes: {
                            totalItems: 30,
                            items: [
                                {
                                    objectType: "person",
                                    id: "urn:uuid:4f9986da-0748-11e2-9deb-70f1a154e1aa"
                                }
                            ],
                            url: "http://social.example/api/note/10/likes"
                        }
                    };
                    ActivityObject.trimCollection(props, "likes");
                    return props;
                },
                "it works": function(props) {
                    assert.include(props, "likes");
                    assert.isFalse(_(props.likes).has("totalItems"));
                    assert.isFalse(_(props.likes).has("items"));
                    assert.isTrue(_(props.likes).has("url"));
                }
            },
            "and we check whether a full object is a reference": {
                topic: function(ActivityObject) {
                    var props = {
                        id: "urn:uuid:32003b5c-8680-11e2-acaf-70f1a154e1aa",
                        objectType: "note",
                        content: "Hello, world!"
                    };
                    return ActivityObject.isReference(props);
                },
                "it is not": function(isRef) {
                    assert.isFalse(isRef);
                }
            },
            "and we check whether a reference is a reference": {
                topic: function(ActivityObject) {
                    var props = {
                        id: "urn:uuid:5e2daa16-8680-11e2-823c-70f1a154e1aa",
                        objectType: "person"
                    };
                    return ActivityObject.isReference(props);
                },
                "it is": function(isRef) {
                    assert.isTrue(isRef);
                }
            },
            "and we get a stream of favoriters": {
                topic: function(ActivityObject) {
                    var cb = this.callback,
                        Place = require("../lib/model/place").Place,
                        place = null;
                    
                    Step(
                        function() {
                            Place.create({displayName: "Empire State Building",
                                          "position": "40.749-73.986/"},
                                         this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            place = results;
                            place.getFavoritersStream(this);
                        },
                        function(err, str) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, str);
                            }
                        }
                    );
                },
                "it works": function(err, str) {
                    assert.ifError(err);
                    assert.isObject(str);
                }
            },
            "and we get the string of an object with no id": {
                topic: function(ActivityObject) {
                    var Game = require("../lib/model/game").Game,
                        game = new Game({objectType: "game"});

                    return game.toString();
                },
                "it looks correct": function(str) {
                    assert.equal("[game]", str);
                }
            },
            "and we get the string of an object with an id": {
                topic: function(ActivityObject) {
                    var Game = require("../lib/model/game").Game,
                        game = new Game({objectType: "game",
                                         id: "urn:uuid:c52b69b6-b717-11e2-9d1e-2c8158efb9e9"});

                    return game.toString();
                },
                "it looks correct": function(str) {
                    assert.equal("[game urn:uuid:c52b69b6-b717-11e2-9d1e-2c8158efb9e9]", str);
                }
            },
            "and we get a sub-schema with no arguments": {
                topic: function(ActivityObject) {
                    return [ActivityObject.subSchema(), ActivityObject];
                },
                "it looks correct": function(parts) {
                    var sub = parts[0],
                        ActivityObject = parts[1];

                    assert.deepEqual(sub, ActivityObject.baseSchema);
                }
            },
            "and we get a sub-schema with removal arguments": {
                topic: function(ActivityObject) {
                    return [ActivityObject.subSchema(["attachments"]), ActivityObject];
                },
                "it looks correct": function(parts) {
                    var sub = parts[0],
                        ActivityObject = parts[1],
                        base = ActivityObject.baseSchema;

                    assert.deepEqual(sub.pkey, base.pkey);
                    assert.deepEqual(sub.indices, base.indices);
                    assert.deepEqual(sub.fields, _.without(base.fields, "attachments"));
                }
            },
            "and we get a sub-schema with add arguments": {
                topic: function(ActivityObject) {
                    return [ActivityObject.subSchema(null, ["members"]), ActivityObject];
                },
                "it looks correct": function(parts) {
                    var sub = parts[0],
                        ActivityObject = parts[1],
                        base = ActivityObject.baseSchema;

                    assert.deepEqual(sub.pkey, base.pkey);
                    assert.deepEqual(sub.indices, base.indices);
                    assert.deepEqual(sub.fields, _.union(base.fields, "members"));
                }
            },
            "and we get a sub-schema with remove and add arguments": {
                topic: function(ActivityObject) {
                    return [ActivityObject.subSchema(["attachments"], ["members"]), ActivityObject];
                },
                "it looks correct": function(parts) {
                    var sub = parts[0],
                        ActivityObject = parts[1],
                        base = ActivityObject.baseSchema;

                    assert.deepEqual(sub.pkey, base.pkey);
                    assert.deepEqual(sub.indices, base.indices);
                    assert.deepEqual(sub.fields, _.union(_.without(base.fields, "attachments"), "members"));
                }
            },
            "and we get a sub-schema with index arguments": {
                topic: function(ActivityObject) {
                    return [ActivityObject.subSchema(null, null, ["_slug"]), ActivityObject];
                },
                "it looks correct": function(parts) {
                    var sub = parts[0],
                        ActivityObject = parts[1],
                        base = ActivityObject.baseSchema;

                    assert.deepEqual(sub.pkey, base.pkey);
                    assert.deepEqual(sub.indices, _.union(base.indices, ["_slug"]));
                    assert.deepEqual(sub.fields, base.fields);
                }
            }
        }
    }
});

suite["export"](module);

