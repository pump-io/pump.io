// app-email-test.js
//
// Test sending email through the app
//
// Copyright 2012, StatusNet Inc.
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
    simplesmtp = require("simplesmtp"),
    _ = require("underscore"),
    Step = require("step"),
    fs = require("fs"),
    path = require("path");

var suite = vows.describe("app email interface");

var oneEmail = function(smtp, addr, callback) {
    var data,
        isOurs = function(envelope) {
            return _.has(envelope, "to") &&
                _.isArray(envelope.to) &&
                _.contains(envelope.to, addr);
        },
        starter = function(envelope) {
            if (isOurs(envelope)) {
                data = "";
                smtp.on("data", accumulator);
                smtp.once("dataReady", ender);    
            }
        },
        accumulator = function(envelope, chunk) {
            if (isOurs(envelope)) {
                data = data + chunk.toString();
            }
        },
        ender = function(envelope, cb) {
            if (isOurs(envelope)) {
                smtp.removeListener("data", accumulator);
                callback(null, _.extend({data: data}, envelope));
            }
            cb(null, "ABC123");
        };

    smtp.on("startData", starter);
};

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch({
    "When we makeApp()": {
        topic: function() {
            var config = {port: 4815,
                          hostname: "localhost",
                          driver: tc.driver,
                          params: tc.params,
                          smtpserver: "localhost",
                          smtpport: 1623,
                          nologger: true
                         },
                smtp = simplesmtp.createServer({disableDNSValidation: true}),
                app,
                callback = this.callback;

            Step(
                function() {
                    smtp.listen(1623, this); 
                },
                function(err) {
                    if (err) throw err;
                    var makeApp = require("../lib/app").makeApp;
                    process.env.NODE_ENV = "test";
                    makeApp(config, this);
                },
                function(err, result) {
                    if (err) throw err;
                    app = result;
                    app.run(this);
                },
                function(err) {
                    if (err) {
                        callback(err, null, null);
                    } else {
                        callback(null, app, smtp);
                    }
                }
            );
        },
        teardown: function(app, smtp) {
            if (app && app.close) {
                app.close();
            }
            if (smtp) {
                smtp.end(function(err) {});
            }
        },
        "it works": function(err, app, smtp) {
            assert.ifError(err);
            assert.isObject(app);
            assert.isObject(smtp);
        },
        "app has the sendEmail() method": function(err, app) {
            assert.isFunction(app.run);
        },
        "and we send an email": {
            topic: function(app, smtp) {
                var addr = "fakeuser@email.localhost",
                    msg = {
                        to: addr,
                        subject: "Test email",
                        text: "Hello, world!"
                    },
                    callback = this.callback;

                Step(
                    function() {
                        var cb1 = this.parallel(),
                            cb2 = this.parallel();

                        oneEmail(smtp, addr, function(err, data) {
                            cb1(err, data);
                        });
                        app.sendEmail(msg, function(err, message) {
                            cb2(err, message);
                        });
                    },
                    function(err, data, message) {
                        if (err) {
                            callback(err, null, null);
                        } else {
                            callback(null, data, message);
                        }
                    }
                );
            },
            "it works": function(err, data, message) {
                assert.ifError(err);
                assert.isObject(data);
                assert.isObject(message);
            },
            "client results are correct": function(err, data, message) {
                assert.ifError(err);
                assert.isObject(data);
                assert.isObject(message);
                assert.equal(message.header.from, "no-reply@localhost");
                assert.equal(message.header.to, "fakeuser@email.localhost");
                assert.equal(message.header.subject, "Test email");
                assert.equal(message.text, "Hello, world!");
            },
            "server results are correct": function(err, data, message) {
                assert.ifError(err);
                assert.isObject(data);
                assert.isObject(message);
                assert.equal(data.from, "no-reply@localhost");
                assert.lengthOf(data.to, 1);
                assert.include(data.to, "fakeuser@email.localhost");
            }
        }
    }
});

suite["export"](module);