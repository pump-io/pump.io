// group-inbox-api-test-as-root.js
//
// Test posting to the group inbox
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
    util = require("util"),
    urlparse = require("url").parse,
    vows = require("vows"),
    Step = require("step"),
    http = require("http"),
    querystring = require("querystring"),
    _ = require("underscore"),
    version = require("../lib/version").version,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    validActivityObject = actutil.validActivityObject,
    validFeed = actutil.validFeed,
    validActivity = actutil.validActivity,
    pj = httputil.postJSON,
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    dialbackApp = require("./lib/dialback").dialbackApp,
    setupApp = oauthutil.setupApp;

var clientCred = function(cl) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret
    };
};

var assoc = function(id, token, ts, callback) {

    var URL = "http://localhost:4815/api/client/register",
        requestBody = querystring.stringify({type: "client_associate"}),
        parseJSON = function(err, response, data) {
            var obj;
            if (err) {
                callback(err, null, null);
            } else {
                try {
                    obj = JSON.parse(data);
                    callback(null, obj, response);
                } catch (e) {
                    callback(e, null, null);
                }
            }
        };

    if (!ts) ts = Date.now();

    httputil.dialbackPost(URL, 
                          id, 
                          token, 
                          ts, 
                          requestBody, 
                          "application/x-www-form-urlencoded",
                          parseJSON);
};

var suite = vows.describe("group inbox API");

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            var app, callback = this.callback;
            Step(
                function() {
                    setupApp(this);
                },
                function(err, result) {
                    if (err) throw err;
                    app = result;
                    dialbackApp(80, "social.localhost", this);
                },
                function(err, dbapp) {
                    if (err) {
                        callback(err, null, null);
                    } else {
                        callback(err, app, dbapp);
                    }
                }
            );
        },
        teardown: function(app, dbapp) {
            app.close();
            dbapp.close();
        },
        "and we create a new group": {
            topic: function() {
                var callback = this.callback,
                    url = "http://localhost:4815/api/user/mark/feed",
                    group,
                    cred;

                Step(
                    function() {
                        newCredentials("mark", "lock*the*gates", this);
                    },
                    function(err, results) {
                        var act = {
                                verb: "create",
                                object: {
                                    objectType: "group",
                                    displayName: "WTForicans"
                                }
                            };

                        if (err) throw err;

                        cred = results;
                        pj(url, cred, act, this);
                    },
                    function(err, act) {
                        var join;
                        if (err) throw err;
                        group = act.object;
                        join = {
                            verb: "join",
                            object: group
                        };
                        pj(url, cred, join, this);
                    },
                    function(err, join) {
                        if (err) {
                            callback(err, null, null);
                        } else {
                            callback(null, group, cred);
                        }
                    }
                );
            },
            "it works": function(err, group, cred) {
                assert.ifError(err);
                validActivityObject(group);
            },
            "and we check the inbox endpoint": {
                topic: function(group) {
                    var parsed = urlparse(group.links["activity-inbox"].href);

                    httputil.options(parsed.hostname, parsed.port, parsed.path, this.callback);
                },
                "it exists": function(err, allow, res, body) {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 200);
                },
                "it supports GET": function(err, allow, res, body) {
                    assert.include(allow, "GET");
                },
                "it supports POST": function(err, allow, res, body) {
                    assert.include(allow, "POST");
                }
            },
            "and we post to the inbox without credentials": {
                topic: function(group) {
                    var callback = this.callback,
                        reqOpts = urlparse(group.links["activity-inbox"].href),
                        act = {
                            actor: {
                                id: "acct:user1@social.localhost",
                                objectType: "person"
                            },
                            to: [group],
                            id: "http://social.localhost/activity/1",
                            verb: "post",
                            object: {
                                id: "http://social.localhost/note/1",
                                objectType: "note",
                                content: "Hello, world!"
                            }
                        },
                        requestBody = JSON.stringify(act);

                    reqOpts.method = "POST";
                    reqOpts.headers = {
                        "Content-Type": "application/json",
                        "Content-Length": requestBody.length,
                        "User-Agent": "pump.io/"+version
                    };

                    var req = http.request(reqOpts, function(res) {
                        var body = "";
                        res.setEncoding("utf8");
                        res.on("data", function(chunk) {
                            body = body + chunk;
                        });
                        res.on("error", function(err) {
                            callback(err, null, null);
                        });
                        res.on("end", function() {
                            callback(null, res, body);
                        });
                    });

                    req.on("error", function(err) {
                        callback(err, null, null);
                    });

                    req.write(requestBody);

                    req.end();
                },
                "and it fails correctly": function(err, res, body) {
                    assert.ifError(err);
                    assert.greater(res.statusCode, 399);
                    assert.lesser(res.statusCode, 500);
                }
            },
            "and we post to the inbox with unattributed OAuth credentials": {
                topic: function(group) {
                    var callback = this.callback,
                        inbox = group.links["activity-inbox"].href;

                    Step(
                        function() {
                            newClient(this);
                        },
                        function(err, cl) {

                            if (err) throw err;

                            var url = inbox,
                                act = {
                                    actor: {
                                        id: "acct:user1@social.localhost",
                                        objectType: "person"
                                    },
                                    id: "http://social.localhost/activity/2",
                                    to: [group],
                                    verb: "post",
                                    object: {
                                        id: "http://social.localhost/note/2",
                                        objectType: "note",
                                        content: "Hello again, world!"
                                    }
                                },
                                cred = clientCred(cl);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, body, res) {
                            if (err && err.statusCode === 401) {
                                callback(null);
                            } else if (err) {
                                callback(err);
                            } else {
                                callback(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "and it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we post to the inbox with OAuth credentials for a host": {
                topic: function(group) {
                    var callback = this.callback;

                    Step(
                        function() {
                            assoc("social.localhost", "VALID1", Date.now(), this);
                        },
                        function(err, cl) {

                            if (err) throw err;

                            var url = group.links["activity-inbox"].href,
                                act = {
                                    actor: {
                                        id: "http://social.localhost/",
                                        objectType: "service"
                                    },
                                    id: "http://social.localhost/activity/3",
                                    to: [group],
                                    verb: "post",
                                    to: [{objectType: "person",
                                          id: "http://localhost:4815/api/user/louisck"}],
                                    object: {
                                        id: "http://social.localhost/note/2",
                                        objectType: "note",
                                        content: "Hello from the service!"
                                    }
                                },
                                cred = clientCred(cl);

                            httputil.postJSON(url, cred, act, this);
                        },
                        callback
                    );
                },
                "it works": function(err, act, resp) {
                    assert.ifError(err);
                    assert.isObject(act);
                }
            },
            "and we post to the inbox with OAuth credentials for an unrelated webfinger": {
                topic: function(group) {
                    var callback = this.callback;

                    Step(
                        function() {
                            assoc("user0@social.localhost", "VALID2", Date.now(), this);
                        },
                        function(err, cl) {

                            if (err) throw err;

                            var url = group.links["activity-inbox"].href,
                                act = {
                                    actor: {
                                        id: "acct:user2@social.localhost",
                                        objectType: "person"
                                    },
                                    id: "http://social.localhost/activity/4",
                                    verb: "post",
                                    object: {
                                        id: "http://social.localhost/note/3",
                                        objectType: "note",
                                        content: "Hello again, world!"
                                    }
                                },
                                cred = clientCred(cl);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, body, res) {
                            if (err && err.statusCode === 400) {
                                callback(null);
                            } else if (err) {
                                callback(err);
                            } else {
                                callback(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "and it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we post an activity to the inbox with OAuth credentials for the actor": {

                topic: function(group) {
                    var callback = this.callback;

                    Step(
                        function() {
                            assoc("user3@social.localhost", "VALID1", Date.now(), this);
                        },
                        function(err, cl) {

                            if (err) throw err;

                            var url = group.links["activity-inbox"].href,
                                act = {
                                    actor: {
                                        id: "acct:user3@social.localhost",
                                        objectType: "person"
                                    },
                                    to: [group],
                                    id: "http://social.localhost/activity/5",
                                    verb: "post",
                                    object: {
                                        id: "http://social.localhost/note/3",
                                        objectType: "note",
                                        content: "Hello again, world!"
                                    },
                                    published: (new Date()).toISOString(),
                                    updated: (new Date()).toISOString()
                                },
                                cred = clientCred(cl);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, body, resp) {
                            callback(err, body);
                        }
                    );
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                    validActivity(act);
                },
                "and we wait a second for distribution": {
                    topic: function(act, group, mcred) {
                        var callback = this.callback;
                        setTimeout(function() {
                            callback(null);
                        }, 1000);
                    },
                    "and we check the group's inbox": {
                        topic: function(act, group, mcred) {
                            var callback = this.callback,
                                url = group.links["activity-inbox"].href;
                            httputil.getJSON(url, mcred, function(err, feed, result) {
                                callback(err, feed, act);
                            });
                        },
                        "it works": function(err, feed, act) {
                            assert.ifError(err);
                            validFeed(feed);
                        },
                        "it includes our posted activity": function(err, feed, act) {
                            assert.ifError(err);
                            assert.isObject(feed);
                            assert.include(feed, "items");
                            assert.isArray(feed.items);
                            assert.greater(feed.items.length, 0);
                            assert.isTrue(_.some(feed.items, function(item) {
                                return (_.isObject(item) && item.id == act.id);
                            }));
                        }
                    }
                }
            },
            "and we post an activity to the inbox with OAuth credentials for the actor not directed to the group": {

                topic: function(group) {
                    var callback = this.callback;

                    Step(
                        function() {
                            assoc("user4@social.localhost", "VALID1", Date.now(), this);
                        },
                        function(err, cl) {

                            if (err) throw err;

                            var url = group.links["activity-inbox"].href,
                                act = {
                                    actor: {
                                        id: "acct:user4@social.localhost",
                                        objectType: "person"
                                    },
                                    id: "http://social.localhost/activity/6",
                                    verb: "post",
                                    object: {
                                        id: "http://social.localhost/note/4",
                                        objectType: "note",
                                        content: "Hello again again, world!"
                                    },
                                    published: (new Date()).toISOString(),
                                    updated: (new Date()).toISOString()
                                },
                                cred = clientCred(cl);

                            httputil.postJSON(url, cred, act, this);
                        },
                        function(err, body, resp) {
                            if (err && err.statusCode >= 400 && err.statusCode < 500) {
                                callback(null);
                            } else if (err) {
                                callback(err);
                            } else {
                                callback(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite["export"](module);
