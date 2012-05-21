// http.js
//
// HTTP utilities for testing
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

var http = require('http'),
    _ = require('underscore');

var options = function(host, port, path, callback) {

    var reqOpts = {
        host: host,
        port: port,
        path: path,
        method: 'OPTIONS'
    };

    var req = http.request(reqOpts, function(res) {
        var body = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            body = body + chunk;
        });
        res.on('error', function(err) {
            callback(err, null, null, null);
        });
        res.on('end', function() {
            var allow = [];
            if (_(res.headers).has('allow')) {
                allow = res.headers.allow.split(',').map(function(s) { return s.trim(); });
            }
            callback(null, allow, res, body);
        });
    });

    req.on('error', function(err) {
        callback(err, null, null, null);
    });

    req.end();
};

exports.options = options;
