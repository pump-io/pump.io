// requesttoken.js
//
// An OAuth request token
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
    dateFormat = require('dateformat'),
    Step = require('step'),
    randomString = require('../randomstring').randomString,
    NoSuchThingError = databank.NoSuchThingError;

var AccessToken = DatabankObject.subClass('accesstoken');

AccessToken.schema = {
    accesstoken: {
        pkey: 'token',
        fields: ['token_secret',
                 'consumer_key',
                 'username',
                 'created',
                 'updated'],
        indices: ['username', 'consumer_key']
    }
};

exports.AccessToken = AccessToken;

AccessToken.defaultCreate = AccessToken.create;

AccessToken.create = function(properties, callback) {

    if (!properties.consumer_key || !properties.callback) {
	callback(new Error('Gotta have a consumer key and a callback.'), null);
        return;
    }

    Step(
        function() {
            randomString(16, this.parallel());
            randomString(32, this.parallel());
        },
        function(err, token, token_secret) {
            if (err) {
                callback(err, null);
            } else {
                var now = dateFormat(new Date(), "isoDateTime", true);
                _(properties).extend({token: token,
                                      token_secret: token_secret,
                                      username: null,
                                      created: now,
                                      updated: now});

                AccessToken.defaultCreate(properties, callback);
            }
        }
    );
};
