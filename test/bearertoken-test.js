// bearertoken-test.js
//
// Test that the BearerToken class works as expected
//
// Copyright 2018 E14N <https://e14n.com>
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
var databank = require("databank");
var Databank = databank.Databank;
var DatabankObject = databank.DatabankObject;
var _ = require("lodash");

var tc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "config.json")));
var client = tc.clients[0];
var user = tc.users[2];
var SCOPE = "read";

vows.describe("BearerToken data type")
    .addBatch({
        "When we load the module": {
            topic: function() {
                try {
                    var mod = require("../lib/model/bearertoken");
                    var BearerToken = mod.BearerToken;
                    this.callback(null, BearerToken);
                } catch (err) {
                    this.callback(err);
                }
                return undefined;
            },
            "it works": function(err, BearerToken) {
                assert.ifError(err);
                assert.isFunction(BearerToken);
            },
            "it has a create() method": function(err, BearerToken) {
                assert.ifError(err);
                assert.isFunction(BearerToken);
                assert.isFunction(BearerToken.create);
            },
            "it has a get() method": function(err, BearerToken) {
                assert.ifError(err);
                assert.isFunction(BearerToken);
                assert.isFunction(BearerToken.get);
            },
            "it has a save() method": function(err, BearerToken) {
                assert.ifError(err);
                assert.isFunction(BearerToken);
                assert.isFunction(BearerToken.prototype.save);
            },
            "and we open a database": {
                topic: function(BearerToken) {
                    var callback = this.callback;
                    var schema = {};
                    schema[BearerToken.type] = BearerToken.schema;
                    var params = _.extend({schema: schema}, tc.params);
                    var bank = Databank.get(tc.driver, params);
                    bank.connect(params, function(err) {
                        if (err) {
                            callback(err);
                        } else {
                            DatabankObject.bank = bank;
                            callback(null, bank);
                        }
                    });
                },
                "it works": function(err, bank) {
                    assert.ifError(err);
                    assert.isObject(bank);
                },
                "teardown": function(bank) {
                    bank.disconnect(this.callback);
                },
                "and we create a new user token": {
                    topic: function(bank, BearerToken) {
                        var props = {
                            "nickname": user.nickname,
                            "client_id": client.client_id,
                            "scope": SCOPE
                        };
                        BearerToken.create(props, this.callback);
                    },
                    "it works": function(err, bt) {
                        assert.ifError(err);
                        assert.isObject(bt);
                        assert.isString(bt.token);
                        assert.isString(bt.created);
                        assert.equal(bt.nickname, user.nickname);
                        assert.equal(bt.client_id, client.client_id);
                        assert.equal(bt.scope, SCOPE);
                    },
                    "and we get the same token out": {
                        topic: function(created, bank, BearerToken) {
                            var callback = this.callback;
                            BearerToken.get(created.token, function(err, gotten) {
                                if (err) {
                                    callback(err);
                                } else {
                                    callback(null, gotten, created);
                                }
                            });
                        },
                        "it works": function(err, gotten, created) {
                            assert.ifError(err);
                            assert.isObject(gotten);
                            assert.isObject(created);
                            assert.equal(gotten.token, created.token);
                            assert.isString(gotten.created);
                            assert.equal(gotten.nickname, user.nickname);
                            assert.equal(gotten.client_id, client.client_id);
                            assert.equal(gotten.scope, SCOPE);
                        }
                    }
                },
                "and we create a new client token": {
                    topic: function(bank, BearerToken) {
                        var props = {
                            "client_id": client.client_id
                        };
                        BearerToken.create(props, this.callback);
                    },
                    "it works": function(err, bt) {
                        assert.ifError(err);
                        assert.isObject(bt);
                        assert.isString(bt.token);
                        assert.isString(bt.created);
                        assert.ok(!bt.nickname);
                        assert.equal(bt.client_id, client.client_id);
                        assert.ok(!bt.scope);
                    },
                    "and we get the same token out": {
                        topic: function(created, bank, BearerToken) {
                            var callback = this.callback;
                            BearerToken.get(created.token, function(err, gotten) {
                                if (err) {
                                    callback(err);
                                } else {
                                    callback(null, gotten, created);
                                }
                            });
                        },
                        "it works": function(err, gotten, created) {
                            assert.ifError(err);
                            assert.isObject(gotten);
                            assert.isObject(created);
                            assert.equal(gotten.token, created.token);
                            assert.isString(gotten.created);
                            assert.ok(!gotten.nickname);
                            assert.equal(gotten.client_id, client.client_id);
                            assert.ok(!gotten.scope);
                        }
                    }
                },
                "and we create a defined user token": {
                    topic: function(bank, BearerToken) {
                        var props = {
                            "token": "UNITTESTBEARERTOKEN1",
                            "nickname": user.nickname,
                            "client_id": client.client_id,
                            "scope": SCOPE
                        };
                        BearerToken.create(props, this.callback);
                        return undefined;
                    },
                    "it works": function(err, bt) {
                        assert.ifError(err);
                        assert.isObject(bt);
                        assert.isString(bt.created);
                        assert.equal(bt.token, "UNITTESTBEARERTOKEN1");
                    },
                    "and we get the same token out": {
                        topic: function(created, bank, BearerToken) {
                            var callback = this.callback;
                            BearerToken.get(created.token, function(err, gotten) {
                                if (err) {
                                    callback(err);
                                } else {
                                    callback(null, gotten, created);
                                }
                            });
                        },
                        "it works": function(err, gotten, created) {
                            assert.ifError(err);
                            assert.isObject(gotten);
                            assert.isObject(created);
                            assert.equal(gotten.token, created.token);
                            assert.isString(gotten.created);
                            assert.equal(gotten.nickname, created.nickname);
                            assert.equal(gotten.client_id, client.client_id);
                            assert.equal(gotten.scope, created.scope);
                        }
                    }
                }
            }
        }
    })
    .export(module);
