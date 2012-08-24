// pushrequest.js
//
// A subscription request for PubSubHubbub
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

var PushRequest = DatabankObject.subClass("pushrequest");

PushRequest.schema = {
    pkey: "topic_mode",
    fields: ["mode",
             "topic",
             "verify_token",
             "status",
             "lease_seconds",
             "created",
             "modified"],
    indices: ["topic", "verify_token"]
};

PushRequest.beforeCreate = function(props, callback) {

    if (!_(props).has("topic")) {
        callback(new Error("No topic in request"), null);
    }

    if (!_(props).has("mode")) {
        props.mode = "subscribe";
    }

    props.created = Date.now();

    props.topic_mode = props.topic + "/" + props.mode;

    Step(
        function() {
            randomString(16, this);
        },
        function(err, str) {
            if (err) {
                callback(err, null);
            } else {
                props.verify_token = str;
                callback(null, props);
            }
        }
    );
};

PushRequest.prototype.beforeUpdate = function(props, callback) {

    var immutable = ["mode", "topic", "topic_mode", "created", "verify_token"],
        i, prop;

    for (i = 0; i < immutable.length; i++) {
        prop = immutable[i];
        if (props.hasOwnProperty(prop)) {
            delete props[prop];
        }
    }

    props.modified = Date.now();

    callback(null, props);
};

exports.PushRequest = PushRequest;
