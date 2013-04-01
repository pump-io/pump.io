// host-test.js
//
// Test the host module
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
    databank = require("databank"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("host module interface");

var testSchema = {
    pkey: "hostname",
    fields: ["registration_endpoint",
             "request_token_endpoint",
             "access_token_endpoint",
             "authorization_endpoint",
             "whoami_endpoint",
             "created",
             "updated"]
};

var testData = {
    "create": {
        "hostname": "social.localhost",
        "registration_endpoint": "https://social.localhost/api/registration",
        "request_token_endpoint": "https://social.localhost/api/request_token",
        "access_token_endpoint": "https://social.localhost/api/access_token",
        "authorization_endpoint": "https://social.localhost/api/authorization",
        "whoami_endpoint": "https://social.localhost/api/whoami"
    },
    "update": {
        timestamp: 1337801765
    }
};

var mb = modelBatch("host", "Host", testSchema, testData);

mb["When we require the host module"]
["and we get its Host class export"]
["and we create a host instance"]
["auto-generated fields are there"] = function(err, created) {
    assert.ifError(err);
    assert.include(created, "created");
    assert.include(created, "modified");
};

mb["When we require the host module"]
["and we get its Host class export"]
["and we create a host instance"]
["and we modify it"]
["it is modified"] = function(err, updated) {
    assert.ifError(err);
    assert.include(updated, "created");
    assert.include(updated, "modified");
    assert.notEqual(updated.created, updated.modified);
};

suite.addBatch(mb);

suite.addBatch({
    "When we get the Host class": {
        topic: function() {
            return require("../lib/model/host").Host;
        },
        "it works": function(Host) {
            assert.isFunction(Host);
        },
        "and we check its class methods": {
            topic: function(Host) {
                return Host;
            },
            "it has an ensureHost method": function(Host) {
                assert.isFunction(Host.ensureHost);
            }
        },
        "and we make an instance": {
            topic: function(Host) {
                return new Host({hostname: "simple.example"});
            },
            "it works": function(host) {
                assert.isObject(host);
            },
            "and we check its methods": {
                topic: function(host) {
                    return host;
                },
                "it has a getRequestToken() method": function(host) {
                    assert.isFunction(host.getRequestToken);
                },
                "it has an authorizeURL() method": function(host) {
                    assert.isFunction(host.authorizeURL);
                },
                "it has a getAccessToken() method": function(host) {
                    assert.isFunction(host.getAccessToken);
                },
                "it has a whoami() method": function(host) {
                    assert.isFunction(host.whoami);
                }
            }
        }
    }
});

suite["export"](module);
