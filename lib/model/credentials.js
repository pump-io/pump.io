// Credentials for a remote system
//
// Copyright 2012 E14N https://e14n.com/
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

var Step = require("step"),
    databank = require("databank"),
    _ = require("underscore"),
    wf = require("webfinger"),
    querystring = require("querystring"),
    urlparse = require("url").parse,
    Stamper = require("../stamper").Stamper,
    ActivityObject = require("./activityobject").ActivityObject,
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

Credentials.prototype.beforeSave = function(callback) {
    var cred = this;
    cred.updated = Stamper.stamp();
    if (!cred.host_and_id) {
	cred.host_and_id = Credentials.makeKey(cred.host, cred.id);
	cred.created = cred.updated;
    }
    callback(null);
};

Credentials.hostOf = function(endpoint) {
    var parts = urlparse(endpoint);
    return parts.hostname;
};

Credentials.getFor = function(id, endpoint, callback) {

    var host = Credentials.hostOf(endpoint);

    Credentials.getForHostname(id, host, callback);
};

Credentials.getForHostname = function(id, hostname, callback) {

    id = ActivityObject.canonicalID(id);
    
    Step(
        function() {
            Credentials.get(Credentials.makeKey(hostname, id), this);
        },
        function(err, cred) {
            if (!err) {
                // if it worked, just return the credentials
                callback(null, cred);
            } else if (err.name != "NoSuchThingError") {
                throw err;
            } else if (!Credentials.dialbackClient) {
                throw new Error("No dialback client for credentials");
            } else {
                require("./host").Host.ensureHost(hostname, this);
            }
        },
        function(err, host) {
            if (err) throw err;
            Credentials.register(id, hostname, host.registration_endpoint, this);
        },
        callback
    );
};

Credentials.getForHost = function(id, host, callback) {

    id = ActivityObject.canonicalID(id);
    
    Step(
        function() {
            Credentials.get(Credentials.makeKey(host.hostname, id), this);
        },
        function(err, cred) {
            if (!err) {
                // if it worked, just return the credentials
                callback(null, cred);
            } else if (err.name != "NoSuchThingError") {
                throw err;
            } else if (!Credentials.dialbackClient) {
                throw new Error("No dialback client for credentials");
            } else {
                Credentials.register(id, host.hostname, host.registration_endpoint, this);
            }
        },
        callback
    );
};

Credentials.register = function(id, hostname, endpoint, callback) {

    Step(
        function() {

            var toSend, body;

            if (id.substr(0, 5) == "acct:") {
                toSend = id.substr(5);
            } else {
                toSend = id;
            }

            body = querystring.stringify({type: "client_associate",
                                          application_type: "web",
                                          application_name: toSend});

            Credentials.dialbackClient.post(endpoint, toSend, body, "application/x-www-form-urlencoded", this);
        },
        function(err, resp, body) {

            var cred;

            if (err) throw err;

            if (resp.statusCode >= 400 && resp.statusCode < 600) {
                throw new Error("HTTP Error " + resp.statusCode + ": " + body);
            }

            if (!resp.headers["content-type"]) {
                throw new Error("No content type");
            }

            if (resp.headers["content-type"].substr(0, "application/json".length) != "application/json") {
                throw new Error("Bad content type: " + resp.headers["content-type"]);
            }

            // XXX: make throw a parse error

            cred = new Credentials(JSON.parse(body)); 

            cred.id = id;
            cred.host = hostname;

            cred.save(this);
        },
        callback
    );
};

exports.Credentials = Credentials;

