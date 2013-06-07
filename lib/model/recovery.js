// recovery.js
//
// Random code for recovering a password
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

var databank = require("databank"),
    _ = require("underscore"),
    DatabankObject = databank.DatabankObject,
    Step = require("step"),
    randomString = require("../randomstring").randomString,
    Stamper = require("../stamper").Stamper,
    NoSuchThingError = databank.NoSuchThingError;

var Recovery = DatabankObject.subClass("recovery");

var now = function() {
    return Math.floor(Date.now()/1000);
};

Recovery.schema = {
    pkey: "code",
    fields: ["nickname",
             "recovered",
             "timestamp"],
    indices: ["nickname"]
};

Recovery.pkey = function() {
    return "code";
};

Recovery.beforeCreate = function(props, callback) {

    if (!_(props).has("nickname")) {
        callback(new Error("Not enough properties"), null);
        return;
    }

    props.timestamp = Stamper.stamp();
    props.recovered = false;

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

exports.Recovery = Recovery;
