// remoteaccesstoken.js
//
// data object representing a remoteaccesstoken
//
// Copyright 2013, E14N https://e14n.com/
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

var _ = require("underscore"),
    DatabankObject = require("databank").DatabankObject;

var RemoteAccessToken = DatabankObject.subClass("remoteaccesstoken");

RemoteAccessToken.schema = {
    pkey: "id",
    fields: ["type",
             "token",
             "secret",
             "hostname",
             "created",
             "modified"]
};

RemoteAccessToken.beforeCreate = function(props, callback) {

    var i, required = ["id", "type", "hostname", "token", "secret"],
        fail = false;

    for (i = 0; i < required.length; i++) {
        if (!_.has(props, required[i])) {
            callback(new Error("Missing required property: " + required[i]), null);
            return;
        }
    }

    callback(null, props);
};

exports.RemoteAccessToken = RemoteAccessToken;

