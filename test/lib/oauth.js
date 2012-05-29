// oauth.js
//
// Utilities for generating clients, request tokens, and access tokens
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

var Step = require('step'),
    _ = require('underscore'),
    http = require('http'),
    OAuth = require('oauth').OAuth,
    Browser = require('zombie'),
    httputil = require('./lib/http');

var requestToken = function(cl, cb) {
    var oa;
    oa = new OAuth('http://localhost:4815/oauth/request_token',
                   'http://localhost:4815/oauth/access_token',
                   cl.client_id,
                   cl.client_secret,
                   "1.0",
                   "oob",
                   "HMAC-SHA1",
                   null, // nonce size; use default
                   {"User-Agent": "activitypump-test/0.1.0"});
    
    oa.getOAuthRequestToken(function(err, token, secret) {
        if (err) {
            cb(new Error(err.data), null);
        } else {
            cb(null, {token: token, token_secret: secret});
        }
    });
};

var newClient = function(cb) {
    httputil.post('localhost', 4815, '/api/client/register', {type: 'client_associate'}, function(err, res, body) {
        var cl;
        if (err) {
            cb(err, null);
        } else {
            try {
                cl = JSON.parse(body);
                cb(null, cl);
            } catch (err) {
                cb(err, null);
            }
        }
    });
};

exports.requestToken = requestToken;
exports.newClient = newClient;
