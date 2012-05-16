// nonce.js
//
// A nonce in an OAuth call
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

var databank = require('databank'),
    _ = require('underscore'),
    DatabankObject = databank.DatabankObject,
    Step = require('step'),
    randomString = require('../randomstring').randomString,
    NoSuchThingError = databank.NoSuchThingError;

var Nonce = DatabankObject.subClass('nonce');

var ignore = function(err) {};

Nonce.schema = {
    pkey: 'token_nonce',
    fields: ['nonce',
             'access_token',
             'timestamp'],
    indices: ['access_token']
};

exports.Nonce = Nonce;

Nonce.pkey = function() {
    return 'token_nonce';
};

Nonce.makeKey = function(access_token, nonce) {
    return access_token + '/' + nonce;
};

Nonce.beforeCreate = function(props, callback) {
    if (!_(props).has('access_token') ||
        !_(props).has('nonce')) {
        callback(new Error("Not enough properties"), null);
    }

    props.token_nonce = Nonce.makeKey(props.access_token, props.nonce);
    props.timestamp = Date.now();

    callback(null, props);
};

// double the timestamp timeout in ../lib/provider.js, in ms

var TIMELIMIT = 600000; 

Nonce.seenBefore = function(access_token, nonce, callback) {

    var key = Nonce.makeKey(access_token, nonce);

    Nonce.get(key, function(err, found) {
        var props;
        if (err && (err instanceof NoSuchThingError)) { // never seen before
            props = {nonce: nonce,
                     access_token: access_token};
            Nonce.create(props, function(err, newn) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, false);
                }
            });
        } else if (err) { // regular-old error

            callback(err, null);

        } else if ((Date.now() - found.timestamp) > TIMELIMIT) { // Out of date

            found.update({timestamp: Date.now()}, function(err, upd) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, false);
                }
            });

        } else { // Found and relevant
            callback(null, true);
        }
    });

    Nonce.cleanup(access_token, ignore);
};

Nonce.cleanup = function(access_token, callback) {
    Step(
        function() {
            Nonce.search({access_token: access_token}, this);
        },
        function(err, nonces) {
            var i, nonce, group = this.group(), c = 0;
            if (err) throw err;
            for (i = 0; i < nonces.length; i++) {
                nonce = nonces[i];
                if (Date.now() - nonce.timestamp > TIMELIMIT) {
                    nonce.del(group());
                    c++;
                }
            }
            if (c === 0) {
                // Nothing to delete
                callback(null);
            }
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
