// authorizationcode-test.js
//
// Test that the AuthorizationCode class works as expected
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
var REDIRECT_URI = "http://localhost:2112/idunno/something";

vows.describe("AuthorizationCode data type")
    .addBatch({
        "When we load the module": {
            topic: function() {
                try {
                    var mod = require("../lib/model/authorizationcode");
                    var AuthorizationCode = mod.AuthorizationCode;
                    this.callback(null, AuthorizationCode);
                } catch (err) {
                    this.callback(err);
                }
                return undefined;
            },
            "it works": function(err, AuthorizationCode) {
                assert.ifError(err);
                assert.isFunction(AuthorizationCode);
            },
            "it has a create() method": function(err, AuthorizationCode) {
                assert.ifError(err);
                assert.isFunction(AuthorizationCode);
                assert.isFunction(AuthorizationCode.create);
            },
            "it has a get() method": function(err, AuthorizationCode) {
                assert.ifError(err);
                assert.isFunction(AuthorizationCode);
                assert.isFunction(AuthorizationCode.get);
            },
            "and we open a database": {
                topic: function(AuthorizationCode) {
                    var callback = this.callback;
                    var schema = {};
                    schema[AuthorizationCode.type] = AuthorizationCode.schema;
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
                "and we create a new code": {
                    topic: function(bank, AuthorizationCode) {
                        var props = {
                            "nickname": user.nickname,
                            "client_id": client.client_id,
                            "redirect_uri": REDIRECT_URI
                        };
                        AuthorizationCode.create(props, this.callback);
                    },
                    "it works": function(err, ac) {
                        assert.ifError(err);
                        assert.isObject(ac);
                        assert.isString(ac.code);
                        assert.isString(ac.created);
                        assert.equal(ac.nickname, user.nickname);
                        assert.equal(ac.client_id, client.client_id);
                        assert.equal(ac.redirect_uri, REDIRECT_URI);
                    },
                    "and we get the same code out": {
                        topic: function(created, bank, AuthorizationCode) {
                            var callback = this.callback;
                            AuthorizationCode.get(created.code, function(err, gotten) {
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
                            assert.equal(gotten.code, created.code);
                            assert.isString(gotten.created);
                            assert.equal(gotten.nickname, user.nickname);
                            assert.equal(gotten.client_id, client.client_id);
                            assert.equal(gotten.redirect_uri, REDIRECT_URI);
                        }
                    }
                }
            }
        }
    })
    .export(module);
