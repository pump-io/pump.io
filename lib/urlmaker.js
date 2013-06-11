// urlmaker.js
//
// URLs just like Mama used to make
//
// Copyright 2011-2012, E14N https://e14n.com/
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

var url = require("url"),
    querystring = require("querystring");

var URLMaker = {
    hostname: null,
    port: 80,
    path: null,
    makeURL: function(relative, params) {
        var obj;

        if (!this.hostname) {
            throw new Error("No hostname");
        }

        obj = {
            protocol: (this.port === 443) ? "https:" : "http:",
            host: this.makeHost(),
            pathname: this.makePath(relative)
        };

        if (params) {
            obj.search = querystring.stringify(params);
        }

        return url.format(obj);
    },
    normalize: function(path) {
	if (!path || path.length === 0) {
	    return "";
	}
	if (path[0] != "/") {
	    path = "/" + path;
	}
	if (path[path.length-1] == "/") {
	    path = path.substr(0, path.length-1);
	}
	return path;
    },
    makeHost: function(hostname, port) {
	if (!hostname) {
	    hostname = this.hostname;
	    port     = this.port;
	}

	if (port == 80 || port == 443) {
	    return hostname;
	} else {
	    return hostname + ":" + port;
	}
    },
    makePath: function(relative) {
	var fullPath;
        if (relative.length === 0 || relative[0] != '/') {
            relative = "/" + relative;
        }

	if (!this.path) {
	    fullPath = relative;
	} else {
	    fullPath = this.normalize(this.path) + relative;
	}

	return fullPath;
    }
};

exports.URLMaker = URLMaker;
