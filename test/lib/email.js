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
    smtpserver = require("smtp-server"),
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

var SMTPServer = smtpserver.SMTPServer,
    emailAccumulator = [];

var createSmtpServer = function(options) {
    return new SMTPServer(_.extend({
        onData: onDataEmail,
        onAuth(auth, session, callback) {
            callback(null, { user: auth.username });
        }
    }, options));
};

var oneEmail = function(addr, callback) {
    var onEmailCallback = function(err, msg) {
        clearTimeout(timeoutID);
        callback(err, msg);
    }, timeoutID = setTimeout(function() {
        onEmailCallback(new Error("Timeout waiting for email"), null);
    }, 5000);

    emailAccumulator.push({ addr, callback: onEmailCallback });
};

var onDataEmail = function(stream, session, callback) {
    var data,
        timeoutID,
        envelope = session.envelope,
        emailIndex = emailAccumulator.findIndex((email) => {
            return envelope.rcptTo.find((to) => (to.address === email.addr));
        }),
        accumulator = function(chunk) {
            if (emailIndex > -1) {
                data = data + chunk.toString();
            }
        },
        ender = function() {
            var msg,
                emailData = emailAccumulator[emailIndex];

            if (emailData) {
                msg = _.clone(envelope);
                msg.data = data;
                if (typeof emailData.callback === "function") {
                    emailData.callback(null, msg);
                }
                emailAccumulator.splice(emailIndex, 1);
                process.nextTick(function() {
                    callback(null, emailData);
                });
            }
        };

    stream.on("data", accumulator);
    stream.on("end", ender);
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

exports.createSmtpServer = createSmtpServer;
exports.oneEmail = oneEmail;
exports.onDataEmail = onDataEmail;
exports.confirmEmail = confirmEmail;
