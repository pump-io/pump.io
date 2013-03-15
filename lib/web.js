// web.js
//
// Wrap http/https requests in a callback interface
//
// Copyright 2012, E14N https://e14n.com/
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

var urlparse = require("url").parse,
    http = require("http"),
    https = require("https"),
    version = require("./version").version;

var web = {

    mod: function(mod, options, reqBody, callback) {

        var req;

        // Optional reqBody

        if (!callback) {
            callback = reqBody;
            reqBody = null;
        }

        // Add our user-agent header

        if (!options.headers) {
            options.headers = {};
        }

        if (!options.headers["User-Agent"]) {
            options.headers["User-Agent"] = "pump.io/"+version;
        }

        req = mod.request(options, function(res) {
            var resBody = "";
            res.setEncoding("utf8");
            res.on("data", function(chunk) {
                resBody = resBody + chunk;
            });
            res.on("error", function(err) {
                callback(err, null);
            });
            res.on("end", function() {
                res.body = resBody;
                callback(null, res);
            });
        });

        req.on("error", function(err) {
            callback(err, null);
        });

        if (reqBody) {
            req.write(reqBody);
        }

        req.end();
    },
    https: function(options, body, callback) {
        this.mod(https, options, body, callback);
    },
    http: function(options, body, callback) {
        this.mod(http, options, body, callback);
    }
};

module.exports = web;
