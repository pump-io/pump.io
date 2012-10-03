// credentials-test.js
//
// Test the credentials module
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
    databank = require("databank"),
    Step = require("step"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("dialbackclientrequest module interface");

var testSchema = {
    pkey: "endpoint_id_token_timestamp",
    fields: ["endpoint",
             "id",
             "token",
             "timestamp"]
};

var testData = {
    "create": {
        endpoint: "social.example/register",
        id: "acct:user@comment.example",
        token: "AAAAAA",
        timestamp: Date.now()
    }
};

var mb = modelBatch("dialbackclientrequest",
                    "DialbackClientRequest",
                    testSchema,
                    testData);

delete mb["When we require the dialbackclientrequest module"]
["and we get its DialbackClientRequest class export"]
["and we create a dialbackclientrequest instance"]
["auto-generated fields are there"];

delete mb["When we require the dialbackclientrequest module"]
["and we get its DialbackClientRequest class export"]
["and we create a dialbackclientrequest instance"]
["and we modify it"];

suite.addBatch(mb);

suite.addBatch({
    "When we get the class": {
        topic: function() {
            return require("../lib/model/dialbackclientrequest").DialbackClientRequest;
        },
        "it works": function(DialbackClientRequest) {
            assert.isFunction(DialbackClientRequest);
        },
        "it has a cleanup() method": function(DialbackClientRequest) {
            assert.isFunction(DialbackClientRequest.cleanup);
        },
        "and we create a lot of requests": {
            topic: function(DialbackClientRequest) {
                var cb = this.callback;

                Step(
                    function() {
                        var i, group = this.group(), ts = Date.now() - (24 * 60 * 60 * 1000);

                        for (i = 0; i < 100; i++) {
                            DialbackClientRequest.create({
                                endpoint: "social.example/register",
                                id: "acct:user@comment.example",
                                token: "OLDTOKEN"+i,
                                timestamp: ts
                            }, group());
                        }
                    },
                    function(err, reqs) {
                        if (err) throw err;

                        var i, group = this.group(), ts = Date.now();

                        for (i = 0; i < 100; i++) {
                            DialbackClientRequest.create({
                                endpoint: "social.example/register",
                                id: "acct:user@comment.example",
                                token: "RECENT"+i,
                                timestamp: ts
                            }, group());
                        }
                    },
                    function(err, reqs) {
                        if (err) {
                            cb(err);
                        } else {
                            cb(null);
                        }
                    }
                );
            },
            "it works": function(err) {
                assert.ifError(err);
            },
            "and we try to cleanup": {
                topic: function(DialbackClientRequest) {
                    DialbackClientRequest.cleanup(this.callback);
                },
                "it works": function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite["export"](module);
