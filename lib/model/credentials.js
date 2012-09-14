// Credentials for a remote system
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
    _ = require("underscore"),
    DatabankObject = databank.DatabankObject,
    NoSuchThingError = databank.NoSuchThingError;

var Credentials = DatabankObject.subClass("credentials");

Credentials.schema = {
    pkey: "host_and_id",
    fields: ["host",
             "id",
             "client_id",
             "client_secret",
             "expires_at",
             "created",
             "updated"],
    indices: ["host", "id", "client_id"]
};

Credentials.makeKey = function(host, id) {
    if (!id) {
        return host;
    } else {
        return host + "/" + id;
    }
};

Credentials.beforeCreate = function(props, callback) {
    props.created = props.updated = Stamper.stamp();
    props.host_and_id = Credentials.makeKey(props.host, props.id);
    callback(null, props);
};

Credentials.prototype.beforeUpdate = function(props, callback) {
    props.updated = Stamper.stamp();
    callback(null, props);
};

exports.Credentials = Credentials;

