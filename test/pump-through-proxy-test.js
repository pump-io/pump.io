// pump-through-proxy-test.js
//
// Test running the app via a proxy
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

var assert = require("assert"),
    vows = require("vows"),
    fs = require("fs"),
    path = require("path"),
    express = require("express"),
    databank = require("databank"),
    _ = require("underscore"),
    Step = require("step"),
    http = require("http"),
    https = require("https"),
    urlparse = require("url").parse,
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth");

var suite = vows.describe("proxy pump through another server");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch({
    "When we makeApp()": {
        topic: function() {
            var config = {port: 4815,
                          hostname: "localhost",
			  urlPath: "pumpio",
			  urlPort: 2342,
                          driver: tc.driver,
                          params: tc.params,
                          nologger: true,
                          sockjs: false
                         };

            process.env.NODE_ENV = "test";
	    
	    Step(
		function() {
		    oauthutil.setupAppConfig(config, this.parallel());
		    httputil.proxy({front: {hostname: "localhost",
					    port: 2342,
					    path: "/pumpio"},
				    back: {hostname: "localhost",
					   port: 4815}},
				   this.parallel());
		},
		this.callback
	    );
        },
        "it works": function(err, app, proxy) {
            assert.ifError(err);
            assert.isObject(app);
            assert.isObject(proxy);
        },
        teardown: function(app, proxy) {
            if (app && _.isFunction(app.close)) {
                app.close();
            }
	    if (proxy && _.isFunction(proxy.close)) {
		proxy.close();
	    }
	},
        "and we GET the root through the proxy": {
            topic: function() {
                var callback = this.callback,
                req;

                req = http.get("http://localhost:2342/pumpio/", function(res) {
		    var body = "";
		    res.on("data", function(chunk) {
			body = body + chunk;
		    });
		    res.on("end", function() {
			callback(null, res, body);
		    });
		    res.on("error", function(err) {
			callback(err, null, null);
		    });
                });
                req.on("error", function(err) {
                    callback(err, null);
                });
            },
            "it works": function(err, res, body) {
                assert.ifError(err);
            },
            "it has the correct results": function(err, res, body) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
		assert.isObject(res.headers);
		assert.include(res.headers, "content-type");
		assert.equal("text/html", res.headers["content-type"].substr(0, "text/html".length));
            }
        },
	"and we register a client": {
	    topic: function() {
		oauthutil.newClient("localhost", 2342, "pumpio", this.callback);
	    },
	    "it works": function(err, cl) {
		assert.ifError(err);
		assert.isObject(cl);
	    }
	}
    }
});

suite["export"](module);
