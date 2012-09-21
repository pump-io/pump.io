// user-stream-api-test.js
//
// Test user streams API
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
    Step = require("step"),
    _ = require("underscore"),
    querystring = require("querystring"),
    http = require("http"),
    OAuth = require("oauth").OAuth,
    Browser = require("zombie"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken,
    newCredentials = oauthutil.newCredentials;

var ignore = function(err) {};

var suite = vows.describe("User stream API test");

var emptyFeed = function(endpoint) {
    return {
        topic: function(cred) {
            var full = "http://localhost:4815" + endpoint,
                callback = this.callback;

            httputil.getJSON(full, cred, callback);
        },
        "it works": function(err, feed, resp) {
            assert.ifError(err);
        },
        "it looks like a feed": function(err, feed, resp) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "totalItems");
            assert.include(feed, "items");
        },
        "it is empty": function(err, feed, resp) {
            assert.ifError(err);
            assert.isObject(feed);
            assert.include(feed, "totalItems");
            assert.equal(feed.totalItems, 0);
            assert.include(feed, "items");
            assert.isEmpty(feed.items);
        }
    };
};

// A batch for testing the read access to the API

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we get new credentials": {
            topic: function() {
                newCredentials("bigredchicken", "bokbokbok!", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.isString(cred.consumer_key);
                assert.isString(cred.consumer_secret);
                assert.isString(cred.token);
                assert.isString(cred.token_secret);
            },
            "and we check the feed endpoint": 
            httputil.endpoint("/api/user/bigredchicken/feed", ["GET", "POST"]),
            "and we check the minor feed endpoint": 
            httputil.endpoint("/api/user/bigredchicken/feed/minor", ["GET"]),
            "and we check the major feed endpoint": 
            httputil.endpoint("/api/user/bigredchicken/feed/major", ["GET"]),
            "and we check the inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox", ["GET", "POST"]),
            "and we check the minor inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox/minor", ["GET"]),
            "and we check the major inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox/major", ["GET"]),
            "and we check the direct inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox/direct", ["GET"]),
            "and we check the direct minor inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox/direct/minor", ["GET"]),
            "and we check the direct major inbox endpoint": 
            httputil.endpoint("/api/user/bigredchicken/inbox/direct/major", ["GET"]),
            "and we get the feed of a new user": 
            emptyFeed("/api/user/bigredchicken/feed"),
            "and we get the minor feed of a new user": 
            emptyFeed("/api/user/bigredchicken/feed/minor"),
            "and we get the major feed of a new user": 
            emptyFeed("/api/user/bigredchicken/feed/major"),
            "and we get the inbox of a new user": 
            emptyFeed("/api/user/bigredchicken/inbox"),
            "and we get the minor inbox of a new user": 
            emptyFeed("/api/user/bigredchicken/inbox/minor"),
            "and we get the major inbox of a new user": 
            emptyFeed("/api/user/bigredchicken/inbox/major"),
            "and we get the direct inbox of a new user": 
            emptyFeed("/api/user/bigredchicken/inbox/direct"),
            "and we get the direct minor inbox of a new user": 
            emptyFeed("/api/user/bigredchicken/inbox/direct/minor"),
            "and we get the direct major inbox of a new user": 
            emptyFeed("/api/user/bigredchicken/inbox/direct/major")
        },
        "and we get more new credentials": {
            topic: function() {
                newCredentials("dora", "v4m0nos!", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.isString(cred.consumer_key);
                assert.isString(cred.consumer_secret);
                assert.isString(cred.token);
                assert.isString(cred.token_secret);
            },
            "and we post a new activity": {
                topic: function(cred) {
                    var cb = this.callback,
                        act = {
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/dora/feed", cred, act, function(err, feed, result) {
                        cb(err, feed);
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "results look right": function(err, act) {
                    assert.isObject(act);
                    assert.include(act, "id");
                    assert.isString(act.id);
                    assert.include(act, "actor");
                    assert.isObject(act.actor);
                    assert.include(act.actor, "id");
                    assert.isString(act.actor.id);
                    assert.include(act, "verb");
                    assert.isString(act.verb);
                    assert.include(act, "object");
                    assert.isObject(act.object);
                    assert.include(act.object, "id");
                    assert.isString(act.object.id);
                    assert.include(act, "published");
                    assert.isString(act.published);
                    assert.include(act, "updated");
                    assert.isString(act.updated);
                },
                "and we read the feed": {
                    topic: function(act, cred) {
                        var cb = this.callback;

                        httputil.getJSON("http://localhost:4815/api/user/dora/feed", cred, function(err, newf) {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null, {act: act, feed: newf});
                            }
                        });
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has the right members": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "feed");
                        var feed = res.feed;
                        assert.include(feed, "author");
                        assert.include(feed.author, "id");
                        assert.include(feed.author, "displayName");
                        assert.include(feed.author, "objectType");
                        assert.include(feed, "totalItems");
                        assert.include(feed, "items");
                        assert.include(feed, "displayName");
                        assert.include(feed, "id");
                        assert.include(feed, "objectTypes");
                        assert.include(feed.objectTypes, "activity");
                    },
                    "it has one object": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "feed");
                        var feed = res.feed;
                        assert.equal(feed.totalItems, 1);
                        assert.lengthOf(feed.items, 1);
                    },
                    "it has our activity": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "feed");
                        assert.include(res, "act");
                        var feed = res.feed, act = res.act;
                        assert.equal(feed.items[0].id, act.id);
                    }
                },
                "and we read the inbox": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        httputil.getJSON("http://localhost:4815/api/user/dora/inbox", cred, function(err, newb) {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null, {act: act, inbox: newb});
                            }
                        });
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                    },
                    "it has the right members": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "inbox");
                        var inbox = res.inbox;
                        assert.include(inbox, "author");
                        assert.include(inbox.author, "id");
                        assert.include(inbox.author, "displayName");
                        assert.include(inbox.author, "objectType");
                        assert.include(inbox, "totalItems");
                        assert.include(inbox, "items");
                        assert.include(inbox, "displayName");
                        assert.include(inbox, "id");
                        assert.include(inbox, "objectTypes");
                        assert.include(inbox.objectTypes, "activity");
                    },
                    "it has one item": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "inbox");
                        var inbox = res.inbox;
                        assert.equal(inbox.totalItems, 1);
                        assert.lengthOf(inbox.items, 1);
                    },
                    "it has our activity": function(err, res) {
                        assert.isObject(res);
                        assert.include(res, "inbox");
                        assert.include(res, "act");
                        var inbox = res.inbox, act = res.act;
                        assert.equal(inbox.items[0].id, act.id);
                    }
                }
            }
        }
    }
});

// Test some "bad" kinds of activity

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we get new credentials": {
            topic: function(app) {
                newCredentials("diego", "to*the*rescue", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.isString(cred.consumer_key);
                assert.isString(cred.consumer_secret);
                assert.isString(cred.token);
                assert.isString(cred.token_secret);
            },
            "and we try to post an activity with a different actor": {
                topic: function(cred, app) {
                    var cb = this.callback,
                        act = {
                            actor: {
                                id: "urn:uuid:66822a4d-9f72-4168-8d5a-0b1319afeeb1",
                                objectType: "person",
                                displayName: "Not Diego"
                            },
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "To the rescue!"
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/diego/feed", cred, act, function(err, feed, result) {
                        if (err) {
                            cb(null);
                        } else if (result.statusCode < 400 || result.statusCode >= 500) {
                            cb(new Error("Unexpected result"));
                        } else {
                            cb(null);
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we try to post an activity with no object": {
                topic: function(cred, app) {
                    var cb = this.callback,
                        act = {
                            verb: "noop"
                        };
                    httputil.postJSON("http://localhost:4815/api/user/diego/feed", cred, act, function(err, feed, result) {
                        if (err) {
                            cb(null);
                        } else if (result.statusCode < 400 || result.statusCode >= 500) {
                            cb(new Error("Unexpected result"));
                        } else {
                            cb(null);
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we try to post an activity as a different user": {
                topic: function(cred, app) {
                    var cb = this.callback,
                        cl = {client_id: cred.consumer_key,
                              client_secret: cred.consumer_secret},
                        act = {
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "To the rescue!"
                            }
                        };
                    Step(
                        function() {
                            register(cl, "boots", "b4nanazz", this);
                        },
                        function(err, user) {
                            if (err) throw err;
                            accessToken(cl, {nickname: "boots", password: "b4nanazz"}, this);
                        },
                        function(err, pair) {
                            var nuke;
                            if (err) {
                                cb(err);
                            } else {
                                nuke = _(cred).clone();
                                _(nuke).extend(pair);

                                httputil.postJSON("http://localhost:4815/api/user/diego/feed", nuke, act, function(err, feed, result) {
                                    if (err) {
                                        cb(null);
                                    } else if (result.statusCode < 400 || result.statusCode >= 500) {
                                        cb(new Error("Unexpected result"));
                                    } else {
                                        cb(null);
                                    }
                                });
                            }
                        }
                    );
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we try to post an activity with a default verb": {
                topic: function(cred, app) {
                    var cb = this.callback,
                        act = {
                            object: {
                                objectType: "note",
                                content: "Hello, llama!"
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/diego/feed", cred, act, function(err, posted, result) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, posted);
                        }
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "it has the right verb": function(err, act) {
                    assert.equal(act.verb, "post");
                }
            }
        }
    }
});

// Test arguments to the feed

var BASE = "http://localhost:4815/api/user/alicia/feed";
var INBOX = "http://localhost:4815/api/user/alicia/inbox";
var MAJORINBOX = "http://localhost:4815/api/user/alicia/inbox/major";
var MAJOROUTBOX = "http://localhost:4815/api/user/alicia/feed/major";

var justDoc = function(callback) {
    return function(err, doc, resp) {
        callback(err, doc);
    };
};

var docPlus = function(callback, plus) {
    return function(err, doc, resp) {
        callback(err, doc, plus);
    };
};

var getDoc = function(url) {
    return function(cred) {
        httputil.getJSON(url,
                         cred,
                         justDoc(this.callback));
    };
};

var failDoc = function(url) {
    return function(cred) { 
        var cb = this.callback;
        httputil.getJSON(url, cred, function(err, doc, resp) {
            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                cb(null);
            } else if (err) {
                cb(err);
            } else {
                cb(new Error("Unexpected success"));
            }
        });
    };
};

var cmpDoc = function(url) {
    return function(full, cred) {
        httputil.getJSON(url,
                         cred,
                         docPlus(this.callback, full));
    };
};

var cmpBefore = function(base, idx, count) {
    return function(full, cred) {
        var id = full.items[idx].id;
        var url = base + "?before=" + id;
        if (!_(count).isUndefined()) {
            url = url + "&count=" + count;
        }
        httputil.getJSON(url,
                         cred,
                         docPlus(this.callback, full));
    };
};

var cmpSince = function(base, idx, count) {
    return function(full, cred) {
        var id = full.items[idx].id;
        var url = base + "?since=" + id;
        if (!_(count).isUndefined()) {
            url = url + "&count=" + count;
        }
        httputil.getJSON(url,
                         cred,
                         docPlus(this.callback, full));
    };
};

var itWorks = function(err, doc) {
    assert.ifError(err, doc);
};

var itFails = function(err) {
    assert.ifError(err);
};

var validForm = function(count, total) {
    return function(err, doc) {
        assert.include(doc, "author");
        assert.include(doc.author, "id");
        assert.include(doc.author, "displayName");
        assert.include(doc.author, "objectType");
        assert.include(doc, "totalItems");
        assert.include(doc, "items");
        assert.include(doc, "displayName");
        assert.include(doc, "id");
        assert.include(doc, "url");
        if (_(count).isNumber()) {
            assert.lengthOf(doc.items, count);
        }
        if (_(total).isNumber()) {
            assert.equal(doc.totalItems, total);
        }
        assert.include(doc, "links");
        assert.isObject(doc.links);
        assert.include(doc.links, "self");
        assert.isString(doc.links.self);
        assert.include(doc.links, "first");
        assert.isString(doc.links.first);
        if (_(count).isNumber() && count !== 0) {
            assert.include(doc.links, "prev");
        }
    };
};

var validData = function(start, end) {
    return function(err, doc, full) {
        assert.deepEqual(doc.items, full.items.slice(start, end));
    };
};

// Workout a feed endpoint

var workout = function(endpoint) {
    return {
        "and we get the default feed": {
            topic: getDoc(endpoint),
            "it works": itWorks,
            "it looks right": validForm(20, 100)
        },
        "and we get the full feed": {
            topic: getDoc(endpoint + "?count=100"),
            "it works": itWorks,
            "it looks right": validForm(100, 100),
            "and we get the feed with a non-zero offset": {
                topic: cmpDoc(endpoint + "?offset=50"),
                "it works": itWorks,
                "it looks right": validForm(20, 100),
                "it has the right data": validData(50, 70)
            },
            "and we get the feed with a zero offset": {
                topic: cmpDoc(endpoint + "?offset=0"),
                "it works": itWorks,
                "it looks right": validForm(20, 100),
                "it has the right data": validData(0, 20)
            },
            "and we get the feed with a non-zero offset and count": {
                topic: cmpDoc(endpoint + "?offset=20&count=20"),
                "it works": itWorks,
                "it looks right": validForm(20, 100),
                "it has the right data": validData(20, 40)
            },
            "and we get the feed with a zero offset and count": {
                topic: cmpDoc(endpoint + "?offset=0"),
                "it works": itWorks,
                "it looks right": validForm(20, 100),
                "it has the right data": validData(0, 20)
            },
            "and we get the feed with a non-zero count": {
                topic: cmpDoc(endpoint + "?count=50"),
                "it works": itWorks,
                "it looks right": validForm(50, 100),
                "it has the right data": validData(0, 50)
            },
            "and we get the feed since a value": {
                topic: cmpSince(endpoint, 25),
                "it works": itWorks,
                "it looks right": validForm(20, 100),
                "it has the right data": validData(5, 25)
            },
            "and we get the feed before a value": {
                topic: cmpBefore(endpoint, 25),
                "it works": itWorks,
                "it looks right": validForm(20, 100),
                "it has the right data": validData(26, 46)
            },
            "and we get the feed since a small value": {
                topic: cmpSince(endpoint, 5),
                "it works": itWorks,
                "it looks right": validForm(5, 100),
                "it has the right data": validData(0, 5)
            },
            "and we get the feed before a big value": {
                topic: cmpBefore(endpoint, 94),
                "it works": itWorks,
                "it looks right": validForm(5, 100),
                "it has the right data": validData(95, 100)
            },
            "and we get the feed since a value with a count": {
                topic: cmpSince(endpoint, 75, 50),
                "it works": itWorks,
                "it looks right": validForm(50, 100),
                "it has the right data": validData(25, 75)
            },
            "and we get the feed before a value with a count": {
                topic: cmpBefore(endpoint, 35, 50),
                "it works": itWorks,
                "it looks right": validForm(50, 100),
                "it has the right data": validData(36, 86)
            },
            "and we get the feed since a value with a zero count": {
                topic: cmpSince(endpoint, 30, 0),
                "it works": itWorks,
                "it looks right": validForm(0, 100)
            },
            "and we get the feed before a value with a zero count": {
                topic: cmpBefore(endpoint, 60, 0),
                "it works": itWorks,
                "it looks right": validForm(0, 100)
            },
            "and we get the full feed by following 'next' links": {
                topic: function(full, cred) {
                    var cb = this.callback,
                        items = [],
                        addResultsOf = function(url) {
                            httputil.getJSON(url, cred, function(err, doc, resp) {
                                if (err) {
                                    cb(err, null, null);
                                } else {
                                    if (doc.items.length > 0) {
                                        items = items.concat(doc.items);
                                        if (doc.links.next) {
                                            addResultsOf(doc.links.next);
                                        } else {
                                            cb(null, items, full);
                                        }
                                    } else {
                                        cb(null, items, full);
                                    }
                                }
                            });
                        };
                    addResultsOf(endpoint);
                },
                "it works": itWorks,
                "it looks correct": function(err, items, full) {
                    assert.isArray(items);
                    assert.lengthOf(items, full.items.length);
                    assert.deepEqual(items, full.items);
                }
            }
        },
        "and we get the feed with a negative count": {
            topic: failDoc(endpoint + "?count=-30"),
            "it fails correctly": itFails
        },
        "and we get the feed with a negative offset": {
            topic: failDoc(endpoint + "?offset=-50"),
            "it fails correctly": itFails
        },
        "and we get the feed with a zero offset and zero count": {
            topic: getDoc(endpoint + "?offset=0&count=0"),
            "it works": itWorks,
            "it looks right": validForm(0, 100)
        },
        "and we get the feed with a non-zero offset and zero count": {
            topic: getDoc(endpoint + "?offset=30&count=0"),
            "it works": itWorks,
            "it looks right": validForm(0, 100)
        },
        "and we get the feed with a non-integer count": {
            topic: failDoc(endpoint + "?count=foo"),
            "it fails correctly": itFails
        },
        "and we get the feed with a non-integer offset": {
            topic: failDoc(endpoint + "?offset=bar"),
            "it fails correctly": itFails
        },
        "and we get the feed with a too-large offset": {
            topic: getDoc(endpoint + "?offset=200"),
            "it works": itWorks,
            "it looks right": validForm(0, 100)
        },
        "and we get the feed with a too-large count": {
            topic: getDoc(endpoint + "?count=150"),
            "it works": itWorks,
            "it looks right": validForm(100, 100)
        },
        "and we get the feed with a disallowed count": {
            topic: failDoc(endpoint + "?count=1000"),
            "it fails correctly": itFails
        },
        "and we get the feed before a nonexistent id": {
            topic: failDoc(endpoint + "?before="+encodeURIComponent("http://example.net/nonexistent")),
            "it fails correctly": itFails
        },
        "and we get the feed since a nonexistent id": {
            topic: failDoc(endpoint + "?since="+encodeURIComponent("http://example.net/nonexistent")),
            "it fails correctly": itFails
        }
    };
};

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
        "and we get new credentials": {
            topic: function(app) {
                newCredentials("alicia", "base*station", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.isString(cred.consumer_key);
                assert.isString(cred.consumer_secret);
                assert.isString(cred.token);
                assert.isString(cred.token_secret);
            },
            "and we post a bunch of major activities": {
                topic: function(cred) {
                    var cb = this.callback;

                    Step(
                        function() {
                            var group = this.group(),
                                i,
                                act = {
                                    verb: "post",
                                    object: {
                                        objectType: "note",
                                        content: "Hello, World!"
                                    }
                                },
                                newAct,
                                url = BASE;

                            for (i = 0; i < 100; i++) {
                                newAct = JSON.parse(JSON.stringify(act));
                                newAct.object.content = "Hello, World #" + i + "!";
                                httputil.postJSON(url, cred, newAct, group());
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
                "and we workout the outbox":
                workout(BASE),
                "and we workout the inbox":
                workout(INBOX),
                "and we workout the major inbox":
                workout(MAJORINBOX),
                "and we workout the major inbox":
                workout(MAJOROUTBOX),
                "and we check the minor inbox":
                emptyFeed("/api/user/alicia/inbox/minor"),
                "and we check the direct inbox":
                emptyFeed("/api/user/alicia/inbox/direct"),
                "and we check the direct minor inbox":
                emptyFeed("/api/user/alicia/inbox/direct/minor"),
                "and we check the direct major inbox":
                emptyFeed("/api/user/alicia/inbox/direct/major")
            }
        },
        "and we get new credentials": {
            topic: function(app) {
                newCredentials("benny", "my/guys!", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
                assert.isString(cred.consumer_key);
                assert.isString(cred.consumer_secret);
                assert.isString(cred.token);
                assert.isString(cred.token_secret);
            },
            "and we post a bunch of minor activities": {
                topic: function(cred) {
                    var cb = this.callback;

                    Step(
                        function() {
                            var group = this.group(),
                                i,
                                act = {
                                    verb: "post",
                                    to: [{
                                        id: "http://activityschema.org/collection/public",
                                        objectType: "collection"
                                    }],
                                    object: {
                                        objectType: "comment",
                                        inReplyTo: {
                                            id: "urn:uuid:79ce4946-0427-11e2-aa67-70f1a154e1aa",
                                            objectType: "image"
                                        }
                                    }
                                },
                                newAct,
                                url = "http://localhost:4815/api/user/benny/feed";

                            for (i = 0; i < 100; i++) {
                                newAct = JSON.parse(JSON.stringify(act));
                                newAct.object.content = "I love it! " + i,
                                httputil.postJSON(url, cred, newAct, group());
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
                "and we work out the minor inbox":
                workout("http://localhost:4815/api/user/benny/inbox/minor"),
                "and we work out the minor outbox":
                workout("http://localhost:4815/api/user/benny/feed/minor"),
                "and we check the major inbox":
                emptyFeed("/api/user/benny/inbox/major"),
                "and we check the direct inbox":
                emptyFeed("/api/user/benny/inbox/direct"),
                "and we check the direct minor inbox":
                emptyFeed("/api/user/benny/inbox/direct/minor"),
                "and we check the direct major inbox":
                emptyFeed("/api/user/benny/inbox/direct/major")
            }
        },
        "and we post a lot of stuff from one user to another": {
            topic: function(app) {
                Step(
                    function() {
                        newCredentials("isa", "really_smart", this.parallel());
                        newCredentials("tico", "drives-a-car", this.parallel());
                    },
                    this.callback
                );
            },
            "it works": function(err, cred1, cred2) {
                assert.ifError(err);
                assert.isObject(cred1);
                assert.isObject(cred2);
            },
            "and we post a bunch of major activities": {
                topic: function(cred1, cred2) {
                    var cb = this.callback;

                    Step(
                        function() {
                            var group = this.group(),
                                i,
                                act = {
                                    verb: "post",
                                    to: [cred1.user.profile],
                                    object: {
                                        objectType: "note"
                                    }
                                },
                                newAct,
                                url = "http://localhost:4815/api/user/tico/feed";

                            for (i = 0; i < 100; i++) {
                                newAct = JSON.parse(JSON.stringify(act));
                                newAct.object.content = "Hi there! " + i,
                                httputil.postJSON(url, cred2, newAct, group());
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
                "and we work out the direct inbox":
                workout("http://localhost:4815/api/user/isa/inbox/direct"),
                "and we work out the major direct inbox":
                workout("http://localhost:4815/api/user/isa/inbox/direct/major"),
                "and we check the minor direct inbox":
                emptyFeed("/api/user/isa/inbox/direct/minor")
            }
        }
    }
});

suite["export"](module);