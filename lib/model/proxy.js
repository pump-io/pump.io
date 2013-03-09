// proxy.js
//
// A proxy for a remote request
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

var databank = require("databank"),
    _ = require("underscore"),
    Step = require("step"),
    IDMaker = require("../idmaker").IDMaker,
    Stamper = require("../stamper").Stamper,
    DatabankObject = databank.DatabankObject,
    NoSuchThingError = databank.NoSuchThingError;

var Proxy = DatabankObject.subClass("proxy");

Proxy.schema = {
    pkey: "url",
    fields: [
        "id",
        "created"
    ],
    indices: ["id"]
};

Proxy.beforeCreate = function(props, callback) {

    if (!props.url) {
        callback(new Error("No URL specified"), null);
        return;
    }

    props.id      = IDMaker.makeID();
    props.created = Stamper.stamp();

    callback(null, props);
};

exports.Proxy = Proxy;
