// confirmation.js
//
// Random code for confirming an email address
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

var databank = require("databank"),
    _ = require("underscore"),
    DatabankObject = databank.DatabankObject,
    Step = require("step"),
    randomString = require("../randomstring").randomString,
    NoSuchThingError = databank.NoSuchThingError;

var Confirmation = DatabankObject.subClass("confirmation");

var now = function() {
    return Math.floor(Date.now()/1000);
};

Confirmation.schema = {
    pkey: "nickname_email",
    fields: ["nickname",
             "email",
             "code",
             "confirmed",
             "timestamp"],
    indices: ["nickname"]
};

exports.Confirmation = Confirmation;

Confirmation.pkey = function() {
    return "nickname_email";
};

Confirmation.makeKey = function(props) {
    return props.nickname + "/" + props.email;
};

Confirmation.beforeCreate = function(props, callback) {

    if (!_(props).has("nickname") ||
        !_(props).has("email")) {
        callback(new Error("Not enough properties"), null);
    }

    props.nickname_email = Confirmation.makeKey(props.nickname, props.email);
    props.timestamp      = Stamper.stamp();
    props.confirmed      = false;

    Step(
        function() {
            randomString(8, this);
        },
        function(err, str) {
            if (err) {
                callback(err, null);
            } else {
                props.code = str;
                callback(null, props);
            }
        }
    );
};

// double the timestamp timeout in ../lib/provider.js, in seconds

var TIMELIMIT = 600; 

Confirmation.cleanup = function(consumer_key, callback) {
    Step(
        function() {
            Confirmation.search({consumer_key: consumer_key}, this);
        },
        function(err, nonces) {
            var i, nonce, group = this.group(), c = 0;
            if (err) throw err;
            for (i = 0; i < nonces.length; i++) {
                nonce = nonces[i];
                if (now() - nonce.timestamp > TIMELIMIT) {
                    nonce.del(group());
                    c++;
                }
            }
            if (c === 0) {
                // Nothing to delete
                callback(null);
            }
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};
