// dialbackclientrequest.js
//
// Keep track of the requests we've made
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

var DialbackClientRequest = DatabankObject.subClass("dialbackclientrequest");

DialbackClientRequest.schema = {
    pkey: "endpoint_id_token_timestamp",
    fields: ["endpoint",
             "id",
             "token",
             "timestamp"]
};

exports.DialbackClientRequest = DialbackClientRequest;

DialbackClientRequest.toKey = function(props) {
    return props.endpoint + "/" + props.id + "/" + props.token + "/" + props.timestamp;
};

DialbackClientRequest.beforeCreate = function(props, callback) {

    if (!_(props).has("endpoint") ||
        !_(props).has("id") ||
        !_(props).has("token") ||
        !_(props).has("timestamp")) {
        callback(new Error("Wrong properties"), null);
        return;
    }

    props.endpoint_id_token_timestamp = DialbackClientRequest.toKey(props);

    callback(null, props);
};
