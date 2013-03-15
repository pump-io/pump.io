// host.js
//
// data object representing a remote host
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
    wf = require("webfinger"),
    qs = require("querystring"),
    Step = require("step"),
    Schlock = require("schlock"),
    OAuth = require("oauth-evanp").OAuth,
    DatabankObject = require("databank").DatabankObject,
    URLMaker = require("../urlmaker").URLMaker,
    version = require("../version").version,
    RemoteRequestToken = require("./remoterequesttoken").RemoteRequestToken,
    Credentials = require("./credentials").Credentials;

var Host = DatabankObject.subClass("host");

var OAUTH_RT = "http://apinamespace.org/oauth/request_token",
    OAUTH_AT = "http://apinamespace.org/oauth/access_token",
    OAUTH_AUTHZ = "http://apinamespace.org/oauth/authorize",
    WHOAMI = "http://apinamespace.org/activitypub/whoami",
    OAUTH_CRED = "registration_endpoint";

Host.schema = {
    pkey: "hostname",
    fields: ["registration_endpoint",
             "request_token_endpoint",
             "access_token_endpoint",
             "authorization_endpoint",
             "whoami_endpoint",
             "created",
             "updated"]
};

Host.beforeCreate = function(props, callback) {
    if (!props.hostname) {
        callback(new Error("Hostname is required"), null);
        return;
    }
    props.created = Date.now();
    props.modified = props.created;
    callback(null, props);
};

Host.prototype.beforeUpdate = function(props, callback) {
    props.modified = Date.now();
    callback(null, props);
};

Host.prototype.beforeSave = function(callback) {
    var host = this;

    if (!host.hostname) {
        callback(new Error("Hostname is required"));
        return;
    }
    host.modified = Date.now();
    if (!host.created) {
        host.created = host.modified;
    }
    callback(null);
};

// prevent clashes for same host

Host.schlock = new Schlock();

Host.ensureHost = function(hostname, callback) {

    var host;

    Step(
        function() {
            Host.schlock.writeLock(hostname, this);
        },
        function(err) {
            if (err) throw err;
            Host.get(hostname, this);
        },
        function(err, results) {
            if (err && err.name == "NoSuchThingError") {
                Host.discover(hostname, this);
            } else if (err) {
                throw err;
            } else {
                // XXX: update endpoints?
                this(null, results);
            }
        },
        function(err, results) {
            if (err) throw err;
            host = results;
            Host.schlock.writeUnlock(hostname, this);
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, host);
            }
        }
    );
};

Host.discover = function(hostname, callback) {

    var props = {
        hostname: hostname
    };

    Step(
        function() {
            wf.hostmeta(hostname, this);
        },
        function(err, jrd) {
            if (err) throw err;
            var prop,
                rel,
                rels = {
                    registration_endpoint: OAUTH_CRED,
                    request_token_endpoint: OAUTH_RT,
                    access_token_endpoint: OAUTH_AT,
                    authorization_endpoint: OAUTH_AUTHZ,
                    whoami_endpoint: WHOAMI
                };

            for (prop in rels) {
                rel = rels[prop];
                var links = _.where(jrd.links, {rel: rel});
                if (links.length === 0) {
                    callback(new Error(hostname + " does not implement " + rel), null);
                    return;
                } else {
                    props[prop] = links[0].href;
                }
            }

            Host.create(props, this);
        },
        callback
    );
};

Host.prototype.getRequestToken = function(callback) {

    var host = this,
        oa;

    Step(
        function() {
            host.getOAuth(this);
        },
        function(err, results) {
            if (err) throw err;
            oa = results;
            oa.getOAuthRequestToken(this);
        },
        function(err, token, secret, other) {
            if (err) throw err;
            RemoteRequestToken.create({token: token,
                                       secret: secret,
                                       hostname: host.hostname},
                                      this);
        },
        callback
    );
};

Host.prototype.authorizeURL = function(rt) {
    var host = this,
        separator;

    if (_.contains(host.authorization_endpoint, "?")) {
        separator = "&";
    } else {
        separator = "?";
    }
    
    return host.authorization_endpoint + separator + "oauth_token=" + rt.token;
};

Host.prototype.getAccessToken = function(rt, verifier, callback) {
    var host = this,
        oa;

    Step(
        function() {
            host.getOAuth(this);
        },
        function(err, results) {
            if (err) throw err;
            oa = results;
            oa.getOAuthAccessToken(rt.token, rt.secret, verifier, this);
        },
        function(err, token, secret, res) {
            if (err) {
                callback(err, null);
            } else {
                // XXX: Mark rt as used?
                // XXX: Save the verifier somewhere?
                callback(null, {token: token, secret: secret});
            }
        }
    );
};

Host.prototype.whoami = function(token, secret, callback) {
    var host = this,
        oa;

    Step(
        function() {
            host.getOAuth(this);
        },
        function(err, results) {
            if (err) throw err;
            oa = results;
            oa.get(host.whoami_endpoint, token, secret, this);
        },
        function(err, doc, response) {
            var obj;
            if (err) throw err;
            obj = JSON.parse(doc);
            this(null, obj);
        },
        callback
    );
};

Host.prototype.getOAuth = function(callback) {

    var host = this;

    Step(
        function() {
            Credentials.getForHost(URLMaker.hostname, host, this);
        },
        function(err, cred) {
            var oa;
            if (err) throw err;
            oa = new OAuth(host.request_token_endpoint,
                           host.access_token_endpoint,
                           cred.client_id,
                           cred.client_secret,
                           "1.0",
                           URLMaker.makeURL("/main/authorized/"+host.hostname),
                           "HMAC-SHA1",
                           null, // nonce size; use default
                           {"User-Agent": "pump.io/"+version});
            this(null, oa);
        },
        callback
    );
};

exports.Host = Host;
