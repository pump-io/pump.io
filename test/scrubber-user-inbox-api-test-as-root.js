// user-inbox-api-test-as-root.js
//
// Test posting to the user inbox
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
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    newCredentials = oauthutil.newCredentials,
    newClient = oauthutil.newClient,
    dialbackApp = require("./lib/dialback").dialbackApp,
    setupApp = oauthutil.setupApp;

var DANGEROUS = "This is a <script>alert('Boo!')</script> dangerous string.";

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

var suite = vows.describe("user inbox API");

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
        "and we register a new user": {
            topic: function() {
                newCredentials("bunny", "eggs*eggs*eggs", this.callback);
            },
            "it works": function(err, cred) {
                assert.ifError(err);
                assert.isObject(cred);
            },
            "and we post an activity to the inbox with dangerous content": {

                topic: function() {
                    var callback = this.callback;

                    Step(
                        function() {
                            assoc("user4@social.localhost", "VALID1", Date.now(), this);
                        },
                        function(err, cl) {

                            if (err) throw err;

                            var url = "http://localhost:4815/api/user/bunny/inbox",
                                act = {
                                    actor: {
                                        id: "acct:user4@social.localhost",
                                        objectType: "person"
                                    },
                                    content: DANGEROUS,
                                    to: [{objectType: "collection",
                                          id: "http://social.localhost/user/user4/followers"
                                         }],
                                    id: "http://social.localhost/activity/6",
                                    verb: "post",
                                    object: {
                                        id: "http://social.localhost/note/4",
                                        objectType: "note",
                                        content: DANGEROUS
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
                },
                "dangerous stuff is defanged": function(err, act, resp) {
                    assert.ifError(err);
                    assert.isObject(act);
                    assert.equal(act.content.indexOf("<script>"), -1);
                    assert.equal(act.object.content.indexOf("<script>"), -1);
                }
            },
            "and we post an activity to the inbox with internal private members": {

                topic: function() {
                    var callback = this.callback;

                    Step(
                        function() {
                            assoc("user5@social.localhost", "VALID1", Date.now(), this);
                        },
                        function(err, cl) {

                            if (err) throw err;

                            var url = "http://localhost:4815/api/user/bunny/inbox",
                                act = {
                                    _uuid: "AFAKEUUID",
                                    actor: {
                                        id: "acct:user5@social.localhost",
                                        _user: true,
                                        objectType: "person"
                                    },
                                    to: [{objectType: "collection",
                                          id: "http://social.localhost/user/user5/followers"
                                         }],
                                    id: "http://social.localhost/activity/7",
                                    verb: "post",
                                    object: {
                                        id: "http://social.localhost/note/5",
                                        objectType: "note",
                                        _uuid: "IMADETHISUP"
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
                },
                "private stuff is ignored": function(err, act, resp) {
                    assert.ifError(err);
                    assert.isObject(act);
                    assert.isFalse(_.has(act, "_uuid"));
                    assert.include(act, "actor");
                    assert.isObject(act.actor);
                    assert.isFalse(_.has(act.actor, "_user"));
                    assert.include(act, "object");
                    assert.isObject(act.object);
                    assert.isFalse(_.has(act.object, "_user"));
                }
            }
        }
    }
});

suite["export"](module);
