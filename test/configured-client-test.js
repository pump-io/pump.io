// configured-client-test.js
//
// Test the config.clients array
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
    Step = require("step"),
    _ = require("underscore"),
    httputil = require("./lib/http"),
    gj = httputil.getJSON,
    oauthutil = require("./lib/oauth"),
    setupAppConfig = oauthutil.setupAppConfig;

var CLIENT_ID_1 = "AAAAAAAAAAAAAAAAAAAA",
    CLIENT_SECRET_1 = "BBBBBBBBBBBBBBBBBBBB";

var suite = vows.describe("configured client ID");

suite.addBatch({
    "When we set up the app with a configured client": {
        topic: function() {
	    var config = {
		clients: [{
		    client_id: CLIENT_ID_1,
		    client_secret: CLIENT_SECRET_1
		}]
	    };
            setupAppConfig(config, this.callback);
        },
        teardown: function(app) {
            app.close();
        },
        "it works": function(err, app) {
            assert.ifError(err);
        },
	"and we request the user stream with the configured client credentials": {
	    topic: function() {
		var callback = this.callback,
		    cred = {
			consumer_key: CLIENT_ID_1,
			consumer_secret: CLIENT_SECRET_1
		    };

		gj("http://localhost:4815/api/users", cred, callback);
	    },
	    "it works": function(err, body, resp) {
		assert.ifError(err);
		assert.isObject(body);
	    }
	}
    }
});

suite["export"](module);
