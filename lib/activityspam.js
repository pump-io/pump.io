// activityspam.js
//
// tests activity for spam against a spam server
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

var _ = require("underscore"),
    Step = require("step"),
    OAuth = require("oauth-evanp").OAuth,
    HTTPError = require("./httperror").HTTPError,
    version = require("./version").version;

var host,
    clientID,
    clientSecret,
    oa;

var ActivitySpam = {

    init: function(params) {
        host = params.host || "https://spamicity.info";
        clientID = params.clientID;
        clientSecret = params.clientSecret;
        oa = new OAuth(null,
                       null,
                       clientID,
                       clientSecret,
                       "1.0",
                       null,
                       "HMAC-SHA1",
                       null, // nonce size; use default
                       {"User-Agent": "pump.io/"+version});
    },

    test: function(act, callback) {

        var json;

        try {
            json = JSON.stringify(act);
        } catch (e) {
            callback(e, null);
            return;
        }

        if (!oa) {
            // With no
            callback(null, null, null);
            return;
        }
        
        Step(
            function() {
                oa.post(host + "/is-this-spam", null, null, json, "application/json", this);
            },
            function(err, body, resp) {
                var obj;
                if (err) throw err;
                if (resp.statusCode >= 400 && resp.statusCode < 600) {
                    throw new HTTPError(body, resp.statusCode);
                }
                if (!resp.headers || 
                    !resp.headers["content-type"] || 
                    resp.headers["content-type"].substr(0, "application/json".length) != "application/json") {
                    throw new Error("Incorrect response type");
                }
                // Throws an exception
                obj = JSON.parse(body);
                if (!_.isBoolean(obj.isSpam) || !_.isNumber(obj.probability)) {
                    throw new Error("Unexpected response content");
                }
                this(null, obj.isSpam, obj.probability);
            },
            callback
        );
    }
};

module.exports = ActivitySpam;
