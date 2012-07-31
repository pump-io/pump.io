// activity-api-test.js
//
// Test activity REST API
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
    http = require("http"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    actutil = require("./lib/activity"),
    setupApp = oauthutil.setupApp,
    register = oauthutil.register,
    accessToken = oauthutil.accessToken,
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
                newCredentials("macdonald", "theoldflag", this.callback);
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
                                content: "The people would prefer John A. drunk to George Brown sober."
                            }
                        };
                    httputil.postJSON("http://localhost:4815/api/user/macdonald/feed", cred, act, function(err, act, response) {
                        cb(err, act);
                    });
                },
                "it works": function(err, act) {
                    assert.ifError(err);
                    assert.isObject(act);
                },
                "the object includes a replies property": function(err, act) {
                    assert.ifError(err);
                    assert.isObject(act);
                    assert.includes(act, "object");
                    assert.isObject(act.object);
                    assert.includes(act.object, "replies");
                    assert.isObject(act.object.replies);
                    assert.includes(act.object.replies, "url");
                    assert.isString(act.object.replies.url);
                    assert.includes(act.object.replies, "totalItems");
                    assert.isNumber(act.object.replies.totalItems);
                    assert.equal(act.object.replies.totalItems, 0);
                },
                "and we fetch the replies feed": {
                    topic: function(act, cred) {
                        var cb = this.callback,
                            url = act.object.replies.url;

                        httputil.getJSON(url, cred, function(err, coll, response) {
                            cb(err, coll);
                        });
                    },
                    "it works": function(err, coll) {
                        assert.ifError(err);
                        assert.isObject(coll);
                    },
                    "it is an empty collection": function(err, coll) {
                        assert.ifError(err);
                        assert.isObject(coll);
                        assert.includes(coll, "id");
                        assert.isString(coll.id);
                        assert.includes(coll, "totalItems");
                        assert.isNumber(coll.totalItems);
                        assert.equal(coll.totalItems, 0);
                        assert.includes(coll, "items");
                        assert.isArray(coll.items);
                        assert.lengthOf(coll.items, 0);
                    }
                }
            }
        }
    }
});

suite["export"](module);
