// authc-oauth2-unit-test.js
//
// Copyright 2018, E14N https://e14n.com/
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

"use strict";

var fs = require("fs");
var path = require("path");
var vows = require("vows");
var assert = require("assert");
var Step = require("step");
var _ = require("lodash");
var db = require("databank");
var authc = require("../lib/authc");
var User = require("../lib/model/user").User;
var Client = require("../lib/model/client").Client;
var BearerToken = require("../lib/model/bearertoken").BearerToken;
var URLMaker = require("../lib/urlmaker").URLMaker;

var Databank = db.Databank;
var DatabankObject = db.DatabankObject;

var tc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "config.json")));

var user = tc.users[0];
var client = tc.clients[0];

var fakeReq = function(authz) {
    return {
        url: "/madeup",
        headers: {
            "authorization": authz
        },
        principal: null,
        principalUser: null
    };
};

var fakeRes = function() {
    return {
        url: "/madeup",
        locals: {}
    };
};

var invert = function(callback) {
    return function(err) {
        if (!err) {
            callback(new Error("Unexpected success"));
        } else {
            callback(null);
        }
    };
};

vows.describe("Bearer token authorization")
    .addBatch({
        "When we set up the DB": {
            topic: function() {
                var db = null;
                URLMaker.hostname = "localhost";
                URLMaker.port = 4815;
                Step(
                    function() {
                        var schema = {};
                        schema[User.type] = User.schema;
                        schema[Client.type] = Client.schema;
                        schema[BearerToken.type] = BearerToken.schema;
                        var params = _.extend({schema: schema}, tc.params);
                        db = Databank.get(tc.driver, params);
                        db.connect(params, this);
                    },
                    function(err) {
                        if (err) throw err;
                        DatabankObject.bank = db;
                        User.create(user, this.parallel());
                        Client.create({
                            consumer_key: client.client_id,
                            secret: client.client_secret,
                            title: client.title,
                            description: client.description,
                            host: client.host
                        }, this.parallel());
                    },
                    function(err) {
                        if (err) throw err;
                        this(null);
                    },
                    this.callback
                );
                return undefined;
            },
            "it works": function(err) {
                assert.ifError(err);
            },
            "and we authenticate with a valid user bearer token": {
                topic: function() {
                    var callback = this.callback;
                    Step(
                        function() {
                            BearerToken.create({
                                nickname: user.nickname,
                                client_id: client.client_id,
                                scope: "read"
                            }, this);
                        },
                        function(err, bt) {
                            if (err) throw err;
                            var callback = this;
                            var req = fakeReq("Bearer " + bt.token);
                            var res = fakeRes();
                            authc.oauth2(req, res, function(err) {
                                callback(err, req, res);
                            });
                        },
                        this.callback
                    );
                },
                "it works": function(err, req, res) {
                    assert.ifError(err);
                    assert.isObject(req);
                },
                "the req properties are set": function(err, req, res) {
                    assert.ifError(err);
                    assert.isObject(req);
                    assert.isObject(req.client);
                    assert.isObject(req.principal);
                    assert.isObject(req.principalUser);
                },
                "the res properties are set": function(err, req, res) {
                    assert.ifError(err);
                    assert.isObject(res);
                    assert.isObject(res.locals);
                    assert.isObject(res.locals.client);
                    assert.isObject(res.locals.principal);
                    assert.isObject(res.locals.principalUser);
                }
            },
            "and we authenticate with a valid client bearer token": {
                topic: function() {
                    var callback = this.callback;
                    Step(
                        function() {
                            BearerToken.create({
                                client_id: client.client_id
                            }, this);
                        },
                        function(err, bt) {
                            if (err) throw err;
                            var callback = this;
                            var req = fakeReq("Bearer " + bt.token);
                            var res = fakeRes();
                            authc.oauth2(req, res, function(err) {
                                callback(err, req, res);
                            });
                        },
                        this.callback
                    );
                },
                "it works": function(err, req, res) {
                    assert.ifError(err);
                    assert.isObject(req);
                },
                "the req properties are set": function(err, req, res) {
                    assert.ifError(err);
                    assert.isObject(req);
                    assert.isObject(req.client);
                    assert.isObject(req.principal);
                    assert.ok(!req.principalUser);
                },
                "the res properties are set": function(err, req, res) {
                    assert.ifError(err);
                    assert.isObject(res);
                    assert.isObject(res.locals);
                    assert.isObject(res.locals.client);
                    assert.isObject(res.locals.principal);
                    assert.ok(!res.locals.principalUser);
                }
            },
            "and we authenticate with no bearer token": {
                topic: function() {
                    var req = fakeReq();
                    var res = fakeRes();
                    authc.oauth2(req, res, invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we authenticate with an invalid bearer token": {
                topic: function() {
                    var callback = this.callback;
                    var req = fakeReq("Bearer NOTAVALIDTOKEN");
                    var res = fakeRes();
                    authc.oauth2(req, res, invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we authenticate with a different kind of authorization": {
                topic: function() {
                    var callback = this.callback;
                    var req = fakeReq("Basic dXNlcm5hbWU6cGFzc3dvcmQ=");
                    var res = fakeRes();
                    authc.oauth2(req, res, invert(this.callback));
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            }
        }
    })
    .export(module);
