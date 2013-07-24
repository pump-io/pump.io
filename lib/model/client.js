// Client for pump.io
//
// Copyright 2012 E14N https://e14n.com/
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
    uuidv5 = require("../uuidv5"),
    DatabankObject = databank.DatabankObject,
    NoSuchThingError = databank.NoSuchThingError;

var Client = DatabankObject.subClass("client");

Client.schema = {
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

Client.keyPair = function(callback) {
    randomString(16, function(err, consumer_key) {
        if (err) {
            callback(err, null);
        } else {
            randomString(32, function(err, secret) {
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

// For creating

Client.beforeCreate = function(properties, callback) {

    var now = Stamper.stamp();

    properties.created = properties.updated = now;

    if (_(properties).has("host") && _(properties).has("webfinger")) {
        callback(new Error("can't have both a 'host' and 'webfinger' property"), null);
        return;
    }

    if (properties.consumer_key) {
        callback(null, properties);
    } else {
        Client.keyPair(function(err, pair) {
            if (err) {
                callback(err, null);
            } else {
                properties.consumer_key = pair.consumer_key;
                properties.secret       = pair.secret;

                callback(null, properties);
            }
        });
    }
};

Client.prototype.beforeUpdate = function(newClient, callback) {

    var now = Stamper.stamp();

    newClient.updated      = now;
    newClient.created      = this.created;
    newClient.consumer_key = this.consumer_key;
    newClient.secret       = this.secret;
    newClient.owner        = this.owner;

    callback(null, newClient);
};

Client.prototype.asActivityObject = function(callback) {

    var client = this,
        ActivityObject = require("./activityobject").ActivityObject,
        props = {};

    props._consumer_key = client.consumer_key;

    if (client.title) {
        props.displayName = client.title;
    }

    if (client.description) {
        props.content = client.description;
    }

    if (client.webfinger) {
        props.id = ActivityObject.canonicalID(client.webfinger);
        props.objectType = ActivityObject.PERSON;
    } else if (client.host) {
        props.url = "http://"+client.host+"/";
        props.id = props.url; // XXX: ???
        props.objectType = ActivityObject.SERVICE;
    } else {
        // Not sure why this wouldn't be a string, but... OK.
        if (_.isString(client.consumer_key)) {
	    props.id = "urn:uuid:"+uuidv5(client.consumer_key);
        }
        switch (client.type) {
        case "web":
            props.objectType = ActivityObject.SERVICE;
            break;
        case "native":
        default:
            props.objectType = ActivityObject.APPLICATION;
            break;
        }
    }

    ActivityObject.ensureObject(props, callback);
};

exports.Client = Client;
