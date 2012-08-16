// filteredstream-test.js
//
// Test the filteredstream module
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
    schema = require("../lib/schema").schema,
    URLMaker = require("../lib/urlmaker").URLMaker,
    Stream = require("../lib/model/stream").Stream,
    Activity = require("../lib/model/activity").Activity,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("filtered stream interface");

suite.addBatch({
    "When we set up the environment": {
        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get("memory", params);

            db.connect({}, function(err) {
                if (err) {
                    cb(err);
                } else {
                    DatabankObject.bank = db;
                    cb(null);
                }
            });
        },
        "it works": function(err) {
            assert.ifError(err);
        },
        "and we load the filteredstream module": {
            topic: function() {
                return require("../lib/filteredstream");
            },
            "it works": function(mod) {
                assert.isObject(mod);
            },
            "and we get the FilteredStream class": {
                topic: function(mod) {
                    return mod.FilteredStream;
                },
                "it works": function(FilteredStream) {
                    assert.isFunction(FilteredStream);
                },
                "and we create a stream with lots of activities": {
                    topic: function(FilteredStream) {
                        var callback = this.callback,
                            str,
                            places = [
                                {displayName: "Montreal",
                                 id: "http://www.geonames.org/6077243/montreal.html"},
                                {displayName: "San Francisco",
                                 id: "http://www.geonames.org/5391959/san-francisco.html"}
                            ],
                            sentences = ["Hello, world!",
                                         "Testing 1, 2, 3.",
                                         "Now is the time for all good men to come to the aid of the party."],
                            actorIds = ["8d75183c-e74c-11e1-8115-70f1a154e1aa",
                                        "8d7589a2-e74c-11e1-b7e1-70f1a154e1aa",
                                        "8d75f4fa-e74c-11e1-8cbe-70f1a154e1aa",
                                        "8d764306-e74c-11e1-848f-70f1a154e1aa",
                                        "8d76ad0a-e74c-11e1-b1bc-70f1a154e1aa"],
                            moods = ["happy", "sad", "frightened", "mad", "excited", "glad", "bored"],
                            tags = ["ggi", "winning", "justsayin", "ows", "sep17", "jan25",
                                    "egypt", "fail", "tigerblood", "bitcoin", "fsw"],
                            total;
                        
                        total = places.length * sentences.length * actorIds.length * moods.length * tags.length;

                        Step(
                            function() {
                                Stream.create({name: "test"}, this);
                            },
                            function(err, result) {
                                var i, act, group = this.group();
                                if (err) throw err;
                                str = result;
                                for (i = 0; i < total; i++) {
                                    act = {
                                        actor: {
                                            objectType: "person",
                                            displayName: "Anonymous",
                                            id: actorIds[i % actorIds.length]
                                        },
                                        verb: "post",
                                        object: {
                                            objectType: "note",
                                            content: sentences[i % sentences.length] + " #" + tags[i % tags.length],
                                            tags: [{
                                                objectType: "http://activityschema.org/object/hashtag",
                                                displayName: tags[i % tags.length]
                                            }]
                                        },
                                        location: places[i % places.length],
                                        mood: {
                                            displayName: moods[i % moods.length]
                                        }
                                    };
                                    Activity.create(act, group());
                                }
                            },
                            function(err, acts) {
                                var i, group = this.group();
                                if (err) throw err;
                                for (i = 0; i < acts.length; i++) {
                                    str.deliver(acts[i], group());
                                }
                            },
                            function(err) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    callback(null, str);
                                }
                            }
                        );
                    },
                    "it works": function(err, str) {
                        assert.ifError(err);
                        assert.isObject(str);
                        assert.instanceOf(str, Stream);
                    },
                    "and we add a filter by mood": {
                        topic: function(str, FilteredStream) {
                            var byMood = function(mood) {
                                return function(id, callback) {
                                    Step(
                                        function() {
                                            Activity.get(id, this);
                                        },
                                        function(err, act) {
                                            if (err) {
                                                callback(err, null);
                                            } else if (act.mood.displayName == mood) {
                                                callback(null, true);
                                            } else {
                                                callback(null, false);
                                            }
                                        }
                                    );
                                };
                            };
                            return new FilteredStream(str, byMood("happy"));
                        },
                        "it works": function(fs) {
                            assert.isObject(fs);
                        },
                        "it has a getIDs() method": function(fs) {
                            assert.isFunction(fs.getIDs);
                        },
                        "it has a getIDsGreaterThan() method": function(fs) {
                            assert.isFunction(fs.getIDsGreaterThan);
                        },
                        "it has a getIDsLessThan() method": function(fs) {
                            assert.isFunction(fs.getIDsLessThan);
                        },
                        "it has a count() method": function(fs) {
                            assert.isFunction(fs.count);
                        },
                        "and we get the filtered stream's count": {
                            topic: function(fs) {
                                fs.count(this.callback);
                            },
                            "it works": function(err, cnt) {
                                assert.ifError(err);
                            },
                            "it has the value of the full stream": function(err, cnt) {
                                assert.ifError(err);
                                assert.equal(cnt, 2310);
                            }
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
