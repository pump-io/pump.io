// activity-api-test.js
//
// Test activity REST API
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
    _ = require("underscore"),
    http = require("http"),
    version = require("../lib/version").version,
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    newCredentials = oauthutil.newCredentials;

var suite = vows.describe("Activity API test");

// A batch for testing the read-write access to the API

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
                newCredentials("gerold", "just*a*guy", this.callback);
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
                        url = "http://localhost:4815/api/user/gerold/feed",
                        act = {
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                    httputil.postJSON(url, cred, act, function(err, act, response) {
                        cb(err, act);
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                    assert.isObject(act);
                },
                "and we check the options on the JSON url": {
                    topic: function(act, cred) {
                        var parts = urlparse(act.id);
                        httputil.options("localhost", 4815, parts.path, this.callback);
                    },
                    "it exists": function(err, allow, res, body) {
                        assert.ifError(err);
                        assert.equal(res.statusCode, 200);
                    },
                    "it allows GET": function(err, allow, res, body) {
                        assert.include(allow, "GET");
                    },
                    "it allows PUT": function(err, allow, res, body) {
                        assert.include(allow, "PUT");
                    },
                    "it allows DELETE": function(err, allow, res, body) {
                        assert.include(allow, "DELETE");
                    }
                },
                "and we GET the activity": {
                    topic: function(posted, cred) {
                        var cb = this.callback;
                        httputil.getJSON(posted.id, cred, function(err, got, result) {
                            cb(err, {got: got, posted: posted});
                        });
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                        assert.isObject(res.got);
                    },
                    "results look right": function(err, res) {
                        var got = res.got;
                        actutil.validActivity(got);
                    },
                    "it has the correct data": function(err, res) {
                        var got = res.got, posted = res.posted;
                        assert.equal(got.id, posted.id);
                        assert.equal(got.verb, posted.verb);
                        assert.equal(got.published, posted.published);
                        assert.equal(got.updated, posted.updated);
                        assert.equal(got.actor.id, posted.actor.id);
                        assert.equal(got.actor.objectType, posted.actor.objectType);
                        assert.equal(got.actor.displayName, posted.actor.displayName);
                        assert.equal(got.object.id, posted.object.id);
                        assert.equal(got.object.objectType, posted.object.objectType);
                        assert.equal(got.object.content, posted.object.content);
                        assert.equal(got.object.published, posted.object.published);
                        assert.equal(got.object.updated, posted.object.updated);
                    },
                    "and we PUT a new version of the activity": {
                        topic: function(got, act, cred) {
                            var cb = this.callback,
                                newact = JSON.parse(JSON.stringify(act));

                            newact.mood = {
                                displayName: "Friendly"
                            };
                            // wait 2000 ms to make sure updated != published
                            setTimeout(function() {
                                httputil.putJSON(act.id, cred, newact, function(err, contents, result) {
                                    cb(err, {newact: contents, act: act});
                                });
                            }, 2000);
                        },
                        "it works": function(err, res) {
                            assert.ifError(err);
                            assert.isObject(res.newact);
                        },
                        "results look right": function(err, res) {
                            var newact = res.newact, act = res.act;
                            actutil.validActivity(newact);
                            assert.include(newact, "mood");
                            assert.isObject(newact.mood);
                            assert.include(newact.mood, "displayName");
                            assert.isString(newact.mood.displayName);
                        },
                        "it has the correct data": function(err, res) {
                            var newact = res.newact, act = res.act;
                            assert.equal(newact.id, act.id);
                            assert.equal(newact.verb, act.verb);
                            assert.equal(newact.published, act.published);
                            assert.notEqual(newact.updated, act.updated);
                            assert.equal(newact.actor.id, act.actor.id);
                            assert.equal(newact.actor.objectType, act.actor.objectType);
                            assert.equal(newact.actor.displayName, act.actor.displayName);
                            assert.equal(newact.actor.published, act.actor.published);
                            assert.equal(newact.actor.updated, act.actor.updated);
                            assert.equal(newact.object.id, act.object.id);
                            assert.equal(newact.object.objectType, act.object.objectType);
                            assert.equal(newact.object.content, act.object.content);
                            assert.equal(newact.object.published, act.object.published);
                            assert.equal(newact.object.updated, act.object.updated);
                            assert.equal(newact.mood.displayName, "Friendly");
                        },
                        "and we DELETE the activity": {
                            topic: function(put, got, posted, cred) {
                                var cb = this.callback;

                                httputil.delJSON(posted.id, cred, function(err, doc, result) {
                                    cb(err, doc);
                                });
                            },
                            "it works": function(err, doc) {
                                assert.ifError(err);
                                assert.equal(doc, "Deleted");
                            }
                        }
                    }
                }
            },
            "and we post another activity": {
                topic: function(cred) {
                    var cb = this.callback,
                        act = {
                            verb: "post",
                            to: [{
                                id: "http://activityschema.org/collection/public",
                                objectType: "collection"
                            }],
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/gerold/feed", cred, act, function(err, act, response) {
                        cb(err, act);
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "and we GET the activity with different credentials than the author": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        
                        Step(
                            function() {
                                newCredentials("harold", "1077*hastings", this);
                            },
                            function(err, pair) {
                                var nuke;
                                if (err) throw err;
                                nuke = _(cred).clone();
                                _(nuke).extend(pair);
                                httputil.getJSON(act.id, nuke, this);
                            },
                            function(err, doc, res) {
                                cb(err, doc, act);
                            }
                        );
                    },
                    "it works": function(err, doc, act) {
                        assert.ifError(err);
                        actutil.validActivity(doc);
                    }
                },
                "and we GET the activity with no credentials": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            parsed = urlparse(act.id),
                            options = {
                                host: "localhost",
                                port: 4815,
                                path: parsed.path,
                                headers: {
                                    "User-Agent": "pump.io/"+version,
                                    "Content-Type": "application/json"
                                }
                            };
                        
                        http.get(options, function(response) {
                            if (response.statusCode < 400 || response.statusCode >= 500) {
                                cb(new Error("Unexpected response code " + response.statusCode));
                            } else {
                                cb(null);
                            }
                        }).on("error", function(err) {
                            cb(err);
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we GET the activity with invalid consumer key": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone();
                        nuke.consumer_key = "NOTAKEY";
                        httputil.getJSON(act.id, nuke, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we GET the activity with invalid consumer secret": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone();
                        nuke.consumer_secret = "NOTASECRET";
                        httputil.getJSON(act.id, nuke, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we GET the activity with invalid token": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone();
                        nuke.token = "NOTATOKEN";
                        httputil.getJSON(act.id, nuke, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we GET the activity with invalid token secret": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone();
                        nuke.token_secret = "NOTATOKENSECRET";
                        httputil.getJSON(act.id, nuke, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                }
            },
            "and we post yet another activity": {
                topic: function(cred) {
                    var cb = this.callback,
                        act = {
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/gerold/feed", cred, act, function(err, act, response) {
                        cb(err, act);
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "and we PUT the activity with different credentials than the author": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            newact = JSON.parse(JSON.stringify(act));
                        
                        newact.mood = {
                            displayName: "Friendly"
                        };
                        
                        Step(
                            function() {
                                newCredentials("ignace", "katt+brick", this);
                            },
                            function(err, pair) {
                                var nuke;
                                if (err) throw err;
                                nuke = _(cred).clone();
                                _(nuke).extend(pair);
                                httputil.putJSON(act.id, nuke, newact, this);
                            },
                            function(err, doc, res) {
                                if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                    cb(null);
                                } else if (err && err.statusCode) {
                                    cb(new Error("Unexpected status code: " + err.statusCode));
                                } else {
                                    cb(new Error("Unexpected results!"));
                                }
                            }
                        );
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we PUT the activity with no credentials": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            parsed = urlparse(act.id),
                            options = {
                                host: "localhost",
                                port: 4815,
                                path: parsed.path,
                                method: "PUT",
                                headers: {
                                    "User-Agent": "pump.io/"+version,
                                    "Content-Type": "application/json"
                                }
                            },
                            newact = JSON.parse(JSON.stringify(act));
                        
                        newact.mood = {
                            displayName: "Friendly"
                        };

                        var req = http.request(options, function(res) {
                            if (res.statusCode >= 400 && res.statusCode < 500) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected status code: " + res.statusCode));
                            }
                        }).on("error", function(err) {
                            cb(err);
                        });
                        req.write(JSON.stringify(newact));
                        req.end();
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we PUT the activity with invalid consumer key": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone(),
                            newact = JSON.parse(JSON.stringify(act));
                        
                        newact.mood = {
                            displayName: "Friendly"
                        };
                        nuke.consumer_key = "NOTAKEY";

                        httputil.putJSON(act.id, nuke, newact, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we PUT the activity with invalid consumer secret": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone(),
                            newact = JSON.parse(JSON.stringify(act));
                        
                        newact.mood = {
                            displayName: "Friendly"
                        };
                        nuke.consumer_secret = "NOTASECRET";

                        httputil.putJSON(act.id, nuke, newact, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we PUT the activity with invalid token": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone(),
                            newact = JSON.parse(JSON.stringify(act));
                        
                        newact.mood = {
                            displayName: "Friendly"
                        };
                        nuke.token = "NOTATOKEN";

                        httputil.putJSON(act.id, nuke, newact, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we PUT the activity with invalid token secret": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone(),
                            newact = JSON.parse(JSON.stringify(act));
                        
                        newact.mood = {
                            displayName: "Friendly"
                        };
                        nuke.token_secret = "NOTATOKENSECRET";

                        httputil.putJSON(act.id, nuke, newact, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                }
            },
            "and we post still another activity": {
                topic: function(cred) {
                    var cb = this.callback,
                        act = {
                            verb: "post",
                            object: {
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/gerold/feed", cred, act, function(err, act, response) {
                        cb(err, act);
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "and we DELETE the activity with different credentials than the author": {
                    topic: function(act, cred) {
                        var cb = this.callback;
                        
                        Step(
                            function() {
                                newCredentials("jeremy", "b4ntham!", this);
                            },
                            function(err, pair) {
                                var nuke;
                                if (err) throw err;
                                nuke = _(cred).clone();
                                _(nuke).extend(pair);
                                httputil.delJSON(act.id, nuke, this);
                            },
                            function(err, doc, res) {
                                if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                    cb(null);
                                } else if (err && err.statusCode) {
                                    cb(new Error("Unexpected status code: " + err.statusCode));
                                } else {
                                    cb(new Error("Unexpected results!"));
                                }
                            }
                        );
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we DELETE the activity with no credentials": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            parsed = urlparse(act.id),
                            options = {
                                host: "localhost",
                                port: 4815,
                                path: parsed.path,
                                method: "DELETE",
                                headers: {
                                    "User-Agent": "pump.io/"+version
                                }
                            };
                        var req = http.request(options, function(res) {
                            if (res.statusCode >= 400 && res.statusCode < 500) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected status code: " + res.statusCode));
                            }
                        }).on("error", function(err) {
                            cb(err);
                        });
                        req.end();
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we DELETE the activity with invalid consumer key": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone();
                        
                        nuke.consumer_key = "NOTAKEY";

                        httputil.delJSON(act.id, nuke, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we DELETE the activity with invalid consumer secret": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone();
                        
                        nuke.consumer_secret = "NOTASECRET";

                        httputil.delJSON(act.id, nuke, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we DELETE the activity with invalid token": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone();
                        
                        nuke.token = "NOTATOKEN";

                        httputil.delJSON(act.id, nuke, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we DELETE the activity with invalid token secret": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            nuke = _(cred).clone();
                        
                        nuke.token_secret = "NOTATOKENSECRET";

                        httputil.delJSON(act.id, nuke, function(err, doc, response) {
                            if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                                cb(null);
                            } else if (err && err.statusCode) {
                                cb(new Error("Unexpected status code: " + err.statusCode));
                            } else {
                                cb(new Error("Unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                }
            },
            "and we PUT an activity then GET it": {
                topic: function(cred) {
                    var cb = this.callback,
                        act = {
                            verb: "listen",
                            object: {
                                objectType: "audio",
                                id: "http://example.net/music/jingle-bells",
                                displayName: "Jingle Bells"
                            }
                        },
                        id;

                    Step(
                        function() {
                            httputil.postJSON("http://localhost:4815/api/user/gerold/feed", cred, act, this);
                        },
                        function(err, posted, resp) {
                            var changed;
                            if (err) throw err;
                            id = posted.id;
                            changed = JSON.parse(JSON.stringify(posted)); // copy it
                            changed.mood = {
                                displayName: "Merry"
                            };
                            httputil.putJSON(id, cred, changed, this);
                        },
                        function(err, put, resp) {
                            if (err) throw err;
                            httputil.getJSON(id, cred, this);
                        },
                        function(err, got, resp) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, got);
                            }
                        }
                    );
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                },
                "results are valid": function(err, act) {
                    assert.ifError(err);
                    actutil.validActivity(act);
                },
                "results include our changes": function(err, act) {
                    assert.ifError(err);
                    assert.include(act, "mood");
                    assert.isObject(act.mood);
                    assert.include(act.mood, "displayName");
                    assert.isString(act.mood.displayName);
                    assert.equal(act.mood.displayName, "Merry");
                }
            },
            "and we DELETE an activity then GET it": {
                topic: function(cred) {
                    var cb = this.callback,
                        act = {
                            verb: "play",
                            object: {
                                objectType: "video",
                                id: "http://example.net/video/autotune-the-news-5",
                                displayName: "Autotune The News 5"
                            }
                        },
                        id;

                    Step(
                        function() {
                            httputil.postJSON("http://localhost:4815/api/user/gerold/feed", cred, act, this);
                        },
                        function(err, posted, resp) {
                            if (err) throw err;
                            id = posted.id;
                            httputil.delJSON(id, cred, this);
                        },
                        function(err, doc, resp) {
                            if (err) throw err;
                            httputil.getJSON(id, cred, this);
                        },
                        function(err, got, resp) {
                            if (err && err.statusCode && err.statusCode == 410) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails with a 410 Gone status code": function(err, act) {
                    assert.ifError(err);
                }
            },
            "and we PUT a non-existent activity": {
                topic: function(cred) {
                    var cb = this.callback,
                        url = "http://localhost:4815/api/activity/NONEXISTENT",
                        act = {
                            verb: "play",
                            object: {
                                objectType: "video",
                                id: "http://example.net/video/autotune-the-news-4",
                                displayName: "Autotune The News 4"
                            }
                        };

                        httputil.putJSON(url, cred, act, function(err, got, resp) {
                            if (err && err.statusCode && err.statusCode == 404) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails with a 404 status code": function(err, act) {
                    assert.ifError(err);
                }
            },
            "and we GET a non-existent activity": {
                topic: function(cred) {
                    var cb = this.callback,
                        url = "http://localhost:4815/api/activity/NONEXISTENT";

                        httputil.getJSON(url, cred, function(err, got, resp) {
                            if (err && err.statusCode && err.statusCode == 404) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails with a 404 status code": function(err, act) {
                    assert.ifError(err);
                }
            },
            "and we DELETE a non-existent activity": {
                topic: function(cred) {
                    var cb = this.callback,
                        url = "http://localhost:4815/api/activity/NONEXISTENT";

                        httputil.delJSON(url, cred, function(err, got, resp) {
                            if (err && err.statusCode && err.statusCode == 404) {
                                cb(null);
                            } else if (err) {
                                cb(err);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails with a 404 status code": function(err, act) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite["export"](module);
