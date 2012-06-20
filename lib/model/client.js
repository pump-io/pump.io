// Client for ActivityPump
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

var databank = require("databank"),
    Stamper = require("../stamper").Stamper,
    crypto  = require("crypto"),
    _ = require("underscore"),
    randomString = require("../randomstring").randomString,
    DatabankObject = databank.DatabankObject,
    NoSuchThingError = databank.NoSuchThingError;

var Client = DatabankObject.subClass("client");

Client.schema = {
    pkey: "consumer_key",
    fields: ["title",
             "description",
             "host",
             "secret",
             "contacts",
             "logo_url",
             "redirect_uris",
             "type",
             "created",
             "updated"],
    indices: ["title"]
};

Client.keyPair = function(callback) {
    var provider = this;
    provider.randomString(16, function(err, consumer_key) {
        if (err) {
            callback(err, null);
        } else {
            provider.randomString(32, function(err, secret) {
                if (err) {
                    callback(err, null); 
                } else {
                    callback(null, {consumer_key: consumer_key,
                                    secret: secret});
                }
            });
        }
    });
};

Client.randomString = function(bytes, callback) {
    randomString(bytes, callback);
};

// For creating

Client.defaultCreate = Client.create;

Client.create = function(properties, callback) {

    var now = Stamper.stamp();

    properties.created = properties.updated = now;

    if (properties.consumer_key) {
        Client.defaultCreate(properties, callback);
    } else {
        Client.keyPair(function(err, pair) {
            if (err) {
                callback(err, null);
            } else {
                properties.consumer_key = pair.consumer_key;
                properties.secret       = pair.secret;

                Client.defaultCreate(properties, callback);
            }
        });
    }
};

Client.prototype.defaultUpdate = Client.prototype.update;

Client.prototype.update = function(newClient, callback) {

    var now = Stamper.stamp();

    newClient.updated      = now;
    newClient.created      = this.created;
    newClient.consumer_key = this.consumer_key;
    newClient.secret       = this.secret;
    newClient.owner        = this.owner;

    this.defaultUpdate(newClient, callback);
};

exports.Client = Client;
