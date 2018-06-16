// test/lib/email.js
//
// Some utilities for testing email behaviour
//
// Copyright 2012-2013, E14N https://e14n.com/
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

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    _ = require("lodash"),
    oauthutil = require("./oauth"),
    apputil = require("./app"),
    httputil = require("./http"),
    Step = require("step"),
    http = require("http"),
    newClient = oauthutil.newClient,
    accessToken = oauthutil.accessToken,
    register = oauthutil.register,
    registerEmail = oauthutil.registerEmail,
    setupApp = apputil.setupApp,
    setupAppConfig = apputil.setupAppConfig;

var oneEmail = function(smtp, addr, callback) {
    var data,
        timeoutID,
        isOurs = function(envelope) {
            return _.includes(envelope.rcptTo, addr);
        },
        starter = function(envelope) {
            if (isOurs(envelope)) {
                data = "";
                smtp.on("data", accumulator);
                smtp.once("end", ender);
            }
        },
        accumulator = function(envelope, chunk) {
            if (isOurs(envelope)) {
                data = data + chunk.toString();
            }
        },
        ender = function(envelope, cb) {
            var msg;
            if (isOurs(envelope)) {
                clearTimeout(timeoutID);
                smtp.removeListener("data", accumulator);
                msg = _.clone(envelope);
                msg.data = data;
                callback(null, msg);
                process.nextTick(function() {
                    cb(null);
                });
            }
        };

    timeoutID = setTimeout(function() {
        callback(new Error("Timeout waiting for email"), null);
    }, 5000);

    smtp.on("connect", console.error);
};

var confirmEmail = function(message, callback) {
    var urlre = /http:\/\/localhost:4815\/main\/confirm\/[a-zA-Z0-9_\-]+/,
        match = urlre.exec(message.data),
        url = (match.length > 0) ? match[0] : null;

    if (!url) {
        callback(new Error("No URL matched"), null);
        return;
    }

    http.get(url, function(res) {
        var body = "";
        res.on("data", function(chunk) {
            body += chunk;
        });
        res.on("end", function() {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                callback(new Error("Bad status code " + res.statusCode + ": " + body));
            } else {
                callback(null);
            }
        });
    }).on("error", function(err) {
        callback(err);
    });
};

exports.oneEmail = oneEmail;
exports.confirmEmail = confirmEmail;
