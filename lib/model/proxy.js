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

Proxy.ensureAll = function(urls, callback) {

    var pmap,
        tryCreate = function(url, cb) {
            Step(
                function() {
                    Proxy.create({url: url}, this);
                },
                function(err, result) {
                    if (err && err.name == "AlreadyExistsError") {
                        Proxy.get(url, cb);                        
                    } else if (err) {
                        cb(err, null);
                    } else {
                        cb(null, result);
                    }
                }
            );
        };

    Step(
        function() {
            Proxy.readAll(urls, this);
        },
        function(err, results) {
            var group = this.group();
            if (err) throw err;
            pmap = results;
            _.each(pmap, function(proxy, url) {
                if (!proxy) {
                    tryCreate(url, group());
                }
            });
        },
        function(err, proxies) {
            if (err) {
                callback(err, null);
            } else {
                _.each(proxies, function(proxy) {
                    pmap[proxy.url] = proxy;
                });
                callback(null, pmap);
            }
        }
    );
};

Proxy.ensureURL = function(url, callback) {

    var tryCreate = function(url, cb) {
        Step(
            function() {
                Proxy.create({url: url}, this);
            },
            function(err, result) {
                if (err && err.name == "AlreadyExistsError") {
                    Proxy.get(url, cb);                        
                } else if (err) {
                    cb(err, null);
                } else {
                    cb(null, result);
                }
            }
        );
    };

    Step(
        function() {
            Proxy.get(url, this);
        },
        function(err, result) {
            var delta;
            if (err && err.name == "NoSuchThingError") {
                tryCreate(url, callback);
            } else if (err) {
                callback(err, null);
            } else {
                callback(null, result);
            }
        }
    );
};

Proxy.whitelist = [];

exports.Proxy = Proxy;
