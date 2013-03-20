// distributor-remote-test-as-root.js
//
// Test distribution to remote servers
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
    Step = require("step"),
    http = require("http"),
    querystring = require("querystring"),
    _ = require("underscore"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    dialbackApp = require("./lib/dialback").dialbackApp,
    setupApp = oauthutil.setupApp;

var suite = vows.describe("distributor remote test");

var serverOf = function(url) {
    var parts = urlparse(url);
    return parts.hostname;
};

suite.addBatch({
    "When we set up two apps": {
        topic: function() {
            var social, photo, callback = this.callback;
            Step(
                function() {
                    setupApp(80, "social.localhost", this.parallel());
                    setupApp(80, "photo.localhost", this.parallel());
                },
                function(err, social, photo) {
                    if (err) {
                        callback(err, null, null);
                    } else {
                        callback(null, social, photo);
                    }
                }
            );
        },
        "it works": function(err, social, photo) {
            assert.ifError(err);
        },
        teardown: function(social, photo) {
            if (social && social.close) {
                social.close();
            }
            if (photo && photo.close) {
                photo.close();
            }
        },
        "and we register one user on each": {
            topic: function() {
                var callback = this.callback;
                Step(
                    function() {
                        newCredentials("maven", "t4steful", "social.localhost", 80, this.parallel());
                        newCredentials("photog", "gritty*1", "photo.localhost", 80, this.parallel());
                    },
                    callback
                );
            },
            "it works": function(err, cred1, cred2) {
                assert.ifError(err);
                assert.isObject(cred1);
                assert.isObject(cred2);
            },
            "and one user follows the other": {
                topic: function(cred1, cred2) {
                    var url = "http://social.localhost/api/user/maven/feed",
                        act = {
                            verb: "follow",
                            object: {
                                id: "acct:photog@photo.localhost",
                                objectType: "person"
                            }
                        },
                        callback = this.callback;
                    
                    pj(url, cred1, act, function(err, body, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, body);
                        }
                    });
                },
                "it works": function(err, body) {
                    assert.ifError(err);
                    assert.isObject(body);
                },
                "and we wait a few seconds for delivery": {
                    topic: function() {
                        var callback = this.callback;
                        setTimeout(function() { callback(null); }, 5000);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we check the first user's following list": {
                        topic: function(act, cred1, cred2) {
                            var url = "http://social.localhost/api/user/maven/following",
                                callback = this.callback;
                            
                            gj(url, cred1, function(err, body, resp) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    callback(null, body);
                                }
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assert.isObject(feed);
                        },
                        "it includes the second user": function(err, feed) {
                            assert.ifError(err);
                            assert.isObject(feed);
                            assert.include(feed, "items");
                            assert.isArray(feed.items);
                            assert.greater(feed.items.length, 0);
			    assert.isObject(_.find(feed.items, function(item) { return item.id == "acct:photog@photo.localhost" }));
                        }
                    },
                    "and we check the second user's followers list": {
                        topic: function(act, cred1, cred2) {
                            var url = "http://photo.localhost/api/user/photog/followers",
                                callback = this.callback;

                            gj(url, cred2, function(err, body, resp) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    callback(null, body);
                                }
                            });
                        },
                        "it works": function(err, feed) {
                            var maven;
                            assert.ifError(err);
                            assert.isObject(feed);
                            assert.include(feed, "items");
                            assert.isArray(feed.items);
                            assert.greater(feed.items.length, 0);
                            assert.isObject(feed.items[0]);
                            maven = feed.items[0];
                            assert.include(maven, "id");
                            assert.equal(maven.id, "acct:maven@social.localhost");

                            assert.include(maven, "followers");
                            assert.isObject(maven.followers);
                            assert.include(maven.followers, "url");
                            assert.equal(serverOf(maven.followers.url), "social.localhost");

                            assert.include(maven, "following");
                            assert.isObject(maven.following);
                            assert.include(maven.following, "url");
                            assert.equal(serverOf(maven.following.url), "social.localhost");

                            assert.include(maven, "favorites");
                            assert.isObject(maven.favorites);
                            assert.include(maven.favorites, "url");
                            assert.equal(serverOf(maven.favorites.url), "social.localhost");

                            assert.include(maven, "lists");
                            assert.isObject(maven.lists);
                            assert.include(maven.lists, "url");
                            assert.equal(serverOf(maven.lists.url), "social.localhost");

                            assert.include(maven, "links");
                            assert.isObject(maven.links);

                            assert.include(maven.links, "self");
                            assert.isObject(maven.links.self);
                            assert.include(maven.links.self, "href");
                            assert.equal(serverOf(maven.links.self.href), "social.localhost");

                            assert.include(maven.links, "activity-inbox");
                            assert.isObject(maven.links["activity-inbox"]);
                            assert.include(maven.links["activity-inbox"], "href");
                            assert.equal(serverOf(maven.links["activity-inbox"].href), "social.localhost");

                            assert.include(maven.links, "self");
                            assert.isObject(maven.links["activity-outbox"]);
                            assert.include(maven.links["activity-outbox"], "href");
                            assert.equal(serverOf(maven.links["activity-outbox"].href), "social.localhost");
                        }
                    },
                    "and we check the second user's inbox": {
                        topic: function(act, cred1, cred2) {
                            var url = "http://photo.localhost/api/user/photog/inbox",
                                callback = this.callback;
                            
                            gj(url, cred2, function(err, feed, resp) {
                                if (err) {
                                    callback(err, null, null);
                                } else {
                                    callback(null, feed, act);
                                }
                            });
                        },
                        "it works": function(err, feed, act) {
                            assert.ifError(err);
                            assert.isObject(feed);
                            assert.isObject(act);
                        },
                        "it includes the activity": function(err, feed, act) {
                            assert.ifError(err);
                            assert.isObject(feed);
                            assert.isObject(act);
                            assert.include(feed, "items");
                            assert.isArray(feed.items);
                            assert.greater(feed.items.length, 0);
                            assert.isObject(_.find(feed.items, function(item) { return item.id == act.id; }));
                        }
                    },
                    "and the second user posts an image": {
                        topic: function(act, cred1, cred2) {
                            var url = "http://photo.localhost/api/user/photog/feed",
                                callback = this.callback,
                                post = {
                                    verb: "post",
                                    object: {
                                        objectType: "image",
                                        displayName: "My Photo"
                                    }
                                };
                            
                            pj(url, cred2, post, function(err, act, resp) {
                                if (err) {
                                    callback(err, null);
                                } else {
                                    callback(null, act);
                                }
                            });
                        },
                        "it works": function(err, act) {
                            assert.ifError(err);
                            assert.isObject(act);
                        },
                        "and we wait a few seconds for delivery": {
                            topic: function() {
                                var callback = this.callback;
                                setTimeout(function() { callback(null); }, 5000);
                            },
                            "it works": function(err) {
                                assert.ifError(err);
                            },
                            "and we check the first user's inbox": {
                                topic: function(posted, followed, cred1, cred2) {
                                    var callback = this.callback,
                                        url = "http://social.localhost/api/user/maven/inbox";
                                    gj(url, cred1, function(err, feed, resp) {
                                        if (err) {
                                            callback(err, null, null);
                                        } else {
                                            callback(null, feed, posted);
                                        }
                                    });
                                },
                                "it works": function(err, feed, act) {
                                    assert.ifError(err);
                                    assert.isObject(feed);
                                    assert.isObject(act);
                                },
                                "it includes the activity": function(err, feed, act) {
                                    assert.ifError(err);
                                    assert.isObject(feed);
                                    assert.isObject(act);
                                    assert.include(feed, "items");
                                    assert.isArray(feed.items);
                                    assert.greater(feed.items.length, 0);
				    assert.isObject(_.find(feed.items, function(item) { return item.id == act.id; }));
                                },
                                "activity is sanitized": function(err, feed, act) {
				    var item;
                                    assert.ifError(err);
                                    assert.isObject(feed);
                                    assert.isArray(feed.items);
                                    assert.greater(feed.items.length, 0);
				    item = _.find(feed.items, function(item) { return item.id == act.id; });
				    assert.isObject(item);
				    assert.isObject(item.actor);
                                    assert.isFalse(_(item.actor).has("_user"));
                                },
                                "activity likes and replies feeds have right host": function(err, feed, act) {
				    var item;
                                    assert.ifError(err);
                                    assert.isObject(feed);
                                    assert.isArray(feed.items);
                                    assert.greater(feed.items.length, 0);
				    item = _.find(feed.items, function(item) { return item.id == act.id; });
                                    assert.isObject(item);
                                    assert.isObject(item.object);
                                    assert.isObject(item.object.likes);
                                    assert.isString(item.object.likes.url);
                                    assert.equal(serverOf(item.object.likes.url), "photo.localhost");
                                    assert.isObject(item.object.replies);
                                    assert.isString(item.object.replies.url);
                                    assert.equal(serverOf(item.object.replies.url), "photo.localhost");
                                }
                            },
                            "and the first user responds": {
                                topic: function(posted, followed, cred1, cred2) {
                                    var callback = this.callback,
                                        url = "http://social.localhost/api/user/maven/feed",
                                        postComment = {
                                            verb: "post",
                                            object: {
                                                objectType: "comment",
                                                inReplyTo: posted.object,
                                                content: "Nice one!"
                                            }
                                        };

                                    pj(url, cred1, postComment, function(err, pc, resp) {
                                        if (err) {
                                            callback(err, null);
                                        } else {
                                            callback(null, pc);
                                        }
                                    });
                                },
                                "it works": function(err, pc) {
                                    assert.ifError(err);
                                    assert.isObject(pc);
                                },
                                "and we wait a few seconds for delivery": {
                                    topic: function() {
                                        var callback = this.callback;
                                        setTimeout(function() { callback(null); }, 5000);
                                    },
                                    "it works": function(err) {
                                        assert.ifError(err);
                                    },
                                    "and we check the second user's inbox": {
                                        topic: function(pc, pi, fu, cred1, cred2) {
                                            var url = "http://photo.localhost/api/user/photog/inbox",
                                                callback = this.callback;
                                            
                                            gj(url, cred2, function(err, feed, resp) {
                                                if (err) {
                                                    callback(err, null, null);
                                                } else {
                                                    callback(null, feed, pc);
                                                }
                                            });
                                        },
                                        "it works": function(err, feed, act) {
                                            assert.ifError(err);
                                            assert.isObject(feed);
                                            assert.isObject(act);
                                        },
                                        "it includes the activity": function(err, feed, act) {
					    var item;
                                            assert.ifError(err);
                                            assert.isObject(feed);
                                            assert.isObject(act);
                                            assert.include(feed, "items");
                                            assert.isArray(feed.items);
                                            assert.greater(feed.items.length, 0);
					    item = _.find(feed.items, function(item) { return item.id == act.id; });
                                            assert.isObject(item);
                                        }
                                    },
                                    "and we check the image's replies": {
                                        topic: function(pc, pi, fu, cred1, cred2) {
                                            var url = pi.object.replies.url,
                                                callback = this.callback;
                                            
                                            gj(url, cred2, function(err, feed, resp) {
                                                if (err) {
                                                    callback(err, null, null);
                                                } else {
                                                    callback(null, feed, pc);
                                                }
                                            });
                                        },
                                        "it works": function(err, feed, pc) {
                                            assert.ifError(err);
                                            assert.isObject(feed);
                                        },
                                        "feed includes the comment": function(err, feed, pc) {
					    var item;
                                            assert.ifError(err);
                                            assert.isObject(feed);
                                            assert.isObject(pc);
                                            assert.include(feed, "items");
                                            assert.isArray(feed.items);
                                            assert.greater(feed.items.length, 0);
					    item = _.find(feed.items, function(item) { return item.id == pc.object.id; });
					    assert.isObject(item);
                                        }
                                    },
                                    "and the second user likes the comment": {
                                        topic: function(pc, pi, fu, cred1, cred2) {
                                            var url = "http://photo.localhost/api/user/photog/feed",
                                                callback = this.callback,
                                                post = {
                                                    verb: "favorite",
                                                    object: pc.object
                                                };
                                            
                                            pj(url, cred2, post, function(err, act, resp) {
                                                if (err) {
                                                    callback(err, null);
                                                } else {
                                                    callback(null, act);
                                                }
                                            });
                                        },
                                        "it works": function(err, act) {
                                            assert.ifError(err);
                                            assert.isObject(act);
                                        },
                                        "and we wait a few seconds for delivery": {
                                            topic: function() {
                                                var callback = this.callback;
                                                setTimeout(function() { callback(null); }, 5000);
                                            },
                                            "it works": function(err) {
                                                assert.ifError(err);
                                            },
                                            "and we check the first user's inbox": {
                                                topic: function(fc, pc, pi, fu, cred1, cred2) {
                                                    var callback = this.callback,
                                                        url = "http://social.localhost/api/user/maven/inbox";
                                                    gj(url, cred1, function(err, feed, resp) {
                                                        if (err) {
                                                            callback(err, null, null);
                                                        } else {
                                                            callback(null, feed, fc);
                                                        }
                                                    });
                                                },
                                                "it works": function(err, feed, act) {
                                                    assert.ifError(err);
                                                    assert.isObject(feed);
                                                    assert.isObject(act);
                                                },
                                                "it includes the activity": function(err, feed, act) {
                                                    assert.ifError(err);
                                                    assert.isObject(feed);
                                                    assert.isObject(act);
                                                    assert.include(feed, "items");
                                                    assert.isArray(feed.items);
                                                    assert.greater(feed.items.length, 0);
						    item = _.find(feed.items, function(item) { return item.id == act.id; });
						    assert.isObject(item);
                                                }
                                            },
                                            "and we check the comment's likes feed": {
                                                topic: function(fc, pc, pi, fu, cred1, cred2) {
                                                    var url = pc.object.likes.url,
                                                        callback = this.callback;
                                                    
                                                    gj(url, cred1, function(err, feed, resp) {
                                                        if (err) {
                                                            callback(err, null, null);
                                                        } else {
                                                            callback(null, feed, fc);
                                                        }
                                                    });
                                                },
                                                "it works": function(err, feed, fc) {
                                                    assert.ifError(err);
                                                    assert.isObject(feed);
                                                },
                                                "feed includes the second user": function(err, feed, fc) {
						    var item;
                                                    assert.ifError(err);
                                                    assert.isObject(feed);
                                                    assert.isObject(fc);
                                                    assert.include(feed, "items");
                                                    assert.isArray(feed.items);
                                                    assert.greater(feed.items.length, 0);
						    item = _.find(feed.items, function(item) { return item.id == fc.actor.id; });
						    assert.isObject(item);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
