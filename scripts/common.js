// register.js
//
// Register a new user with the activity pump
//
// Copyright 2011, StatusNet Inc.
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

var url = require('url'),
    http = require('http');

var postActivity = function(serverUrl, activity, opts, callback) {

    var prop;
    var results = '';
    var toSend = JSON.stringify(activity);

    var parts = url.parse(serverUrl);

    var options = {
	host: parts.hostname,
	port: parts.port,
	method: 'POST',
	path: (parts.search) ? parts.pathname+'?'+parts.search : parts.pathname,
	headers: {'content-type': 'application/json',
		  'user-agent': 'activitypump/0.1.0dev'}
    };

    if (opts && typeof opts == 'function') {
	callback = opts;
    } else if (opts && typeof opts == 'object') {
	for (prop in opts) {
	    options[prop] = opts[prop];
	}
    }

    var req = http.request(options, function(res) {
	res.on('data', function (chunk) {
	    results = results + chunk;
	});
	res.on('end', function () {
	    callback(null, results);
	});
    });

    req.on('error', function(e) {
	callback(e, null);
    });

    req.write(toSend);
    req.end();
};

var getJSON = function(serverURL, opts, callback) {

    var results = '', prop;

    var parts = url.parse(serverURL);

    var options = {
	host: parts.hostname,
	port: parts.port,
	method: 'GET',
	path: (parts.search) ? parts.pathname+'?'+parts.search : parts.pathname,
	headers: {'content-type': 'application/json',
		  'user-agent': 'activitypump/0.1.0dev'}
    };

    if (opts && typeof opts == 'function') {
	callback = opts;
    } else if (opts && typeof opts == 'object') {
	for (prop in opts) {
	    options[prop] = opts[prop];
	}
    }

    console.log(options);

    http.get(options, function(res) {
	res.on('data', function (chunk) {
	    results = results + chunk;
	});
	res.on('end', function () {
	    callback(null, JSON.parse(results));
	});
    }).on('error', function(e) {
	callback(e, null);
    }).end();
};

exports.postActivity = postActivity;
exports.getJSON = getJSON;
