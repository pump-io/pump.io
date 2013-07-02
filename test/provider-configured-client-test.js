// provider-test.js
//
// Test the provider module
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
    _ = require("underscore"),
    fs = require("fs"),
    path = require("path"),
    schema = require("../lib/schema"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    randomString = require("../lib/randomstring").randomString,
    Client = require("../lib/model/client").Client,
    RequestToken = require("../lib/model/requesttoken").RequestToken,
    AccessToken = require("../lib/model/accesstoken").AccessToken,
    User = require("../lib/model/user").User,
    methodContext = require("./lib/methods").methodContext,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

vows.describe("provider module interface").addBatch({

    "When we get the provider module": {

        topic: function() {
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {

                var mod = require("../lib/provider");

                DatabankObject.bank = db;

                cb(null, mod);
            });
        },
        "there is one": function(err, mod) {
            assert.isObject(mod);
        },
        "and we get its Provider export": {
            topic: function(mod) {
                return mod.Provider;
            },
            "it exists": function(Provider) {
                assert.isFunction(Provider);
            },
            "and we create a new Provider with predefined keys": {
                topic: function(Provider) {
		    var clients = [{
			client_id: "AAAAAAAAAA",
			client_secret: "BBBBBBBBBB"
		    }];
                    return new Provider(null, clients);
                },
                "it exists": function(provider) {
                    assert.isObject(provider);
                },
                "and we use applicationByConsumerKey() on a bogus key": {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.applicationByConsumerKey("BOGUSCONSUMERKEY", function(err, result) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Got unexpected results"));
                            }
                        });
                    },
                    "it fails correctly": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we use applicationByConsumerKey() on a valid key": {
                    topic: function(provider) {
			var callback = this.callback;
			Step(
			    function() {
				Client.create({title: "Test App", description: "App for testing"}, this);
			    },
			    function(err, client) {
				if (err) throw err;
				provider.applicationByConsumerKey(client.consumer_key, this);
			    },
			    callback
			);
		    },
                    "it works": function(err, client) {
                        assert.ifError(err);
                        assert.isObject(client);
                        assert.instanceOf(client, Client);
                    },
                    "it has the right fields": function(err, client) {
                        assert.isString(client.consumer_key);
                        assert.isString(client.secret);
                    }
                },
                "and we use applicationByConsumerKey() on a configured key": {
                    topic: function(provider) {
			var callback = this.callback;
			provider.applicationByConsumerKey("AAAAAAAAAA", callback);
		    },
                    "it works": function(err, client) {
                        assert.ifError(err);
                        assert.isObject(client);
                    },
                    "it has the right fields": function(err, client) {
                        assert.ifError(err);
                        assert.isString(client.consumer_key);
                        assert.isString(client.secret);
                    }
                }
	    }
        }
    }
})["export"](module);
