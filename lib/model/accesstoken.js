// accesstoken.js
//
// An OAuth request token
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

"use strict";

var databank = require("databank"),
    _ = require("lodash"),
    DatabankObject = databank.DatabankObject,
    Stamper = require("../stamper").Stamper,
    Step = require("step"),
    randomString = require("../randomstring").randomString,
    NoSuchThingError = databank.NoSuchThingError;

var AccessToken = DatabankObject.subClass("accesstoken");

AccessToken.schema = {
    pkey: "access_token",
    fields: ["token_secret",
             "consumer_key",
             "request_token",
             "username",
             "created",
             "updated"],
    indices: ["username", "consumer_key", "request_token"]
};

exports.AccessToken = AccessToken;

AccessToken.pkey = function() {
    return "access_token";
};

AccessToken.beforeCreate = function(properties, callback) {

    if (!_(properties).has("consumer_key")) {
        callback(new Error("Gotta have a consumer key."), null);
        return;
    }


    if (!_(properties).has("username")) {
        callback(new Error("Gotta have a username."), null);
        return;
    }

    var now = Stamper.stamp();
    _.assign(properties, {created: now, updated: now});

    if (properties.access_token && properties.token_secret) {
        callback(null, properties);
    } else {
        Step(
            function() {
                randomString(16, this.parallel());
                randomString(32, this.parallel());
            },
            function(err, token, token_secret) {
                if (err) {
                    callback(err, null);
                } else {
                    _.assign(properties, {
                        access_token: token,
                        token_secret: token_secret
                    });

                    callback(null, properties);
                }
            }
        );
    }
};

AccessToken.prototype.beforeUpdate = function(properties, callback) {
    properties.updated = Stamper.stamp();
    callback(null, properties);
};
