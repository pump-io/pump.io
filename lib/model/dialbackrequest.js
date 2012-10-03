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
    Stream = require("./stream").Stream,
    NoSuchThingError = databank.NoSuchThingError;

var DialbackRequest = DatabankObject.subClass("dialbackrequest");

DialbackRequest.schema = {
    pkey: "endpoint_id_token_timestamp",
    fields: ["endpoint",
             "id",
             "token",
             "timestamp"]
};

exports.DialbackRequest = DialbackRequest;

DialbackRequest.toKey = function(props) {
    return props.endpoint + "/" + props.id + "/" + props.token + "/" + props.timestamp;
};

DialbackRequest.beforeCreate = function(props, callback) {

    if (!_(props).has("endpoint") ||
        !_(props).has("id") ||
        !_(props).has("token") ||
        !_(props).has("timestamp")) {
        callback(new Error("Wrong properties"), null);
        return;
    }

    props.endpoint_id_token_timestamp = DialbackRequest.toKey(props);

    callback(null, props);
};

// We keep a stream of all requests for cleanup

DialbackRequest.prototype.afterCreate = function(callback) {
    var req = this;

    Step(
        function() {
            DialbackRequest.stream(this);
        },
        function(err, str) {
            if (err) throw err;
            str.deliver(req.endpoint_id_token_timestamp, this);
        },
        callback
    );
};

DialbackRequest.cleanup = function(callback) {

    var cleanupFirst = function(str, callback) {
        var ids, cleaned;
        Step(
            function() {
                str.getIDs(0, 20, this);
            },
            function(err, res) {
                if (err) throw err;
                ids = res;
                if (ids.length == 0) {
                    cb(null);
                } else {
                    cleanupIDs(ids, this);
                }
            },
            function(err, res) {
                if (err) throw err;
                cleaned = res;
                cleanupRest(str, ids[ids.length - 1], this);
            },
            function(err) {
                if (err) throw err;
                removeIDs(str, cleaned, this);
            },
            callback
        );
    },
        cleanupRest = function(str, key, callback) {
            var ids, cleaned;
            Step(
                function() {
                    str.getIDsGreaterThan(key, 20, this);
                },
                function(err, res) {
                    if (err) throw err;
                    ids = res;
                    if (ids.length == 0) {
                        callback(null);
                    } else {
                        cleanupIDs(ids, this);
                    }
                },
                function(err, res) {
                    if (err) throw err;
                    cleaned = res;
                    cleanupRest(str, ids[ids.length - 1], this);
                },
                function(err) {
                    if (err) throw err;
                    removeIDs(str, cleaned, this);
                },
                callback
            );
        },
        maybeCleanup = function(id, callback) {
            Step(
                function() {
                    DialbackRequest.get(id, this);
                },
                function(err, req) {
                    if (err && (err.name == "NoSuchThingError")) {
                        callback(null, true);
                    } else if (err) {
                        callback(err, null);
                    } else {
                        if (Date.now() - req.timestamp > 300000) {
                            req.del(this);
                        } else {
                            callback(null, false);
                        }
                    }
                },
                function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, true);
                    }
                }
            );
        },
        cleanupIDs = function(ids, callback) {
            Step(
                function() {
                    var i, group = this.group();
                    for (i = 0; i < ids.length; i++) {
                        maybeCleanup(ids[i], group());
                    }
                },
                function(err, cleanedUp) {
                    var i, toRemove = [];
                    if (err) throw err;

                    for (i = 0; i < ids.length; i++) {
                        if (cleanedUp[i]) {
                            toRemove.push(ids[i]);
                        }
                    }

                    callback(null, toRemove);
                },
                callback
            );
        },
        maybeRemove = function(str, id, callback) {
            Step(
                function() {
                    str.remove(id, this);
                },
                function(err) {
                    if (err && err.name == "NotInStreamError") {
                        callback(null);
                    } else if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                }
            );
        },
        removeIDs = function(str, ids, callback) {

            Step(
                function() {
                    var i, group = this.group();
                    for (i = 0; i < ids.length; i++) {
                        maybeRemove(str, ids[i], group());
                    }
                },
                function(err, ids) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                }
            );
        };

    Step(
        function() {
            DialbackRequest.stream(this);
        },
        function(err, str) {
            if (err) throw err;
            cleanupFirst(str, this);
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

DialbackRequest.stream = function(callback) {
    var name = "dialbackclientrequest:recent";

    Step(
        function() {
            Stream.get(name, this);
        },
        function(err, str) {
            if (err) {
                if (err.name == "NoSuchThingError") {
                    Stream.create({name: name}, this);
                } else {
                    throw err;
                }
            } else {
                callback(null, str);
            }
        },
        function(err, str) {
            if (err) {
                if (err.name == "AlreadyExistsError") {
                    Stream.get(name, callback);
                } else {
                    callback(err);
                }
            } else {
                callback(null, str);
            }
        }
    );
};

// Clear out old requests every 1 minute

setTimeout(function() {
    // XXX: log errors
    DialbackRequest.cleanup(function(err) {});
}, 60000);
