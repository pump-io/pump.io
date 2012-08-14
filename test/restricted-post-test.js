// default-recipient-test.js
//
// Test setting default recipients for an activity
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
    OAuth = require("oauth").OAuth,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken,
    newCredentials = oauthutil.newCredentials,
    newPair = oauthutil.newPair,
    newClient = oauthutil.newClient;

var ignore = function(err) {};

var suite = vows.describe("Post note API test");

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var clientCred = function(cl) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret
    };
};

// A batch for testing the visibility of bcc and bto addressing

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
        "and we register a client": {
            topic: function() {
                newClient(this.callback);
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and a user posts a note to another user": {
                topic: function(cl) {
                    var cb = this.callback,
                        users = {
                            mrmoose: {
                                password: "pingpongballs"
                            },
                            mrbunnyrabbit: {
                                password: "carrots"
                            },
                            dancingbear: {
                                password: "dancing"
                            }
                               
                        };
                    Step(
                        function() {
                            register(cl, "mrmoose", users.mrmoose.password, this.parallel());
                            register(cl, "mrbunnyrabbit", users.mrbunnyrabbit.password, this.parallel());
                            register(cl, "dancingbear", users.dancingbear.password, this.parallel());
                        },
                        function(err, user1, user2, user3) {
                            if (err) throw err;
                            users.mrmoose.profile = user1.profile;
                            users.mrbunnyrabbit.profile   = user2.profile;
                            users.dancingbear.profile = user3.profile;
                            accessToken(cl, 
                                        {nickname: "mrmoose", password: users.mrmoose.password}, 
                                        this.parallel());
                            accessToken(cl, 
                                        {nickname: "mrbunnyrabbit", password: users.mrbunnyrabbit.password}, 
                                        this.parallel());
                            accessToken(cl, 
                                        {nickname: "dancingbear", password: users.dancingbear.password}, 
                                        this.parallel());
                        },
                        function(err, pair1, pair2, pair3) {
                            var url, cred, act;
                            if (err) throw err;
                            users.mrmoose.pair = pair1;
                            users.mrbunnyrabbit.pair = pair2;
                            users.dancingbear.pair = pair3;
                            cred = makeCred(cl, pair3);
                            act = {
                                verb: "follow",
                                object: {
                                    objectType: "person",
                                    id: users.mrmoose.profile.id
                                }
                            };
                            url = "http://localhost:4815/api/user/dancingbear/feed";
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, resp) {
                            var url, cred, act;
                            if (err) throw err;
                            cred = makeCred(cl, users.mrmoose.pair);
                            act = {
                                verb: "post",
                                to: [{
                                    id: users.mrbunnyrabbit.profile.id,
                                    objectType: "person"
                                }],
                                object: {
                                    objectType: "note",
                                    content: "Knock knock!"
                                }
                            };
                            url = "http://localhost:4815/api/user/mrmoose/feed";
                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, doc, response) {
                            if (err) {
                                cb(err, null, null);
                            } else {
                                cb(null, doc, users);
                            }
                        }
                    );
                },
                "it works": function(err, doc, users) {
                    assert.ifError(err);
                },
                "and the author reads the activity": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.mrmoose.pair),
                            cb = this.callback,
                            url = doc.links.self.href;

                        httputil.getJSON(url, cred, function(err, act, response) {
                            cb(err, doc, act);
                        });
                    },
                    "it works": function(err, orig, copy) {
                        assert.ifError(err);
                        assert.isObject(copy);
                        assert.equal(orig.id, copy.id);
                    }
                },
                "and the author reads the note": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.mrmoose.pair),
                            cb = this.callback,
                            url = doc.object.id;

                        httputil.getJSON(url, cred, function(err, note, response) {
                            cb(err, doc.object, note);
                        });
                    },
                    "it works": function(err, orig, copy) {
                        assert.ifError(err);
                        assert.isObject(copy);
                        assert.equal(orig.id, copy.id);
                    }
                },
                "and the author reads their own feed": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.mrmoose.pair),
                            cb = this.callback,
                            url = "http://localhost:4815/api/user/mrmoose/feed";

                        httputil.getJSON(url, cred, function(err, feed, response) {
                            cb(err, doc, feed);
                        });
                    },
                    "it works": function(err, act, feed) {
                        assert.ifError(err);
                    },
                    "it includes the private post-note activity": function(err, act, feed) {
                        assert.ifError(err);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.lengthOf(feed.items, 1);
                        assert.equal(feed.items[0].id, act.id);
                    }
                },
                "and the author reads their own inbox": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.mrmoose.pair),
                            cb = this.callback,
                            url = "http://localhost:4815/api/user/mrmoose/inbox";

                        httputil.getJSON(url, cred, function(err, inbox, response) {
                            cb(err, doc, inbox);
                        });
                    },
                    "it works": function(err, act, inbox) {
                        assert.ifError(err);
                    },
                    "it includes the private post-note activity": function(err, act, inbox) {
                        assert.ifError(err);
                        assert.include(inbox, "items");
                        assert.isArray(inbox.items);
                        assert.lengthOf(inbox.items, 1);
                        assert.equal(inbox.items[0].id, act.id);
                    }
                },
                "and the recipient reads the activity": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.mrbunnyrabbit.pair),
                            cb = this.callback,
                            url = doc.links.self.href;

                        httputil.getJSON(url, cred, function(err, act, response) {
                            cb(err, doc, act);
                        });
                    },
                    "it works": function(err, orig, copy) {
                        assert.ifError(err);
                        assert.isObject(copy);
                        assert.equal(orig.id, copy.id);
                    }
                },
                "and the recipient reads the note": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.mrbunnyrabbit.pair),
                            cb = this.callback,
                            url = doc.object.id;

                        httputil.getJSON(url, cred, function(err, note, response) {
                            cb(err, doc.object, note);
                        });
                    },
                    "it works": function(err, orig, copy) {
                        assert.ifError(err);
                        assert.isObject(copy);
                        assert.equal(orig.id, copy.id);
                    }
                },
                "and the recipient reads the author's feed": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.mrbunnyrabbit.pair),
                            cb = this.callback,
                            url = "http://localhost:4815/api/user/mrmoose/feed";

                        httputil.getJSON(url, cred, function(err, feed, response) {
                            cb(err, doc, feed);
                        });
                    },
                    "it works": function(err, act, feed) {
                        assert.ifError(err);
                    },
                    "it includes the private post-note activity": function(err, act, feed) {
                        assert.ifError(err);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.lengthOf(feed.items, 1);
                        assert.equal(feed.items[0].id, act.id);
                    }
                },
                "and the recipient reads their own inbox": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.mrbunnyrabbit.pair),
                            cb = this.callback,
                            url = "http://localhost:4815/api/user/mrbunnyrabbit/inbox";

                        httputil.getJSON(url, cred, function(err, inbox, response) {
                            cb(err, doc, inbox);
                        });
                    },
                    "it works": function(err, act, inbox) {
                        assert.ifError(err);
                    },
                    "it includes the private post-note activity": function(err, act, inbox) {
                        assert.ifError(err);
                        assert.include(inbox, "items");
                        assert.isArray(inbox.items);
                        assert.lengthOf(inbox.items, 1);
                        assert.equal(inbox.items[0].id, act.id);
                    }
                },
                "and a follower reads the activity": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.dancingbear.pair),
                            cb = this.callback,
                            url = doc.links.self.href;

                        httputil.getJSON(url, cred, function(err, act, response) {
                            if (err && err.statusCode && err.statusCode == 403) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    "it fails with a 403 Forbidden": function(err) {
                        assert.ifError(err);
                    }
                },
                "and a follower reads the note": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.dancingbear.pair),
                            cb = this.callback,
                            url = doc.object.id;

                        httputil.getJSON(url, cred, function(err, note, response) {
                            if (err && err.statusCode && err.statusCode == 403) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    "it fails with a 403 Forbidden": function(err) {
                        assert.ifError(err);
                    }
                },
                "and a follower reads the author's feed": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.dancingbear.pair),
                            cb = this.callback,
                            url = "http://localhost:4815/api/user/mrmoose/feed";

                        httputil.getJSON(url, cred, function(err, feed, response) {
                            cb(err, doc, feed);
                        });
                    },
                    "it works": function(err, act, feed) {
                        assert.ifError(err);
                    },
                    "it does not include the private post-note activity": function(err, act, feed) {
                        assert.ifError(err);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.lengthOf(feed.items, 0);
                    }
                },
                "and a follower reads their own inbox": {
                    topic: function(doc, users, cl) {
                        var cred = makeCred(cl, users.dancingbear.pair),
                            cb = this.callback,
                            url = "http://localhost:4815/api/user/dancingbear/inbox";

                        httputil.getJSON(url, cred, function(err, inbox, response) {
                            cb(err, doc, inbox);
                        });
                    },
                    "it works": function(err, act, inbox) {
                        assert.ifError(err);
                    },
                    "it doesn't include the private post-note activity": function(err, act, inbox) {
                        assert.ifError(err);
                        assert.include(inbox, "items");
                        assert.isArray(inbox.items);
                        // should be the follow activity
                        assert.lengthOf(inbox.items, 1);
                        assert.notEqual(inbox.items[0].id, act.id);
                    }
                },
                "and an anonymous user reads the activity": {
                    topic: function(doc, users, cl) {
                        var cred = clientCred(cl),
                            cb = this.callback,
                            url = doc.links.self.href;

                        httputil.getJSON(url, cred, function(err, act, response) {
                            if (err && err.statusCode && err.statusCode == 403) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    "it fails with a 403 Forbidden": function(err) {
                        assert.ifError(err);
                    }
                },
                "and an anonymous user reads the note": {
                    topic: function(doc, users, cl) {
                        var cred = clientCred(cl),
                            cb = this.callback,
                            url = doc.object.id;

                        httputil.getJSON(url, cred, function(err, note, response) {
                            if (err && err.statusCode && err.statusCode == 403) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    "it fails with a 403 Forbidden": function(err) {
                        assert.ifError(err);
                    }
                },
                "and an anonymous user reads the author's feed": {
                    topic: function(doc, users, cl) {
                        var cred = clientCred(cl),
                            cb = this.callback,
                            url = "http://localhost:4815/api/user/mrmoose/feed";

                        httputil.getJSON(url, cred, function(err, feed, response) {
                            cb(err, doc, feed);
                        });
                    },
                    "it works": function(err, act, feed) {
                        assert.ifError(err);
                    },
                    "it does not include the private post-note activity": function(err, act, feed) {
                        assert.ifError(err);
                        assert.include(feed, "items");
                        assert.isArray(feed.items);
                        assert.lengthOf(feed.items, 0);
                    }
                }
            }
        }
    }
});

suite["export"](module);
