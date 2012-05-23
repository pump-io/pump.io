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

var now = function() {
    return Math.floor(Date.now()/1000);
};

Nonce.schema = {
    pkey: 'token_nonce',
    fields: ['nonce',
             'consumer_key',
             'access_token',
             'timestamp'],
    indices: ['consumer_key']
};

exports.Nonce = Nonce;

Nonce.pkey = function() {
    return 'token_nonce';
};

Nonce.makeKey = function(consumer_key, access_token, nonce, timestamp) {
    if (access_token) {
        return consumer_key + '/' + access_token + '/' + timestamp.toString(10) + '/' + nonce;
    } else {
        return consumer_key + '/' + timestamp.toString(10) + '/' + nonce;
    }
};

Nonce.beforeCreate = function(props, callback) {
    if (!_(props).has('consumer_key') ||
        !_(props).has('timestamp') ||
        !_(props).has('nonce')) {
        callback(new Error("Not enough properties"), null);
    }

    props.token_nonce = Nonce.makeKey(props.consumer_key, props.access_token || null, props.nonce, props.timestamp);

    callback(null, props);
};

// double the timestamp timeout in ../lib/provider.js, in seconds

var TIMELIMIT = 600; 

Nonce.seenBefore = function(consumer_key, access_token, nonce, timestamp, callback) {

    var key = Nonce.makeKey(consumer_key, access_token || null, nonce, timestamp);

    Step(
        function() {
            Nonce.get(key, this);
        },
        function(err, found) {
            var props;
            if (err && (err instanceof NoSuchThingError)) { // database miss
                props = {consumer_key: consumer_key,
                         nonce: nonce,
                         timestamp: parseInt(timestamp, 10)};
                if (access_token) {
                    props.access_token = access_token;
                }
                Nonce.create(props, this);
            } else if (err) { // regular old error
                throw err;
            } else {
                callback(null, true);
            }
        },
        function(err, nonce) {
            if (err) {
                callback(err, null);
            } else {
                callback(err, false);
            }
        }
    );

    Nonce.cleanup(consumer_key, ignore);
};

Nonce.cleanup = function(consumer_key, callback) {
    Step(
        function() {
            Nonce.search({consumer_key: consumer_key}, this);
        },
        function(err, nonces) {
            var i, nonce, group = this.group(), c = 0;
            if (err) throw err;
            for (i = 0; i < nonces.length; i++) {
                nonce = nonces[i];
                if (now() - nonce.timestamp > TIMELIMIT) {
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
