// pushsubscription.js
//
// A subscription for PubSubHubbub
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
    IDMaker = require("../idmaker").IDMaker,
    NoSuchThingError = databank.NoSuchThingError;

var PushSubscription = DatabankObject.subClass("pushsubscription");

PushSubscription.states = [
    "subscribing-initial",
    "subscribing-verified",
    "active",
    "unsubscribing-initial",
    "unsubscribing-verified",
    "inactive"
];

(function() {
    var i, state;
    for (i = 0; i < PushSubscription.states.length; i++) {
        state = PushSubscription.states[i];
        PushSubscription[state.toUpperCase().replace("-", "_")] = state;
    }
})();

PushSubscription.schema = {
    pkey: "topic",
    fields: ["uuid",
             "state",
             "verify_token",
             "secret",
             "lease_seconds",
             "created",
             "modified"],
    indices: ["uuid"]
};

PushSubscription.beforeCreate = function(props, callback) {

    if (!_(props).has("topic")) {
        callback(new Error("No topic in subscription"), null);
    }

    if (!_(props).has("state")) {
        props.state   = PushSubscription.SUBSCRIBING_INITIAL;
    }

    props.created  = Date.now();
    props.modified = props.created;
    props.uuid     = IDMaker.makeID();

    Step(
        function() {
            randomString(16, this.parallel());
            randomString(16, this.parallel());
        },
        function(err, verify_token, secret) {
            if (err) {
                callback(err, null);
            } else {
                props.verify_token = verify_token;
                props.secret       = secret;
                callback(null, props);
            }
        }
    );
};

PushSubscription.prototype.beforeUpdate = function(props, callback) {

    var immutable = ["topic", "verify_token", "secret", "uuid", "created"],
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

exports.PushSubscription = PushSubscription;
