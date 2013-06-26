// group-api-test.js
//
// Test group API
//
// Copyright 2013, E14N https://e14n.com/
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
    http = require("http"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    pj = httputil.postJSON,
    gj = httputil.getJSON,
    validActivity = actutil.validActivity,
    validActivityObject = actutil.validActivityObject,
    validFeed = actutil.validFeed,
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    newPair = oauthutil.newPair;

var suite = vows.describe("Group API test");

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret,
	user: pair.user
    };
};

// A batch for manipulating groups API

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
        "and we make a new user": {
            topic: function() {
                newCredentials("fafhrd", "lankhmar+1", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "and they create a group": {
                topic: function(cred) {
                    var callback = this.callback,
                        url = "http://localhost:4815/api/user/fafhrd/feed",
                        act = {
                            verb: "create",
                            object: {
                                objectType: "group",
                                displayName: "Barbarians",
                                summary: "A safe place for barbarians to share their feelings"
                            }
                        };

                    pj(url, cred, act, function(err, data, resp) {
                        callback(err, data);
                    });
                },
                "it works": function(err, data) {
                    assert.ifError(err);
                    validActivity(data);
                },
                "and we retrieve that group with the REST API": {
                    topic: function(act, cred) {
                        var callback = this.callback,
                            url = act.object.links.self.href;

                        gj(url, cred, function(err, data, resp) {
                            callback(err, data);
                        });
                    },
                    "it works": function(err, group) {
                        assert.ifError(err);
                        assert.isObject(group);
                    },
                    "it looks right": function(err, group) {
                        assert.ifError(err);
                        validActivityObject(group);
                    },
                    "it has a members feed": function(err, group) {
                        assert.ifError(err);
                        assert.isObject(group);
                        assert.include(group, "members");
			validFeed(group.members);
                    },
                    "it has a documents feed": function(err, group) {
                        assert.ifError(err);
                        assert.isObject(group);
                        assert.include(group, "documents");
			validFeed(group.documents);
		    },
                    "it has an inbox feed": function(err, group) {
                        assert.ifError(err);
                        assert.isObject(group);
                        assert.include(group, "links");
                        assert.isObject(group.links);
                        assert.include(group.links, "activity-inbox");
                        assert.isObject(group.links["activity-inbox"]);
                        assert.include(group.links["activity-inbox"], "href");
                        assert.isString(group.links["activity-inbox"].href);
                    },
                    "and we get the members feed": {
                        topic: function(group, act, cred) {
                            var callback = this.callback,
                                url = group.members.url;

                            gj(url, cred, function(err, data, resp) {
                                callback(err, data);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it's empty": function(err, feed) {
                            assert.ifError(err);
                            assert.equal(feed.totalItems, 0);
                            assert.isTrue(!_.has(feed, "items") || (_.isArray(feed.items) && feed.items.length === 0));
                        }
                    },
                    "and we get the documents feed": {
                        topic: function(group, act, cred) {
                            var callback = this.callback,
                                url = group.documents.url;

                            gj(url, cred, function(err, data, resp) {
                                callback(err, data);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it's empty": function(err, feed) {
                            assert.ifError(err);
                            assert.equal(feed.totalItems, 0);
                            assert.isTrue(!_.has(feed, "items") || (_.isArray(feed.items) && feed.items.length === 0));
                        }
                    },
                    "and we get the group inbox feed": {
                        topic: function(group, act, cred) {
                            var callback = this.callback,
                                url = group.links["activity-inbox"].href;

                            gj(url, cred, function(err, data, resp) {
                                callback(err, data);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it's empty": function(err, feed) {
                            assert.ifError(err);
                            assert.equal(feed.totalItems, 0);
                            assert.isTrue(!_.has(feed, "items") || (_.isArray(feed.items) && feed.items.length === 0));
                        }
                    }
                }
            }
        },
        "and we make another group": {
            topic: function() {
                var callback = this.callback,
                    url = "http://localhost:4815/api/user/graymouser/feed",
                    act = {
                        verb: "create",
                        to: [{
                            id: "http://activityschema.org/collection/public",
                            objectType: "collection"
                        }],
                        object: {
                            objectType: "group",
                            displayName: "Magicians",
                            summary: "Let's talk sorcery!"
                        }
                    },
                    cred;

                Step(
                    function() {
                        newCredentials("graymouser", "swords+_+_", this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        cred = results;
                        pj(url, cred, act, this);
                    },
                    function(err, data, resp) {
                        if (err) {
                            callback(err, null, null);
                        } else {
                            callback(null, data, cred);
                        }
                    }
                );
            },
            "it works": function(err, data, cred) {
                assert.ifError(err);
                validActivity(data);
            },
            "and another user tries to join it": {
                topic: function(created, cred) {
                    var callback = this.callback,
                        url = "http://localhost:4815/api/user/ningauble/feed",
                        act = {
                            verb: "join",
                            object: {
                                id: created.object.id,
                                objectType: created.object.objectType
                            }
                        },
                        newCred;

                    Step(
                        function() {
                            newCredentials("ningauble", "*iiiiiii*", this);
                        },
                        function(err, results) {
                            if (err) throw err;
                            newCred = results;
                            pj(url, newCred, act, this);
                        },
                        function(err, data, resp) {
                            if (err) {
                                callback(err, null, null);
                            } else {
                                callback(null, data, newCred);
                            }
                        }
                    );
                },
                "it works": function(err, data, cred) {
                    assert.ifError(err);
                    validActivity(data);
                },
		"and the creator checks the member feed": {
		    topic: function(joinAct, memberCred, createAct, creatorCred) {
                        var callback = this.callback,
                            url = joinAct.object.members.url,
			    cred = creatorCred;

                        gj(url, cred, function(err, data, resp) {
                            callback(err, data, joinAct.actor);
                        });
                    },
                    "it works": function(err, feed, joiner) {
                        assert.ifError(err);
                        validFeed(feed);
                    },
                    "it's got our joined person": function(err, feed, joiner) {
                        assert.ifError(err);
                        assert.equal(feed.totalItems, 1);
                        assert.equal(feed.items.length, 1);
                        validActivityObject(feed.items[0]);
                        assert.equal(feed.items[0].id, joiner.id);
                    },
                    "and the member leaves the group": {
		        topic: function(feed, joiner, joinAct, memberCred, createAct, creatorCred) {
                            var callback = this.callback,
                                url = "http://localhost:4815/api/user/ningauble/feed",
                                cred = memberCred,
                                group = createAct.object,
                                act = {
                                    verb: "leave",
                                    object: {
                                        id: group.id,
                                        objectType: group.objectType
                                    }
                                };

                            Step(
                                function() {
                                    pj(url, cred, act, this);
                                },
                                function(err, data, resp) {
                                    if (err) {
                                        callback(err, null);
                                    } else {
                                        callback(null, data);
                                    }
                                }
                            );
                        },
                        "it works": function(err, data) {
                            assert.ifError(err);
                            validActivity(data);
                        },
                        "and the creator checks the member feed": {
		            topic: function(leaveAct, feed, joiner, joinAct, memberCred, createAct, creatorCred) {

                                var callback = this.callback,
                                    url = createAct.object.members.url,
			            cred = creatorCred;

                                gj(url, cred, function(err, data, resp) {
                                    callback(err, data);
                                });
                            },
                            "it works": function(err, feed) {
                                assert.ifError(err);
                                validFeed(feed);
                            },
                            "it's empty": function(err, feed) {
                                assert.ifError(err);
                                assert.equal(feed.totalItems, 0);
                                assert.isTrue(!_.has(feed, "items") || (_.isArray(feed.items) && feed.items.length === 0));
                            }
                        }
                    }
		}
            }
        },
        "and two users join a group": {
            topic: function() {
                var callback = this.callback,
                    creds,
                    group;

                Step(
                    function() {
                        newCredentials("krovas", "grand*master", this.parallel());
                        newCredentials("fissif", "thief*no1", this.parallel());
                        newCredentials("slevyas", "thief*no2", this.parallel());
                    },
                    function(err, cred1, cred2, cred3) {
                        var url, act;
                        if (err) throw err;
                        creds = {
                            krovas: cred1,
                            fissif: cred2,
                            slevyas: cred3
                        };
                        url = "http://localhost:4815/api/user/krovas/feed";
                        act = {
                            verb: "create",
                            to: [{
                                id: "http://activityschema.org/collection/public",
                                objectType: "collection"
                            }],
                            object: {
                                objectType: "group",
                                displayName: "Thieves' Guild",
                                summary: "For thieves to hang out and help each other steal stuff"
                            }
                        };
                        pj(url, creds.krovas, act, this);
                    },
                    function(err, created) {
                        var url, act;
                        if (err) throw err;
                        group = created.object;
                        url = "http://localhost:4815/api/user/fissif/feed";
                        act = {
                            verb: "join",
                            object: group
                        };
                        pj(url, creds.fissif, act, this.parallel());
                        url = "http://localhost:4815/api/user/slevyas/feed";
                        act = {
                            verb: "join",
                            object: group
                        };
                        pj(url, creds.slevyas, act, this.parallel());
                    },
                    function(err) {
                        if (err) {
                            callback(err, null, null);
                        } else {
                            callback(null, group, creds);
                        }
                    }
                );
            },
            "it works": function(err, group, creds) {
                assert.ifError(err);
                validActivityObject(group);
                assert.isObject(creds);
            },
            "and one member posts to the group": {
                topic: function(group, creds) {
                    var callback = this.callback,
                        url = "http://localhost:4815/api/user/fissif/feed",
                        act = {
                            verb: "post",
                            to: [group],
                            object: {
                                objectType: "note",
                                content: "When is the next big caper, guys?"
                            }
                        };
                    pj(url, creds.fissif, act, function(err, data, resp) {
                        callback(err, data);
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                    validActivity(act);
                },
                "and we wait a second for delivery": {
                    topic: function(act, group, creds) {
                        var callback = this.callback;
                        setTimeout(function() {
                            callback(null);
                        }, 1000);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and the other member checks the group's inbox feed": {
                        topic: function(act, group, creds) {
                            var callback = this.callback,
                                url = group.links["activity-inbox"].href;
                            gj(url, creds.slevyas, function(err, data, resp) {
                                callback(err, data, act);
                            });
                        },
                        "it works": function(err, feed, act) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it includes the posted activity": function(err, feed, act) {
                            var item;
                            assert.ifError(err);
                            assert.isObject(feed);
                            assert.isNumber(feed.totalItems);
                            assert.greater(feed.totalItems, 0);
                            assert.isArray(feed.items);
                            assert.greater(feed.items.length, 0);
                            item = _.find(feed.items, function(item) { return item.id == act.id; });
                            assert.isObject(item);
                        }
                    },
                    "and the other member checks their own inbox feed": {
                        topic: function(act, group, creds) {
                            var callback = this.callback,
                                url = "http://localhost:4815/api/user/slevyas/inbox";
                            gj(url, creds.slevyas, function(err, data, resp) {
                                callback(err, data, act);
                            });
                        },
                        "it works": function(err, feed, act) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it includes the posted activity": function(err, feed, act) {
                            var item;
                            assert.ifError(err);
                            assert.isObject(feed);
                            assert.isNumber(feed.totalItems);
                            assert.greater(feed.totalItems, 0);
                            assert.isArray(feed.items);
                            assert.greater(feed.items.length, 0);
                            item = _.find(feed.items, function(item) { return item.id == act.id; });
                            assert.isObject(item);
                        }
                    }
                }
            }
        },
        "and a user joins an unknown group": {
            topic: function() {
                var callback = this.callback;

                Step(
                    function() {
                        newCredentials("ivrian", "dukes*daughter", this);
                    },
                    function(err, cred) {
                        var url, act;
                        if (err) throw err;
                        url = "http://localhost:4815/api/user/ivrian/feed";
                        act = {
                            verb: "join",
                            to: [{
                                id: "http://activityschema.org/collection/public",
                                objectType: "collection"
                            }],
                            object: {
                                id: "urn:uuid:bde3d2b4-b0f6-11e2-954a-2c8158efb9e9",
                                objectType: "group",
                                displayName: "Girlfriends",
                                summary: "For girlfriends of dumb adventurers"
                            }
                        };
                        pj(url, cred, act, this);
                    },
                    function(err, joinact, resp) {
                        callback(err);
                    }
                );
            },
            "it works": function(err) {
                assert.ifError(err);
            }
        },
        "and a user joins a group they don't have access to": {
            topic: function() {
                var callback = this.callback,
                    creds;

                Step(
                    function() {
                        newCredentials("vlana", "culture*actor", this.parallel());
                        newCredentials("vellix", "another*guy", this.parallel());
                    },
                    function(err, vlana, vellix) {
                        var url, act;
                        if (err) throw err;
                        creds = {vlana: vlana, vellix: vellix};
                        url = "http://localhost:4815/api/user/vlana/feed";
                        act = {
                            verb: "create",
                            object: {
                                objectType: "group",
                                displayName: "Partners",
                                summary: "Partners of Vlana"
                            }
                        };
                        pj(url, creds.vlana, act, this);
                    },
                    function(err, createact, resp) {
                        var url, act;
                        if (err) throw err;
                        url = "http://localhost:4815/api/user/vellix/feed";
                        act = {
                            verb: "join",
                            object: createact.object
                        };
                        pj(url, creds.vellix, act, this);
                    },
                    function(err, joinact, resp) {
                        if (err) {
                            callback(null);
                        } else {
                            callback(new Error("Unexpected success"));
                        }
                    }
                );
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we make some users": {
            topic: function() {
		var callback = this.callback,
		    cl;

                Step(
		    function() {
			newClient(this);
		    },
		    function(err, results) {
			var group = this.group(), i;
			cl = results;
			for (i = 0; i < 7; i++) {
                            newPair(cl, "priest"+i, "dark*watcher*"+i, group());
			}
                    },
                    function(err, pairs) {
                        if (err) {
			    callback(err, null);
			} else {
			    callback(null, _.map(pairs, function(pair) { return makeCred(cl, pair); }));
			}
                    }
                );
            },
            "it works": function(err, creds) {
                assert.ifError(err);
		assert.isArray(creds);
            },
	    "and they all join a group": {
		topic: function(creds) {
		    var callback = this.callback,
			priests = _.map(creds, function(cred) { return cred.user.profile; }),
			group;

		    Step(
			function() {
			    var url = "http://localhost:4815/api/user/priest0/feed",
				act = {
				    verb: "create",
				    to: priests,
				    object: {
					objectType: "group",
					displayName: "Black Priests",
					summary: "Defenders of truth and justice"
				    }
				};
			    pj(url, creds[0], act, this);
			},
			function(err, act) {
			    var gr = this.group();
			    if (err) throw err;
			    group = act.object;
			    _.times(7, function(i) {
				var url = "http://localhost:4815/api/user/priest"+i+"/feed",
				    act = {
					verb: "join",
					object: group
				    };

				pj(url, creds[i], act, gr());
			    });
			},
			function(err, joins) {
			    if (err) {
				callback(err, null);
			    } else {
				callback(err, group);
			    }
			}
		    );
		},
		"it works": function(err, group) {
		    assert.ifError(err);
		    validActivityObject(group);
		},
		"and the creator adds a document": {
		    topic: function(group, creds) {
			var callback = this.callback,
			    url = "http://localhost:4815/api/user/priest0/feed",
			    act = {
				verb: "post",
				object: {
				    id: "http://photo.example/priest0/photos/the-whole-gang",
				    objectType: "image",
				    displayName: "Group photo",
				    url: "http://photo.example/priest0/photos/the-whole-gang.jpg"
				},
				target: group
			    };

			Step(
			    function() {
				pj(url, creds[0], act, this);
			    },
			    function(err, body) {
				callback(err);
			    }
			);
		    },
		    "it works": function(err) {
			assert.ifError(err);
		    },
		    "and the creator reads the document feed": {
			topic: function(group, creds) {
                            var callback = this.callback,
                                url = group.documents.url;

                            gj(url, creds[0], function(err, data, resp) {
                                callback(err, data);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it has the added object": function(err, feed) {
                            assert.ifError(err);
                            assert.isTrue(feed.totalItems > 0);
			    assert.isArray(feed.items);
                            assert.isTrue(feed.items.length > 0);
			    assert.isObject(_.find(feed.items, function(item) { return item.url == "http://photo.example/priest0/photos/the-whole-gang.jpg"; }));
                        }
		    },
		    "and another member reads the document feed": {
			topic: function(group, creds) {
                            var callback = this.callback,
                                url = group.documents.url;

                            gj(url, creds[6], function(err, data, resp) {
                                callback(err, data);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it has the added object": function(err, feed) {
                            assert.ifError(err);
                            assert.isTrue(feed.totalItems > 0);
			    assert.isArray(feed.items);
                            assert.isTrue(feed.items.length > 0);
			    assert.isObject(_.find(feed.items, function(item) { return item.url == "http://photo.example/priest0/photos/the-whole-gang.jpg"; }));
                        }
		    }
		},
		"and another member adds a document": {
		    topic: function(group, creds) {
			var callback = this.callback,
			    url = "http://localhost:4815/api/user/priest1/feed",
			    act = {
				verb: "post",
				object: {
				    id: "http://docs.example/priest1/files/action-plan",
				    objectType: "file",
				    displayName: "Action Plan",
				    url: "http://docs.example/priest1/files/action-plan.docx"
				},
				target: group
			    };

			Step(
			    function() {
				pj(url, creds[1], act, this);
			    },
			    function(err, body) {
				callback(err);
			    }
			);
		    },
		    "it works": function(err) {
			assert.ifError(err);
		    },
		    "and the creator reads the document feed": {
			topic: function(group, creds) {
                            var callback = this.callback,
                                url = group.documents.url;

                            gj(url, creds[1], function(err, data, resp) {
                                callback(err, data);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it has the added object": function(err, feed) {
                            assert.ifError(err);
                            assert.isTrue(feed.totalItems > 0);
			    assert.isArray(feed.items);
                            assert.isTrue(feed.items.length > 0);
			    assert.isObject(_.find(feed.items, function(item) { return item.url == "http://docs.example/priest1/files/action-plan.docx"; }));
                        }
		    },
		    "and another member reads the document feed": {
			topic: function(group, creds) {
                            var callback = this.callback,
                                url = group.documents.url;

                            gj(url, creds[5], function(err, data, resp) {
                                callback(err, data);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it has the added object": function(err, feed) {
                            assert.ifError(err);
                            assert.isTrue(feed.totalItems > 0);
			    assert.isArray(feed.items);
                            assert.isTrue(feed.items.length > 0);
			    assert.isObject(_.find(feed.items, function(item) { return item.url == "http://docs.example/priest1/files/action-plan.docx"; }));
                        }
		    }
		},
		"and a non-member tries to read the document feed": {
		    topic: function(group, creds) {
                        var callback = this.callback,
                            url = group.documents.url;

			Step(
			    function() {
				newCredentials("theduke", "total*sadist", this);
			    },
			    function(err, cred) {
				if (err) throw err;
				gj(url, cred, this);
			    },
			    function(err, body, response) {
				if (err && err.statusCode == 403) {
				    callback(null);
				} else if (err) {
				    callback(err);
				} else {
				    callback(new Error("Unexpected success!"));
				}
			    }
			);
                    },
		    "it fails correctly": function(err) {
			assert.ifError(err);
		    }
		},
		"and a non-member tries to add a document": {
		    topic: function(group, creds) {
                        var callback = this.callback,
                            url = group.documents.url;

			Step(
			    function() {
				newCredentials("ohmphal", "a*thief's*skull", this);
			    },
			    function(err, cred) {
				var url, act;
				if (err) throw err;
				url = "http://localhost:4815/api/user/ohmphal/feed";
				act = {
				    verb: "post",
				    object: {
					id: "urn:uuid:5245d4e2-60b1-42b8-b24d-032e92a86ac7",
					objectType: "audio",
					displayName: "Scary moan",
					url: "http://sound.example/ohmphal/scary-moan.flac"
				    },
				    target: group
				};
				pj(url, cred, act, this);
			    },
			    function(err, body, response) {
				if (err && err.statusCode == 400) {
				    callback(null);
				} else if (err) {
				    callback(err);
				} else {
				    callback(new Error("Unexpected success!"));
				}
			    }
			);
                    },
		    "it fails correctly": function(err) {
			assert.ifError(err);
		    }
		},
		"and a non-member tries to read the members feed": {
		    topic: function(group, creds) {
                        var callback = this.callback,
                            url = group.members.url;

			Step(
			    function() {
				newCredentials("atya", "scraw*scraw", this);
			    },
			    function(err, cred) {
				if (err) throw err;
				gj(url, cred, this);
			    },
			    function(err, body, response) {
				if (err && err.statusCode == 403) {
				    callback(null);
				} else if (err) {
				    callback(err);
				} else {
				    callback(new Error("Unexpected success!"));
				}
			    }
			);
                    },
		    "it fails correctly": function(err) {
			assert.ifError(err);
		    }
		},
		"and a member adds and removes a document": {
		    topic: function(group, creds) {
			var callback = this.callback,
			    url = "http://localhost:4815/api/user/priest2/feed";

			Step(
			    function() {
				var act = {
				    verb: "post",
				    object: {
					id: "http://photo.example/priest2/photos/my-vacation-2006",
					objectType: "image",
					displayName: "Vacation photo",
					url: "http://photo.example/priest2/photos/my-vacation-2006.jpg"
				    },
				    target: group
				};
				pj(url, creds[2], act, this);
			    },
			    function(err, posted) {
				if (err) throw err;
				var act = {
				    verb: "remove",
				    object: {
					id: "http://photo.example/priest2/photos/my-vacation-2006",
					objectType: "image"
				    },
				    target: group
				};
				pj(url, creds[2], act, this);
			    },
			    function(err, body) {
				callback(err);
			    }
			);
		    },
		    "it works": function(err) {
			assert.ifError(err);
		    },
		    "and the poster checks the documents feed": {
			topic: function(group, creds) {
                            var callback = this.callback,
                                url = group.documents.url;

                            gj(url, creds[2], function(err, data, resp) {
                                callback(err, data);
                            });
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it does not have the object": function(err, feed) {
                            assert.ifError(err);
			    assert.isArray(feed.items);
			    assert.isUndefined(_.find(feed.items, function(item) { return item.id == "http://photo.example/priest2/photos/my-vacation-2006"; }));
                        }
		    }
		}
	    }
	}
    }
});

suite["export"](module);
