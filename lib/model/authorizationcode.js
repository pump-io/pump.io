// lib/model/authorizationcode.js
//
// authorization codes for OAuth 2.0 authorization flow
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

var AuthorizationCode = DatabankObject.subClass("authorizationcode");

AuthorizationCode.schema = {
    "pkey": "code",
    "fields": [
        "nickname",
        "client_id",
        "redirect_uri",
        "created"
    ]
};

AuthorizationCode.beforeCreate = function(props, callback) {
    if (!props.nickname) {
        return callback(new Error("No nickname"));
    }
    if (!props.client_id) {
        return callback(new Error("No client ID"));
    }
    if (!props.redirect_uri) {
        return callback(new Error("No redirect URI"));
    }
    props.created = Stamper.stamp();
    Step(
        function() {
            randomString(32, this);
        },
        function(err, code) {
            if (err) throw err;
            props.code = code;
            this(null, props);
        },
        callback
    );
};

AuthorizationCode.prototype.beforeUpdate = function(props, callback) {
    callback(new Error("Immutable object"));
};

AuthorizationCode.prototype.beforeSave = function(callback) {
    callback(new Error("Immutable object; use create() instead"));
};

exports.AuthorizationCode = AuthorizationCode;
