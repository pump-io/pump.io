// Dialback client test
//
// Copyright 2012 StatusNet Inc.
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

var vows = require("vows"),
    assert = require("assert"),
    fs = require("fs"),
    path = require("path"),
    databank = require("databank"),
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var suite = vows.describe("DialbackClient module interface");

suite.addBatch({
    "When we connect a database": {
        topic: function() {
            var cb = this.callback,
                db = Databank.get(tc.driver, tc.params);
            db.connect({}, function(err) {
                if (err) {
                    cb(err, null);
                } else {
                    DatabankObject.bank = db;
                    cb(null, db);
                }
            });
        },
        "it works": function(err, db) {
            assert.ifError(err);
        },
        teardown: function(db) {
            if (db && db.close) {
                db.close(function(err) {});
            }
        },
        "and we require the DialbackClient module": {
            topic: function() {
                return require("../lib/dialbackclient");
            },
            "it works": function(DialbackClient) {
                assert.isObject(DialbackClient);
            },
            "it has a post() method": function(DialbackClient) {
                assert.isFunction(DialbackClient.post);
            },
            "it has a remember() method": function(DialbackClient) {
                assert.isFunction(DialbackClient.remember);
            },
            "it has an isRemembered() method": function(DialbackClient) {
                assert.isFunction(DialbackClient.isRemembered);
            },
            "and we tell it to remember a request": {
                topic: function(DialbackClient) {
                    DialbackClient.remember("http://social.example/inbox",
                                            "acct:user@photo.example",
                                            1347843277595,
                                            "_Yh3Fzf4mD4",
                                            this.callback);
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we check if the same values were remembered": {
                    topic: function(DialbackClient) {
                        DialbackClient.isRemembered("http://social.example/inbox",
                                                    "acct:user@photo.example",
                                                    1347843277595,
                                                    "_Yh3Fzf4mD4",
                                                    this.callback);
                    },
                    "it works": function(err, res) {
                        assert.ifError(err);
                        assert.isTrue(res);
                    }
                },
                "and we check if other values were remembered": {
                    topic: function(DialbackClient) {
                        DialbackClient.isRemembered("https://other.example/endpoint",
                                                    "acct:user2@another.example",
                                                    1347843277589,
                                                    "6lTDQzU-jWU",
                                                    this.callback);
                    },
                    "it returns false": function(err, res) {
                        assert.ifError(err);
                        assert.isFalse(res);
                    }
                }
            }
        }
    }
});

suite["export"](module);
