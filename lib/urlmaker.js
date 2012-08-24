// urlmaker.js
//
// URLs just like Mama used to make
//
// Copyright 2011-2012, StatusNet Inc.
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
    url = require("url"),
    querystring = require("querystring");

var URLMaker = {
    hostname: null,
    port: 80,
    makeURL: function(relative, params) {
        var obj = {
            protocol: "http",
            hostname: this.hostname,
            pathname: relative
        };
        if (!this.hostname) {
            throw new Error("No hostname");
        }
        if (this.port !== 80) {
            obj.port = this.port;
        }
        if (params) {
            obj.search = querystring.stringify(params);
        }
        return url.format(obj);
    },
    ourURL: function(candidate) {
        var parts = url.parse(candidate);
        return (parts.hostname == this.hostname &&
                (parts.port == this.port ||
                 !_(parts).has("port") && this.port === 80));
    }
};

exports.URLMaker = URLMaker;

