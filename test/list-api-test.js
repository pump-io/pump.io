// list-api-test.js
//
// Test user collections of people
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
    Step = require('step'),
    _ = require('underscore'),
    http = require('http'),
    urlparse = require('url').parse,
    OAuth = require('oauth').OAuth,
    httputil = require('./lib/http'),
    oauthutil = require('./lib/oauth'),
    actutil = require('./lib/activity'),
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair,
    register = oauthutil.register;

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var assertValidList = function(doc, count) {
    assert.include(doc, 'author');
    assert.include(doc.author, 'id');
    assert.include(doc.author, 'displayName');
    assert.include(doc.author, 'objectType');
    assert.include(doc, 'totalItems');
    assert.include(doc, 'items');
    assert.include(doc, 'displayName');
    assert.include(doc, 'id');
    if (_(count).isNumber()) {
        assert.equal(doc.totalItems, count);
        assert.lengthOf(doc.items, count);
    }
};

var assertValidActivity = function(act) {
    assert.isString(act.id);
    assert.include(act, 'actor');
    assert.isObject(act.actor);
    assert.include(act.actor, 'id');
    assert.isString(act.actor.id);
    assert.include(act, 'verb');
    assert.isString(act.verb);
    assert.include(act, 'object');
    assert.isObject(act.object);
    assert.include(act.object, 'id');
    assert.isString(act.object.id);
    assert.include(act, 'published');
    assert.isString(act.published);
    assert.include(act, 'updated');
    assert.isString(act.updated);
};

var suite = vows.describe('list api test');

// A batch to test following/unfollowing users

suite.addBatch({
    'When we set up the app': {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        'it works': function(err, app) {
            assert.ifError(err);
        },
        'and we register a client': {
            topic: function() {
                newClient(this.callback);
            },
            'it works': function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            'and we get the list of lists owned by a new user': {
                topic: function(cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            newPair(cl, "eekamouse", "bongbongdiggydiggydang", this);
                        },
                        function(err, pair) {
                            if (err) throw err;
                            var cred = makeCred(cl, pair),
                                url = 'http://localhost:4815/api/user/eekamouse/lists';

                            httputil.getJSON(url, cred, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc);
                        }
                    );
                },
                'it works': function(err, lists) {
                    assert.ifError(err);
                },
                'it is valid': function(err, lists) {
                    assert.ifError(err);
                    assertValidList(lists, 0);
                }
            },
            'and a user creates a list': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null;

                    Step(
                        function() {
                            newPair(cl, "yellowman", "nobodymove", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            var cred = makeCred(cl, pair),
                                url = 'http://localhost:4815/api/user/yellowman/feed',
                                act = {
                                    verb: "post",
                                    object: {
                                        objectType: "collection",
                                        displayName: "Bad Boys"
                                    }
                                };

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc, pair);
                        }
                    );
                },
                'it works': function(err, act, pair) {
                    assert.ifError(err);
                    assert.isObject(act);
                },
                'results look correct': function(err, act, pair) {
                    assert.include(act, 'id');
                    assertValidActivity(act);
                },
                'object has correct data': function(err, act) {
                    assert.ifError(err);
                    assert.equal(act.object.objectType, 'collection');
                    assert.equal(act.object.displayName, 'Bad Boys');
                    assert.include(act.object, 'url');
                    assert.include(act.object, 'totalItems');
                    assert.equal(act.object.totalItems, 0);
                    assert.include(act.object, 'items');
                    assert.include(act.object, 'links');
                    assert.include(act.object.links, 'self');
                },
                'and we get the list of lists owned by the user': {
                    topic: function(act, pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = 'http://localhost:4815/api/user/yellowman/lists';

                        httputil.getJSON(url, cred, function(err, doc, response) {
                            cb(err, doc, act.object);
                        });
                    },
                    'it works': function(err, lists, collection) {
                        assert.ifError(err);
                        assert.isObject(lists);
                    },
                    'it looks correct': function(err, lists, collection) {
                        assert.ifError(err);
                        assertValidList(lists, 1);
                        assert.include(lists, 'objectTypes');
                        assert.isArray(lists.objectTypes);
                        assert.include(lists.objectTypes, "collection");
                    },
                    'it contains the new list': function(err, lists, collection) {
                        assert.ifError(err);
                        assert.include(lists, 'items');
                        assert.isArray(lists.items);
                        assert.lengthOf(lists.items, 1);
                        assert.equal(lists.items[0].id, collection.id);
                    }
                }
            },
            'and a user creates a lot of lists': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null;

                    Step(
                        function() {
                            newPair(cl, "dekker", "sabotage", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            var cred = makeCred(cl, pair),
                                url = 'http://localhost:4815/api/user/dekker/feed',
                                act = {
                                    verb: "post",
                                    object: {
                                        objectType: "collection"
                                    }
                                },
                                acti,
                                group = this.group();

                            for (var i = 0; i < 100; i++) {
                                acti = _(act).clone();
                                acti.object.displayName = "Israelites #" + i;
                                httputil.postJSON(url, cred, acti, group());
                            }
                        },
                        function(err, docs, responses) {
                            cb(err, docs, pair);
                        }
                    );
                },
                'it works': function(err, lists) {
                    assert.ifError(err);
                    assert.isArray(lists);
                    assert.lengthOf(lists, 100);
                    for (var i = 0; i < 100; i++) {
                        assert.isObject(lists[i]);
                        assertValidActivity(lists[i]);
                    }
                },
                'and we get the list of lists owned by the user': {
                    topic: function(acts, pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = 'http://localhost:4815/api/user/yellowman/lists';

                        httputil.getJSON(url, cred, function(err, doc, response) {
                            cb(err, doc);
                        });
                    },
                    'it works': function(err, lists, acts) {
                        assert.ifError(err);
                        assert.isObject(lists);
                    },
                    'it looks correct': function(err, lists, acts) {
                        assert.ifError(err);
                        assertValidList(lists, 20);
                        assert.include(lists, 'objectTypes');
                        assert.isArray(lists.objectTypes);
                        assert.include(lists.objectTypes, "collections");
                    }
                }
            },
            'and a user deletes a list': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null,
                        cred = null,
                        url = 'http://localhost:4815/api/user/maxromeo/feed',
                        list = null;

                    Step(
                        function() {
                            newPair(cl, "maxromeo", "warina", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            cred = makeCred(cl, pair);
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "collection",
                                    displayName: "Babylonians"
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            list = doc.object;
                            var act = {
                                verb: "delete",
                                object: list
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc, pair);
                        }
                    );
                },
                'it works': function(err, act) {
                    assert.ifError(err);
                    assertValidActivity(act);
                },
                'and we get the list of lists owned by the user': {
                    topic: function(act, pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = 'http://localhost:4815/api/user/maxromeo/lists';

                        httputil.getJSON(url, cred, function(err, doc, response) {
                            cb(err, doc);
                        });
                    },
                    'it works': function(err, lists, acts) {
                        assert.ifError(err);
                        assert.isObject(lists);
                    },
                    'it looks correct': function(err, lists, acts) {
                        assert.ifError(err);
                        assertValidList(lists, 0);
                        assert.include(lists, 'objectTypes');
                        assert.isArray(lists.objectTypes);
                        assert.include(lists.objectTypes, "collections");
                    }
                }
            },
            'and a user deletes a non-existent list': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null,
                        cred = null,
                        url = 'http://localhost:4815/api/user/scratch/feed',
                        list = null;

                    Step(
                        function() {
                            newPair(cl, "scratch", "roastfish&cornbread", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            cred = makeCred(cl, pair);
                            var act = {
                                verb: "delete",
                                object: {
                                    objectType: "collection",
                                    id: "urn:uuid:88374dac-7ce7-40da-bbde-6655181d8458"
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err) {
                                cb(err);
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
            'and a user creates a list that already exists': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null,
                        cred = null,
                        url = 'http://localhost:4815/api/user/petertosh/feed';

                    Step(
                        function() {
                            newPair(cl, "petertosh", "=rights", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            cred = makeCred(cl, pair);
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "collection",
                                    displayName: "Wailers"
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "collection",
                                    displayName: "Wailers"
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err) {
                                cb(err);
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
            'and a user adds another user to a created list': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null,
                        cred = null,
                        url = 'http://localhost:4815/api/user/patobanton/feed',
                        list;

                    Step(
                        function() {
                            newPair(cl, "patobanton", "myopinion", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            cred = makeCred(cl, pair);
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "collection",
                                    displayName: "Collaborators"
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            list = doc;
                            register(cl, "roger", "ranking", this);
                        },
                        function(err, user) {
                            if (err) {
                                cb(err, null, null);
                                return;
                            }
                            var act = {
                                verb: "add",
                                object: user.profile,
                                target: list
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc, pair); 
                        }
                    );
                },
                'it works': function(err, act, pair) {
                    assert.ifError(err);
                },
                'and we get the collection of users in that list': {
                    topic: function(act, pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = act.target.url;

                        httputil.getJSON(url, cred, function(err, doc, response) {
                            cb(err, doc, act.object);
                        });
                    },
                    'it works': function(err, list, person) {
                        assert.ifError(err);
                        assert.isObject(list);
                        assert.isObject(person);
                        assertValidList(list, 1);
                    },
                    'it includes that user': function(err, list, person) {
                        assert.ifError(err);
                        assert.lengthOf(list.items, 1);
                        assert.equal(list.items[0].id, person.id);
                    },
                    'and the user removes the other user from the list': {
                        topic: function(list, person, act, pair, cl) {
                            var cb = this.callback,
                                cred = makeCred(cl, pair),
                                url = 'http://localhost:4815/api/user/patobanton/feed',
                                ract = {
                                    verb: "remove",
                                    object: person,
                                    target: list
                                };
                            httputil.postJSON(url, cred, ract, cb);
                        },
                        'it works': function(err, doc, response) {
                            assert.ifError(err);
                            assertValidActivity(doc);
                        }
                    }
                }
            },
            'and a user adds another user to a not-yet-created list': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null,
                        cred = null,
                        url = 'http://localhost:4815/api/user/sly/feed';

                    Step(
                        function() {
                            newPair(cl, "sly", "drum", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            cred = makeCred(cl, pair);
                            register(cl, "robbie", "bass", this);
                        },
                        function(err, user) {
                            if (err) {
                                cb(err, null, null);
                                return;
                            }
                            var act = {
                                verb: "add",
                                object: user.profile,
                                target: {
                                    objectType: "collection",
                                    displayName: "Band"
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc, pair); 
                        }
                    );
                },
                'it works': function(err, doc, pair) {
                    assert.ifError(err);
                    assertValidActivity(doc);
                },
                'and we get the collection of users in that list': {
                    topic: function(act, pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = act.target.url;

                        httputil.getJSON(url, cred, function(err, doc, response) {
                            cb(err, doc, act.object);
                        });
                    },
                    'it works': function(err, list, person) {
                        assert.ifError(err);
                        assert.isObject(list);
                        assert.isObject(person);
                        assertValidList(list, 1);
                    },
                    'it includes that user': function(err, list, person) {
                        assert.ifError(err);
                        assert.lengthOf(list.items, 1);
                        assert.equal(list.items[0].id, person.id);
                    }
                }
            },
            'and a user adds an arbitrary person to a list': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null,
                        cred = null,
                        url = 'http://localhost:4815/api/user/toots/feed',
                        list;

                    Step(
                        function() {
                            newPair(cl, "toots", "54-46", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            cred = makeCred(cl, pair);
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "collection",
                                    displayName: "Maytals"
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            list = doc;
                            var act = {
                                verb: "add",
                                object: {
                                    id: "urn:uuid:bd4de1f6-b5dd-11e1-a58c-70f1a154e1aa",
                                    objectType: "person",
                                    displayName: "Raleigh Gordon"
                                },
                                target: list
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            cb(err, doc, pair); 
                        }
                    );
                },
                'it works': function(err, doc, pair) {
                    assert.ifError(err);
                    assertValidActivity(doc);
                },
                'and we get the collection of users in that list': {
                    topic: function(act, pair, cl) {
                        var cb = this.callback,
                            cred = makeCred(cl, pair),
                            url = act.target.url;

                        httputil.getJSON(url, cred, function(err, doc, response) {
                            cb(err, doc, act.object);
                        });
                    },
                    'it works': function(err, list, person) {
                        assert.ifError(err);
                        assert.isObject(list);
                        assert.isObject(person);
                        assertValidList(list, 1);
                    },
                    'it includes that user': function(err, list, person) {
                        assert.ifError(err);
                        assert.lengthOf(list.items, 1);
                        assert.equal(list.items[0].id, person.id);
                    }
                }
            },
            'and a user removes another person from a list they\'re not in': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null,
                        cred = null,
                        url = 'http://localhost:4815/api/user/bunny/feed',
                        list;

                    Step(
                        function() {
                            newPair(cl, "bunny", "number3", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            cred = makeCred(cl, pair);
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "collection",
                                    displayName: "Wailers"
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            list = doc;
                            var act = {
                                verb: "remove",
                                object: {
                                    id: "urn:uuid:88b33906-b9c9-11e1-98f5-70f1a154e1aa",
                                    objectType: "person",
                                    displayName: "Rita Marley"
                                },
                                target: list
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err) {
                                cb(err);
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
            'and a user adds another user to a list they don\'t own': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair1 = null,
                        pair2 = null,
                        cred1 = null,
                        cred2 = null,
                        url1 = 'http://localhost:4815/api/user/burningspear/feed',
                        url2 = 'http://localhost:4815/api/user/sugar/feed',
                        list;

                    Step(
                        function() {
                            newPair(cl, "burningspear", "m4rcus", this.parallel());
                            newPair(cl, "sugar", "minott", this.parallel());
                        },
                        function(err, results1, results2) {
                            if (err) throw err;
                            pair1 = results1;
                            pair2 = results2;
                            cred1 = makeCred(cl, pair1);
                            cred2 = makeCred(cl, pair2);
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "collection",
                                    displayName: "Rastafarians"
                                }
                            };
                            httputil.postJSON(url1, cred1, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            list = doc;
                            var act = {
                                verb: "add",
                                object: {
                                    id: "urn:uuid:3db214bc-ba10-11e1-b5ac-70f1a154e1aa",
                                    objectType: "person",
                                    displayName: "Hillary Clinton"
                                },
                                target: list
                            };
                            httputil.postJSON(url2, cred2, act, this);
                        },
                        function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err) {
                                cb(err);
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
            'and a user removes another user from a list they don\'t own': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair1 = null,
                        pair2 = null,
                        cred1 = null,
                        cred2 = null,
                        url1 = 'http://localhost:4815/api/user/junior/feed',
                        url2 = 'http://localhost:4815/api/user/marcia/feed',
                        list;

                    Step(
                        function() {
                            newPair(cl, "junior", "murvin", this.parallel());
                            newPair(cl, "marcia", "griffiths", this.parallel());
                        },
                        function(err, results1, results2) {
                            if (err) throw err;
                            pair1 = results1;
                            pair2 = results2;
                            cred1 = makeCred(cl, pair1);
                            cred2 = makeCred(cl, pair2);
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "collection",
                                    displayName: "Police"
                                }
                            };
                            httputil.postJSON(url1, cred1, act, this);
                        },
                        function(err, doc, response) {
                            if (err) throw err;
                            list = doc;
                            var act = {
                                verb: "add",
                                object: {
                                    id: "urn:uuid:acfadb0a-ba16-11e1-bcbc-70f1a154e1aa",
                                    objectType: "person",
                                    displayName: "J. Edgar Hoover"
                                },
                                target: list
                            };
                            httputil.postJSON(url1, cred1, act, this);
                        },
                        function(err, doc, response) {
                            if (err) {
                                // Got an error up to here; it's an error
                                cb(err);
                                return;
                            }
                            var act = {
                                verb: "remove",
                                object: doc.object,
                                target: list
                            };
                            httputil.postJSON(url2, cred2, act, this);
                        },
                        function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err) {
                                cb(err);
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
            'and a user creates a list': {
                topic: function(cl) {
                    var cb = this.callback,
                        pair = null,
                        cred = null,
                        url = 'http://localhost:4815/api/user/jimmy/feed';

                    Step(
                        function() {
                            newPair(cl, "jimmy", "cliff", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            pair = results;
                            cred = makeCred(cl, pair);
                            var act = {
                                verb: "post",
                                object: {
                                    objectType: "collection",
                                    displayName: "Beautiful People"
                                }
                            };
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, cred, doc.object);
                            }
                        }
                    );
                },
                'it works': function(err, cred, list) {
                    assert.ifError(err);
                },
                'and we try to read it with no credentials': {
                    topic: function(cred, list, cl) {
                        var cb = this.callback,
                            parsed = urlparse(list.links.self),
                            options = {
                                host: 'localhost',
                                port: 4815,
                                path: parsed.path
                            };
                        http.get(options, function(res) {
                            if (res.statusCode >= 400 && res.statusCode < 500) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected status code"));
                            }
                        }).on('error', function(err) {
                            cb(err);
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we read it with another user\'s credentials': {
                    topic: function(cred, list, cl) {
                        var cb = this.callback,
                            other = null;

                        Step(
                            function() {
                                newPair(cl, "ziggy", "blahblah", this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                other = makeCred(cl, results);
                                httputil.getJSON(list.links.self, cred, this);
                            },
                            function(err, doc, response) {
                                if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                    cb(null);
                                } else if (err) {
                                    cb(err);
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
                'and we read it with only client credentials': {
                    topic: function(cred, list, cl) {
                        var cb = this.callback;

                        Step(
                            function() {
                                var justcl = makeCred(cl, {});
                                httputil.getJSON(list.links.self, justcl, this);
                            },
                            function(err, doc, response) {
                                if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                    cb(null);
                                } else if (err) {
                                    cb(err);
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
                'and we read it with the creator credentials': {
                    topic: function(cred, list, cl) {
                        var cb = this.callback;

                        Step(
                            function() {
                                httputil.getJSON(list.links.self, cred, this);
                            },
                            function(err, doc, response) {
                                cb(err, doc);
                            }
                        );
                    },
                    'it works': function(err, doc) {
                        assert.ifError(err);
                    },
                    'it looks right': function(err, doc) {
                        assert.equal(doc.objectType, 'collection');
                        assert.equal(doc.displayName, 'Beautiful People');
                        assert.include(doc, 'url');
                        assert.include(doc, 'totalItems');
                        assert.equal(doc.totalItems, 0);
                        assert.include(doc, 'items');
                        assert.include(doc, 'links');
                        assert.include(doc.links, 'self');
                    }
                }
            }
        }
    }
});

               suite['export'](module);

               
