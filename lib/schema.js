// lib/schema.js
//
// Get all the files
//
// Copyright 2011-2012, E14N https://e14n.com/
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

var express = require("express"),
    _ = require("underscore"),
    DialbackClient = require("dialback-client"),
    Activity = require("./model/activity").Activity,
    User = require("./model/user").User,
    Edge = require("./model/edge").Edge,
    Share = require("./model/share").Share,
    Stream = require("./model/stream").Stream,
    Client = require("./model/client").Client,
    RequestToken = require("./model/requesttoken").RequestToken,
    AccessToken = require("./model/accesstoken").AccessToken,
    Nonce = require("./model/nonce").Nonce,
    Credentials = require("./model/credentials").Credentials,
    Confirmation = require("./model/confirmation").Confirmation,
    Favorite = require("./model/favorite").Favorite,
    Host = require("./model/host").Host,
    Membership = require("./model/membership").Membership,
    Proxy = require("./model/proxy").Proxy,
    Recovery = require("./model/recovery").Recovery,
    RemoteAccessToken = require("./model/remoteaccesstoken").RemoteAccessToken,
    RemoteRequestToken = require("./model/remoterequesttoken").RemoteRequestToken,
    ActivityObject = require("./model/activityobject").ActivityObject,
    DatabankStore = require('connect-databank')(express),
    Other = require("./model/other").Other;
    
var getSchema = function() {

    var i, type, Cls, schema = {};

    schema.activity = Activity.schema;
    schema.user = User.schema;
    schema.edge = Edge.schema;
    schema.share = Share.schema;
    schema.userlist = {"pkey": "id"};
    schema.usercount = {"pkey": "id"};

    _.extend(schema, Stream.schema);
    schema[Client.type] = Client.schema;
    schema[RequestToken.type] = RequestToken.schema;
    schema[AccessToken.type] = AccessToken.schema;
    schema[Nonce.type] = Nonce.schema;
    schema[Credentials.type] = Credentials.schema;
    schema[Other.type] = Other.schema;
    schema[Confirmation.type] = Confirmation.schema;
    schema[Favorite.type] = Favorite.schema;
    schema[Host.type] = Host.schema;
    schema[Membership.type] = Membership.schema;
    schema[Proxy.type] = Proxy.schema;
    schema[Recovery.type] = Recovery.schema;
    schema[RemoteAccessToken.type] = RemoteAccessToken.schema;
    schema[RemoteRequestToken.type] = RemoteRequestToken.schema;

    _.extend(schema, DatabankStore.schema);

    _.extend(schema, DialbackClient.schema);

    for (i = 0; i < ActivityObject.objectTypes.length; i++) {
        type = ActivityObject.objectTypes[i];
        Cls = ActivityObject.toClass(type);
        if (Cls.schema) {
            schema[type] = Cls.schema;
        } else {
            schema[type] = {"pkey": "id",
                            "fields": ["updated", "published", "displayName", "url"],
                            "indices": ["_uuid", "author.id"]};
        }
    }

    return schema;
};

exports.schema = getSchema();
