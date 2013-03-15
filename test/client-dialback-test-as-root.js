// client-dialback-test.js
//
// Test the client registration API
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

var assert = require("assert"),
    vows = require("vows"),
    Step = require("step"),
    querystring = require("querystring"),
    _ = require("underscore"),
    httputil = require("./lib/http"),
    oauthutil = require("./lib/oauth"),
    dialbackApp = require("./lib/dialback").dialbackApp,
    setupApp = oauthutil.setupApp;

var suite = vows.describe("client registration with dialback");

var dbreg = function(id, token, ts, params, callback) {
    var URL = "http://localhost:4815/api/client/register",
        requestBody = querystring.stringify(params);

    httputil.dialbackPost(URL, id, token, ts, requestBody, "application/x-www-form-urlencoded", callback);
};

var assoc = function(id, token, ts) {
    return function() {
        var callback = this.callback;
        if (!ts) ts = Date.now();
        dbreg(id,
              token,
              ts,
              {type: "client_associate"},
              callback);
    };
};

var assocFail = function(id, token, ts) {
    return {
        topic: assoc(id, token, ts),
        "it fails correctly": function(err, res, body) {
            assert.ifError(err);
            assert.equal(res.statusCode, 401);
        }
    };
};

var assocSucceed = function(id, token, ts) {
    return {
        topic: assoc(id, token, ts),
        "it works": function(err, res, body) {
            assert.ifError(err);
            assert.greater(res.statusCode, 199);
            assert.lesser(res.statusCode, 300);
        },
        "it looks right": function(err, res, body) {
            var parsed;
            assert.ifError(err);
            assert.greater(res.statusCode, 199);
            assert.lesser(res.statusCode, 300);
            parsed = JSON.parse(body);
            assert.include(parsed, "client_id");
            assert.include(parsed, "client_secret");
            assert.include(parsed, "expires_at");
        }
    };
};

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            var app, callback = this.callback;
            Step(
                function() {
                    setupApp(this);
                },
                function(err, result) {
                    if (err) throw err;
                    app = result;
                    dialbackApp(80, "dialback.localhost", this);
                },
                function(err, dbapp) {
                    if (err) {
                        callback(err, null, null);
                    } else {
                        callback(err, app, dbapp);
                    }
                }
            );
        },
        teardown: function(app, dbapp) {
            app.close();
            dbapp.close();
        },
        "it works": function(err, app, dbapp) {
            assert.ifError(err);
        },
        "and we try to register with an invalid host": 
        assocFail("social.invalid", "VALID1"),
        "and we try to register with an invalid webfinger domain":
        assocFail("alice@social.invalid", "VALID2"),
        "and we try to register with an invalid webfinger": 
        assocFail("invalid@dialback.localhost", "VALID3"),
        "and we try to register with a valid webfinger and invalid token": 
        assocFail("valid@dialback.localhost", "INVALID"),
        "and we try to register with a valid webfinger and valid token and out-of-bounds date":
        assocFail("valid1@dialback.localhost", "VALID4", Date.now() - 600000),
        "and we try to register with a valid host and invalid token": 
        assocFail("dialback.localhost", "INVALID"),
        "and we try to register with a valid host and valid token and out-of-bounds date":
        assocFail("dialback.localhost", "VALID5", Date.now() - 600000),
        "and we try to register with a valid webfinger and valid token":
        assocSucceed("valid2@dialback.localhost", "VALID6"),
        "and we try to register with a valid host and valid token":
        assocSucceed("dialback.localhost", "VALID7")
    }
});

suite["export"](module);
