// lib/model/bearertoken.js
//
// bearer tokens for OAuth 2.0
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
    randomString = require("../randomstring").randomString;

var BearerToken = DatabankObject.subClass("bearertoken");

BearerToken.schema = {
    "pkey": "token",
    "fields": [
        "nickname",
        "client_id",
        "scope",
        "created"
    ]
};

BearerToken.beforeCreate = function(props, callback) {
    if (!props.client_id) {
        return callback(new Error("No client ID"));
    }
    props.created = Stamper.stamp();
    Step(
        function() {
            randomString(32, this);
        },
        function(err, token) {
            if (err) throw err;
            props.token = token;
            this(null, props);
        },
        callback
    );
};

BearerToken.prototype.beforeUpdate = function(props, callback) {
    callback(new Error("Immutable object"));
};

BearerToken.prototype.beforeSave = function(callback) {
    callback(new Error("Immutable object; use create() instead"));
};

exports.BearerToken = BearerToken;
