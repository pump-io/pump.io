// scrubber-test.js
//
// Test the scrubber module
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
    _ = require("underscore");

var DANGEROUS = "This is a <script>alert('Boo!')</script> dangerous string.";
var HARMLESS = "This is a harmless string.";

vows.describe("scrubber module interface").addBatch({
    "When we require the scrubber module": {
        topic: function() {
            return require("../lib/scrubber");
        },
        "it works": function(stamper) {
            assert.isObject(stamper);
        },
        "and we get its Scrubber export": {
            topic: function(scrubber) {
                return scrubber.Scrubber;
            },
            "it exists": function(Scrubber) {
                assert.isObject(Scrubber);
            },
            "it has a scrub() method": function(Scrubber) {
                assert.isFunction(Scrubber.scrub);
            },
            "it has a scrubActivity() method": function(Scrubber) {
                assert.isFunction(Scrubber.scrubActivity);
            },
            "it has a scrubObject() method": function(Scrubber) {
                assert.isFunction(Scrubber.scrubObject);
            },
            "and we scrub some dangerous text": {
                topic: function(Scrubber) {
                    return Scrubber.scrub(DANGEROUS);
                },
                "it works": function(result) {
                    assert.isString(result);
                    assert.equal(result.indexOf("<script>"), -1);
                }
            },
            "and we scrub some innocuous text": {
                topic: function(Scrubber) {
                    return Scrubber.scrub(HARMLESS);
                },
                "it works": function(result) {
                    assert.isString(result);
                    assert.equal(result, HARMLESS);
                }
            },
            "and we scrub an object with innocuous content": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        content: HARMLESS
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isString(result.content);
                    assert.equal(result.content, HARMLESS);
                }
            },
            "and we scrub an object with dangerous content": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        content: DANGEROUS
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isString(result.content);
                    assert.equal(result.content.indexOf("<script>"), -1);
                }
            },
            "and we scrub an object with innocuous summary": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        summary: HARMLESS
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isString(result.summary);
                    assert.equal(result.summary, HARMLESS);
                }
            },
            "and we scrub an object with dangerous summary": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        summary: DANGEROUS
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isString(result.summary);
                    assert.equal(result.summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an object with innocuous author": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        author: {
                            objectType: "person",
                            summary: HARMLESS
                        }
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.author);
                    assert.isString(result.author.summary);
                    assert.equal(result.author.summary, HARMLESS);
                }
            },
            "and we scrub an object with a dangerous author": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        author: {
                            objectType: "person",
                            summary: DANGEROUS
                        }
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.author);
                    assert.isString(result.author.summary);
                    assert.equal(result.author.summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an object with innocuous location": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        location: {
                            objectType: "place",
                            summary: HARMLESS
                        }
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.location);
                    assert.isString(result.location.summary);
                    assert.equal(result.location.summary, HARMLESS);
                }
            },
            "and we scrub an object with a dangerous location": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        location: {
                            objectType: "place",
                            summary: DANGEROUS
                        }
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.location);
                    assert.isString(result.location.summary);
                    assert.equal(result.location.summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an object with innocuous attachments": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        attachments: [
                            {
                                objectType: "image",
                                summary: HARMLESS
                            },
                            {
                                objectType: "image",
                                summary: HARMLESS
                            }
                        ]
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isArray(result.attachments);
                    assert.lengthOf(result.attachments, 2);
                    assert.isObject(result.attachments[0]);
                    assert.isObject(result.attachments[1]);
                    assert.isString(result.attachments[0].summary);
                    assert.isString(result.attachments[1].summary);
                    assert.equal(result.attachments[0].summary, HARMLESS);
                    assert.equal(result.attachments[1].summary, HARMLESS);
                }
            },
            "and we scrub an object with dangerous attachments": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        attachments: [
                            {
                                objectType: "image",
                                summary: DANGEROUS
                            },
                            {
                                objectType: "image",
                                summary: DANGEROUS
                            }
                        ]
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isArray(result.attachments);
                    assert.lengthOf(result.attachments, 2);
                    assert.isObject(result.attachments[0]);
                    assert.isObject(result.attachments[1]);
                    assert.isString(result.attachments[0].summary);
                    assert.isString(result.attachments[1].summary);
                    assert.equal(result.attachments[0].summary.indexOf("<script>"), -1);
                    assert.equal(result.attachments[1].summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an object with innocuous tags": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        tags: [
                            {
                                objectType: "image",
                                summary: HARMLESS
                            },
                            {
                                objectType: "image",
                                summary: HARMLESS
                            }
                        ]
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isArray(result.tags);
                    assert.lengthOf(result.tags, 2);
                    assert.isObject(result.tags[0]);
                    assert.isObject(result.tags[1]);
                    assert.isString(result.tags[0].summary);
                    assert.isString(result.tags[1].summary);
                    assert.equal(result.tags[0].summary, HARMLESS);
                    assert.equal(result.tags[1].summary, HARMLESS);
                }
            },
            "and we scrub an object with dangerous tags": {
                topic: function(Scrubber) {
                    var obj = {
                        objectType: "note",
                        tags: [
                            {
                                objectType: "image",
                                summary: DANGEROUS
                            },
                            {
                                objectType: "image",
                                summary: DANGEROUS
                            }
                        ]
                    };
                    return Scrubber.scrubObject(obj);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isArray(result.tags);
                    assert.lengthOf(result.tags, 2);
                    assert.isObject(result.tags[0]);
                    assert.isObject(result.tags[1]);
                    assert.isString(result.tags[0].summary);
                    assert.isString(result.tags[1].summary);
                    assert.equal(result.tags[0].summary.indexOf("<script>"), -1);
                    assert.equal(result.tags[1].summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an activity with innocuous content": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: HARMLESS,
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isString(result.content);
                    assert.equal(result.content, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous content": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: DANGEROUS,
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isString(result.content);
                    assert.equal(result.content.indexOf("<script>"), -1);
                }
            },
            "and we scrub an activity with innocuous actor": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous",
                            summary: HARMLESS
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.actor);
                    assert.isString(result.actor.summary);
                    assert.equal(result.actor.summary, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous actor": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous",
                            summary: DANGEROUS
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.actor);
                    assert.isString(result.actor.summary);
                    assert.equal(result.actor.summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an activity with innocuous object": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous",
                            summary: HARMLESS
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: HARMLESS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.object);
                    assert.isString(result.object.content);
                    assert.equal(result.object.content, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous object": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: DANGEROUS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.object);
                    assert.isString(result.object.content);
                    assert.equal(result.object.content.indexOf("<script>"), -1);
                }
            },
            "and we scrub an activity with innocuous target": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        target: {
			    id: "urn:uuid:b9b0a2b4-96b8-463a-8941-708210ef202b",
                            objectType: "collection",
                            summary: HARMLESS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.target);
                    assert.isString(result.target.summary);
                    assert.equal(result.target.summary, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous target": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        target: {
			    id: "urn:uuid:90528c00-ec91-4d27-880b-46ae3c374619",
                            objectType: "collection",
                            summary: DANGEROUS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.target);
                    assert.isString(result.target.summary);
                    assert.equal(result.target.summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an activity with innocuous generator": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        generator: {
                            objectType: "application",
                            summary: HARMLESS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.generator);
                    assert.isString(result.generator.summary);
                    assert.equal(result.generator.summary, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous generator": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        generator: {
                            objectType: "application",
                            summary: DANGEROUS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.generator);
                    assert.isString(result.generator.summary);
                    assert.equal(result.generator.summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an activity with innocuous provider": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        provider: {
                            objectType: "application",
                            summary: HARMLESS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.provider);
                    assert.isString(result.provider.summary);
                    assert.equal(result.provider.summary, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous provider": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        provider: {
                            objectType: "application",
                            summary: DANGEROUS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.provider);
                    assert.isString(result.provider.summary);
                    assert.equal(result.provider.summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an activity with innocuous context": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        context: {
                            objectType: "event",
                            summary: HARMLESS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.context);
                    assert.isString(result.context.summary);
                    assert.equal(result.context.summary, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous context": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        context: {
                            objectType: "event",
                            summary: DANGEROUS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.context);
                    assert.isString(result.context.summary);
                    assert.equal(result.context.summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an activity with innocuous source": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        source: {
                            objectType: "collection",
                            summary: HARMLESS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.source);
                    assert.isString(result.source.summary);
                    assert.equal(result.source.summary, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous source": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        source: {
                            objectType: "collection",
                            summary: DANGEROUS
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.source);
                    assert.isString(result.source.summary);
                    assert.equal(result.source.summary.indexOf("<script>"), -1);
                }
            },
            "and we scrub an activity with innocuous 'to' recipients": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        to: [
                            {
                                objectType: "person",
                                summary: HARMLESS
                            },
                            {
                                objectType: "person",
                                summary: HARMLESS
                            }
                        ]
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result);
                    assert.isArray(result.to);
                    assert.lengthOf(result.to, 2);
                    assert.isObject(result.to[0]);
                    assert.isObject(result.to[1]);
                    assert.isString(result.to[0].summary);
                    assert.isString(result.to[1].summary);
                    assert.equal(result.to[0].summary, HARMLESS);
                    assert.equal(result.to[1].summary, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous 'to' recipients": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        to: [
                            {
                                objectType: "person",
                                summary: DANGEROUS
                            },
                            {
                                objectType: "person",
                                summary: DANGEROUS
                            }
                        ]
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result);
                    assert.isArray(result.to);
                    assert.lengthOf(result.to, 2);
                    assert.isObject(result.to[0]);
                    assert.isObject(result.to[1]);
                    assert.isString(result.to[0].summary);
                    assert.isString(result.to[1].summary);
                    assert.equal(result.to[0].summary.indexOf('<script>'), -1);
                    assert.equal(result.to[1].summary.indexOf('<script>'), -1);
                }
            },
            "and we scrub an activity with innocuous 'cc' recipients": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        cc: [
                            {
                                objectType: "person",
                                summary: HARMLESS
                            },
                            {
                                objectType: "person",
                                summary: HARMLESS
                            }
                        ]
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result);
                    assert.isArray(result.cc);
                    assert.lengthOf(result.cc, 2);
                    assert.isObject(result.cc[0]);
                    assert.isObject(result.cc[1]);
                    assert.isString(result.cc[0].summary);
                    assert.isString(result.cc[1].summary);
                    assert.equal(result.cc[0].summary, HARMLESS);
                    assert.equal(result.cc[1].summary, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous 'cc' recipients": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        cc: [
                            {
                                objectType: "person",
                                summary: DANGEROUS
                            },
                            {
                                objectType: "person",
                                summary: DANGEROUS
                            }
                        ]
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result);
                    assert.isArray(result.cc);
                    assert.lengthOf(result.cc, 2);
                    assert.isObject(result.cc[0]);
                    assert.isObject(result.cc[1]);
                    assert.isString(result.cc[0].summary);
                    assert.isString(result.cc[1].summary);
                    assert.equal(result.cc[0].summary.indexOf('<script>'), -1);
                    assert.equal(result.cc[1].summary.indexOf('<script>'), -1);
                }
            },
            "and we scrub an activity with innocuous 'bto' recipients": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        bto: [
                            {
                                objectType: "person",
                                summary: HARMLESS
                            },
                            {
                                objectType: "person",
                                summary: HARMLESS
                            }
                        ]
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result);
                    assert.isArray(result.bto);
                    assert.lengthOf(result.bto, 2);
                    assert.isObject(result.bto[0]);
                    assert.isObject(result.bto[1]);
                    assert.isString(result.bto[0].summary);
                    assert.isString(result.bto[1].summary);
                    assert.equal(result.bto[0].summary, HARMLESS);
                    assert.equal(result.bto[1].summary, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous 'bto' recipients": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        bto: [
                            {
                                objectType: "person",
                                summary: DANGEROUS
                            },
                            {
                                objectType: "person",
                                summary: DANGEROUS
                            }
                        ]
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result);
                    assert.isArray(result.bto);
                    assert.lengthOf(result.bto, 2);
                    assert.isObject(result.bto[0]);
                    assert.isObject(result.bto[1]);
                    assert.isString(result.bto[0].summary);
                    assert.isString(result.bto[1].summary);
                    assert.equal(result.bto[0].summary.indexOf('<script>'), -1);
                    assert.equal(result.bto[1].summary.indexOf('<script>'), -1);
                }
            },
            "and we scrub an activity with innocuous 'bcc' recipients": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        bcc: [
                            {
                                objectType: "person",
                                summary: HARMLESS
                            },
                            {
                                objectType: "person",
                                summary: HARMLESS
                            }
                        ]
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result);
                    assert.isArray(result.bcc);
                    assert.lengthOf(result.bcc, 2);
                    assert.isObject(result.bcc[0]);
                    assert.isObject(result.bcc[1]);
                    assert.isString(result.bcc[0].summary);
                    assert.isString(result.bcc[1].summary);
                    assert.equal(result.bcc[0].summary, HARMLESS);
                    assert.equal(result.bcc[1].summary, HARMLESS);
                }
            },
            "and we scrub an activity with dangerous 'bcc' recipients": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        },
                        bcc: [
                            {
                                objectType: "person",
                                summary: DANGEROUS
                            },
                            {
                                objectType: "person",
                                summary: DANGEROUS
                            }
                        ]
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result);
                    assert.isArray(result.bcc);
                    assert.lengthOf(result.bcc, 2);
                    assert.isObject(result.bcc[0]);
                    assert.isObject(result.bcc[1]);
                    assert.isString(result.bcc[0].summary);
                    assert.isString(result.bcc[1].summary);
                    assert.equal(result.bcc[0].summary.indexOf('<script>'), -1);
                    assert.equal(result.bcc[1].summary.indexOf('<script>'), -1);
                }
            },
            "and we scrub an activity with private members": {
                topic: function(Scrubber) {
                    var act = {
                        _uuid: "MADEUP",
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isFalse(_.has(result, "_uuid"));
                }
            },
            "and we scrub an activity with an actor with private members": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous",
                            _user: true
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!"
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.actor);
                    assert.isFalse(_.has(result.actor, "_user"));
                }
            },
            "and we scrub an activity with an object with private members": {
                topic: function(Scrubber) {
                    var act = {
                        actor: {
                            objectType: "person",
                            displayName: "Anonymous"
                        },
                        verb: "post",
                        content: "Anonymous posted a note",
                        object: {
                            objectType: "note",
                            content: "Hello, world!",
                            _uuid: true
                        }
                    };
                    return Scrubber.scrubActivity(act);
                },
                "it works": function(result) {
                    assert.isObject(result);
                    assert.isObject(result.object);
                    assert.isFalse(_.has(result.object, "_uuid"));
                }
            }
        }
    }
})["export"](module);
