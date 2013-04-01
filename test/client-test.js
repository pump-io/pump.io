// client-test.js
//
// Test the client module
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
    Step = require("step"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("client module interface");

var testSchema = {
    pkey: "consumer_key",
    fields: ["title",
             "description",
             "host",
             "webfinger",
             "secret",
             "contacts",
             "logo_url",
             "redirect_uris",
             "type",
             "created",
             "updated"],
    indices: ["host", "webfinger"]
};

var testData = {
    "create": {
        title: "MyApp",
        description: "an app I made",
        identity: "example.com",
        contacts: ["evan@example.com"],
        type: "web"
    },
    "update": {
        contacts: ["evan@example.com", "jerry@example.com"]
    }
};

var mb = modelBatch("client", "Client", testSchema, testData);

mb["When we require the client module"]
  ["and we get its Client class export"]
  ["and we create a client instance"]
  ["auto-generated fields are there"] = function(err, created) {
      assert.isString(created.consumer_key);
      assert.isString(created.secret);
      assert.isString(created.created);
      assert.isString(created.updated);
};

suite.addBatch(mb);

suite.addBatch({
    "When we get the Client class": {
        topic: function() {
            return require("../lib/model/client").Client;
        },
        "it works": function(Client) {
            assert.isFunction(Client);
        },
        "and we create a client with a 'host' property": {
            topic: function(Client) {
                Client.create({host: "photo.example"}, this.callback);
            },
            "it works": function(err, client) {
                assert.ifError(err);
                assert.isObject(client);
            },
            "and we get its activity object": {
                topic: function(client) {
                    client.asActivityObject(this.callback);
                },
                "it is a service": function(err, obj) {
                    assert.ifError(err);
                    assert.isObject(obj);
                    assert.include(obj, "objectType");
                    assert.equal(obj.objectType, "service");
                },
                "it has the host as ID": function(err, obj) {
                    assert.ifError(err);
                    assert.isObject(obj);
                    assert.include(obj, "id");
                    assert.equal(obj.id, "http://photo.example/");
                }
            }
        },
        "and we create a client with a 'webfinger' property": {
            topic: function(Client) {
                Client.create({webfinger: "alice@geographic.example"}, this.callback);
            },
            "it works": function(err, client) {
                assert.ifError(err);
                assert.isObject(client);
            },
            "and we get its activity object": {
                topic: function(client) {
                    client.asActivityObject(this.callback);
                },
                "it is a person": function(err, obj) {
                    assert.ifError(err);
                    assert.isObject(obj);
                    assert.include(obj, "objectType");
                    assert.equal(obj.objectType, "person");
                },
                "it has the webfinger as ID": function(err, obj) {
                    assert.ifError(err);
                    assert.isObject(obj);
                    assert.include(obj, "id");
                    assert.equal(obj.id, "acct:alice@geographic.example");
                }
            }
        },
        "and we create a client with both 'host' and 'webfinger'": {
            topic: function(Client) {
                var callback = this.callback;
                Client.create({host: "music.example", webfinger: "bob@music.example"}, function(err, client) {
                    if (err) {
                        callback(null);
                    } else {
                        callback(new Error("Unexpected success"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we create a client with neither 'host' nor 'webfinger'": {
            topic: function(Client) {
                Client.create({title: "My program"}, this.callback);
            },
            "it works": function(err, client) {
                assert.ifError(err);
                assert.isObject(client);
            },
            "and we get its activity object": {
                topic: function(client) {
                    client.asActivityObject(this.callback);
                },
                "it is an application": function(err, obj) {
                    assert.ifError(err);
                    assert.isObject(obj);
                    assert.include(obj, "objectType");
                    assert.equal(obj.objectType, "application");
                }
            }
        },
        "and we create two clients with the same 'host'": {
            topic: function(Client) {
                var callback = this.callback,
                    client1,
                    client2;

                Step(
                    function() {
                        Client.create({host: "video.example"}, this);
                    },
                    function(err, client) {
                        if (err) throw err;
                        client1 = client;
                        Client.create({host: "video.example"}, this);
                    },
                    function(err, client) {
                        if (err) {
                            callback(err, null, null);
                        } else {
                            client2 = client;
                            callback(err, client1, client2);
                        }
                    }
                );
            },
            "it works": function(err, client1, client2) {
                assert.ifError(err);
            },
            "they are distinct": function(err, client1, client2) {
                assert.ifError(err);
                assert.isObject(client1);
                assert.isObject(client2);
                assert.notEqual(client1.consumer_key, client2.consumer_key);
            }
        },
        "and we create two clients with the same 'webfinger'": {
            topic: function(Client) {
                var callback = this.callback,
                    client1,
                    client2;

                Step(
                    function() {
                        Client.create({webfinger: "charlie@blog.example"}, this);
                    },
                    function(err, client) {
                        if (err) throw err;
                        client1 = client;
                        Client.create({webfinger: "charlie@blog.example"}, this);
                    },
                    function(err, client) {
                        if (err) {
                            callback(err, null, null);
                        } else {
                            client2 = client;
                            callback(err, client1, client2);
                        }
                    }
                );
            },
            "it works": function(err, client1, client2) {
                assert.ifError(err);
            },
            "they are distinct": function(err, client1, client2) {
                assert.ifError(err);
                assert.isObject(client1);
                assert.isObject(client2);
                assert.notEqual(client1.consumer_key, client2.consumer_key);
            }
        }
    }
});

suite["export"](module);
