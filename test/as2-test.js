// as2-test.js
//
// Test the AS2 conversion module
//
// Copyright 2017 AJ Jordan <alex@strugee.net>
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

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    uuid = require("uuid");

var suite = vows.describe("AS2 conversion module interface");

var testVocabConversion = function(verb, newVerb) {
    return {
        topic: function(toAS2) {
            var act = {
                id: "urn:uuid:" + uuid.v4(),
                actor: "acct:evan@w3.example",
                verb: verb,
                to: [{objectType: "collection",
                      id: "http://w3.example/socialwg",
                      links: {
                          "next": "http://w3.example/a/next/url",
                          "prev": "http://w3.example/a/prev/url",
                          "last": "http://w3.example/a/last/url"
                      }}],
                target: {
                    id: "urn:uuid:" + uuid.v4(),
                    objectType: "note"
                }
            };

            toAS2(act, this.callback);
        },
        "type uses AS2 vocabulary": function(act) {
            assert.isFalse(act.hasOwnProperty("verb"));
            assert.equal(act["type"], newVerb);
        }
    };
};

suite.addBatch({
    "When we get the AS2 conversion module": {
        topic: function() {
            return require("../lib/as2");
        },
        "it works": function(err, as2) {
            assert.ifError(err);
            assert.isFunction(as2);
        },
        "and we try to convert a post of a note to AS2": {
            topic: function(as2) {
                var act = {
                    id: "urn:uuid:77451568-ce6a-42eb-8a9f-60ece187725f",
                    actor: "acct:tim@w3.example",
                    verb: "post",
                    title: "I am a title!",
                    upstreamDuplicates: [],
                    downstreamDuplicates: [],
                    to: [{objectType: "collection",
                          id: "http://w3.example/socialwg",
                          links: {
                              "next": "http://w3.example/a/next/url",
                              "prev": "http://w3.example/a/prev/url",
                              "last": "http://w3.example/a/last/url"
                          }}],
                    object: {
                        id: "urn:uuid:33166eb9-2567-477c-ad90-9352dd904712",
                        objectType: "note"
                    },
                    displayName: "A note"
                };

                as2(act, this.callback);
            },
            "it has an @context": function(act) {
                assert.isTrue(act.hasOwnProperty("@context"));
                assert.equal(act["@context"], "https://www.w3.org/ns/activitystreams");
            },
            "the `post` verb is converted specially to Create in type": function(act) {
                assert.isFalse(act.hasOwnProperty("verb"));
                assert.equal(act["type"], "Create");
            },
            "the object's objectType is renamed to type": function(act) {
                assert.isFalse(act.object.hasOwnProperty("objectType"));
                assert.equal(act.object["type"], "Note");
            },
            "the `to` field's collection's objectType is renamed to type": function(act) {
                assert.isObject(act.to);
                assert.isFalse(act.to.hasOwnProperty("objectType"));
                assert.equal(act.to.type, "Collection");
            },
            // XXX should we test for all objectType renames? E.g. in the `to` field?
            "displayName is renamed to name": function(act) {
                assert.isFalse(act.hasOwnProperty("displayName"));
                assert.equal(act.name, "A note");
            },
            "title is dropped": function(act) {
                assert.isFalse(act.hasOwnProperty("title"));
            },
            "upstreamDuplicates is dropped": function(act) {
                assert.isFalse(act.hasOwnProperty("upstreamDuplicates"));
            },
            "downstreamDuplicates is dropped": function(act) {
                assert.isFalse(act.hasOwnProperty("downstreamDuplicates"));
            }
        },
        "and we try to convert a post of a note to a collection to AS2": {
            topic: function(as2) {
                var act = {
                    id: "urn:uuid:3738fceb-9705-4fa8-a0d3-59852770dc4d",
                    actor: "acct:chris@w3.example",
                    verb: "post",
                    title: "A rando note I want to categorize",
                    to: [{objectType: "collection",
                          id: "http://w3.example/socialwg",
                          links: {
                              "next": "http://w3.example/a/next/url",
                              "prev": "http://w3.example/a/prev/url",
                              "last": "http://w3.example/a/last/url"
                          }}],
                    object: {
                        id: "urn:uuid:33166eb9-2567-477c-ad90-9352dd904712",
                        objectType: "note"
                    },
                    target: {
                        id: "http://w3.example/chris/a-collection",
                        objectType: "collection"
                    }
                };

                as2(act, this.callback);
            },
            "the `post` verb is converted specially to Add in type": function(act) {
                assert.isFalse(act.hasOwnProperty("verb"));
                assert.equal(act["type"], "Add");
            }
        },
        "and we try to convert a like of a note to AS2": {
            topic: function(as2) {
                var act = {
                    id: "urn:uuid:db8b4174-a321-430f-bbbe-e11c65dd48ee",
                    actor: "acct:aj@w3.example",
                    verb: "like",
                    to: [{objectType: "collection",
                          id: "http://w3.example/socialwg",
                          links: {
                              "next": "http://w3.example/a/next/url",
                              "prev": "http://w3.example/a/prev/url",
                              "last": "http://w3.example/a/last/url"
                          }}],
                    // TODO check that this syntax is correct
                    target: {
                        id: "urn:uuid:77451568-ce6a-42eb-8a9f-60ece187725f",
                        objectType: "note"
                    }
                };

                as2(act, this.callback);
            },
            "verb is renamed to type": function(act) {
                assert.isFalse(act.hasOwnProperty("verb"));
                assert.equal(act["type"], "Like");
            },
            "the target's objectType is renamed to type": function(act) {
                assert.isFalse(act.target.hasOwnProperty("objectType"));
                assert.equal(act.target["type"], "Note");
            }
        },
        "and we try to convert a submission of a note to AS2": {
            topic: function(as2) {
                var act = {
                    id: "urn:uuid:9e4a902d-8a3a-495d-b73c-cfa0cf32f310",
                    actor: "acct:amy@w3.example",
                    verb: "submit",
                    to: [{objectType: "collection",
                          id: "http://w3.example/socialwg",
                          links: {
                              "next": "http://w3.example/a/next/url",
                              "prev": "http://w3.example/a/prev/url",
                              "last": "http://w3.example/a/last/url"
                          }}],
                    object: {
                        id: "urn:uuid:404c13a3-65ba-43f0-a88d-9a2b07a21a17",
                        objectType: "note"
                    },
                    displayName: "A note"
                };

                as2(act, this.callback);
            },
            "the `submit` verb is converted specially to Create in type": function(act) {
                assert.isFalse(act.hasOwnProperty("verb"));
                assert.equal(act["type"], "Create");
            }
        },
        "and we try to convert a submission of a note to a collection to AS2": {
            topic: function(as2) {
                var act = {
                    id: "urn:uuid:8e765132-414a-4535-9949-c4650f22e493",
                    actor: "acct:tantek@w3.example",
                    verb: "submit",
                    title: "Some other random thing",
                    to: [{objectType: "collection",
                          id: "http://w3.example/socialwg",
                          links: {
                              "next": "http://w3.example/a/next/url",
                              "prev": "http://w3.example/a/prev/url",
                              "last": "http://w3.example/a/last/url"
                          }}],
                    object: {
                        id: "urn:uuid:aa6c312c-5294-4875-9f16-cb4d586127cb",
                        objectType: "note"
                    },
                    target: {
                        id: "http://w3.example/tantek/a-collection",
                        objectType: "collection"
                    }
                };

                as2(act, this.callback);
            },
            "the `submit` verb is converted specially to Add in type": function(act) {
                assert.isFalse(act.hasOwnProperty("verb"));
                assert.equal(act["type"], "Add");
            }
        },
        "and we try to convert a `share` activity to AS2": testVocabConversion("share", "Announce"),
        "and we try to convert a `attach` activity to AS2": testVocabConversion("attach", "Add"),
        "and we try to convert a `author` activity to AS2": testVocabConversion("author", "Create"),
        "and we try to convert a `favorite` activity to AS2": testVocabConversion("favorite", "Like"),
        "and we try to convert a `flag-as-inappropriate` activity to AS2": testVocabConversion("flag-as-inappropriate", "Flag"),
        "and we try to convert a `play` activity to AS2": testVocabConversion("play", "View"),
        "and we try to convert a `rsvp-maybe` activity to AS2": testVocabConversion("rsvp-maybe", "TentativeAccept"),
        "and we try to convert a `rsvp-no` activity to AS2": testVocabConversion("rsvp-no", "Reject"),
        "and we try to convert a `rsvp-yes` activity to AS2": testVocabConversion("rsvp-yes", "Accept"),
        "and we try to convert a `watch` activity to AS2": testVocabConversion("watch", "View")
    }
});

suite["export"](module);
