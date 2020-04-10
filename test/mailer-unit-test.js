// mailer-unit-test.js
//
// Test the mailer tool
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

// XXX should this run with the "fast" unit tests since it sets up SMTP?

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    _ = require("lodash"),
    Logger = require("bunyan"),
    Step = require("step"),
    emailutil = require("./lib/email"),
    configutil = require("../lib/config"),
    createSmtpServer = emailutil.createSmtpServer,
    oneEmail = emailutil.oneEmail;

var suite = vows.describe("mailer module interface").addBatch({
    "When we set up a dummy server": {
        topic: function() {
            var callback = this.callback,
                smtp = createSmtpServer({
                    maxClients: 100,
                    disabledCommands: ["AUTH"]
                });

            smtp.listen(1623, function(err) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, smtp);
                }
            });
        },
        "it works": function(err, smtp) {
            assert.ifError(err);
            assert.isObject(smtp);
        },
        "teardown": function(smtp) {
            if (smtp) {
                smtp.close();
            }
        },
        "and we require the mailer module": {
            topic: function() {
                return require("../lib/mailer");
            },
            "it works": function(Mailer) {
                assert.isObject(Mailer);
            },
            "it has a setup() method": function(Mailer) {
                assert.isFunction(Mailer.setup);
            },
            "it has a sendEmail() method": function(Mailer) {
                assert.isFunction(Mailer.sendEmail);
            },
            "and we setup the Mailer module to use the dummy": {
                topic: function(Mailer) {
                    var log = new Logger({name: "mailer-test",
                                          streams: [{path: "/dev/null"}]}),
                        config = {
                            secret: "real secret",
                            smtpuser: null,
                            smtppass: null,
                            smtpserver: "localhost",
                            smtpport: 1623,
                            smtpusessl: false,
                            smtpusetls: true,
                            hostname: "pump.localhost"
                        },
                        callback = this.callback;

                    config = configutil.buildConfig(config);

                    try {
                        Mailer.setup(config, log);
                        callback(null);
                    } catch (err) {
                        callback(err);
                    }
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and we send an email message": {
                    topic: function(Mailer, smtp) {
                        var callback = this.callback,
                            message = {
                                to: "123@fakestreet.example",
                                subject: "Please report for arrest",
                                text: "We are coming to your house to arrest you"
                            };

                        Step(
                            function() {
                                oneEmail(message.to, this.parallel());
                                Mailer.sendEmail(message, this.parallel());
                            },
                            callback
                        );
                    },
                    "it works": function(err, received, sent) {
                        assert.ifError(err);
                        assert.isObject(received);
                        assert.isObject(sent);
                    },
                    "and we send a bunch of email messages": {
                        topic: function(received, sent, Mailer, smtp) {
                            var callback = this.callback;

                            Step(
                                function() {
                                    var i,
                                        rgroup = this.group(),
                                        sgroup = this.group(),
                                        to,
                                        message;
                                    for (i = 1; i < 51; i++) {
                                        to = (123+i) + "@fakestreet.example";
                                        message = {
                                            to: to,
                                            subject: "Have you seen the perp?",
                                            text: "We sent an email and the perp ran."
                                        };
                                        oneEmail(to, rgroup());
                                        Mailer.sendEmail(message, sgroup());
                                    }
                                },
                                callback
                            );
                        },
                        "it works": function(err, receiveds, sents) {
                            assert.ifError(err);
                            assert.isArray(receiveds);
                            assert.isArray(sents);
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
