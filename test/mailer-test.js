// mailer-test.js
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

var assert = require("assert"),
    vows = require("vows"),
    _ = require("underscore"),
    Logger = require("bunyan"),
    simplesmtp = require("simplesmtp"),
    emailutil = require("./lib/email"),
    Step = require("step"),
    oneEmail = emailutil.oneEmail;

var suite = vows.describe("mailer module interface").addBatch({
    "When we set up a dummy server": {
        topic: function() {
            var callback = this.callback,
                smtp = simplesmtp.createServer({disableDNSValidation: true});

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
                smtp.end(function(err) {});
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
                            smtpuser: null,
                            smtppass: null,
                            smtpserver: "localhost",
                            smtpport: 1623,
                            smtpusessl: false,
                            smtpusetls: true,
                            hostname: "pump.localhost"
                        },
                        callback = this.callback;

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
                                oneEmail(smtp, message.to, this.parallel());
                                Mailer.sendEmail(message, this.parallel());
                            },
                            callback
                        );
                    },
                    "it works": function(err, received, sent) {
                        assert.ifError(err);
                        assert.isObject(received);
                        assert.isObject(sent);
                    }
                }
            }
        }
    }
});

suite["export"](module);
