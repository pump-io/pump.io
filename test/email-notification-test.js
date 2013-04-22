// email-notification-test.js
//
// Test email notifications
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
    simplesmtp = require("simplesmtp"),
    oauthutil = require("./lib/oauth"),
    httputil = require("./lib/http"),
    emailutil = require("./lib/email"),
    Browser = require("zombie"),
    Step = require("step"),
    http = require("http"),
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    registerEmail = oauthutil.registerEmail,
    setupApp = oauthutil.setupApp,
    setupAppConfig = oauthutil.setupAppConfig,
    oneEmail = emailutil.oneEmail,
    confirmEmail = emailutil.confirmEmail;

var userCred = function(cl, user) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: user.token,
        token_secret: user.secret
    };
};

var suite = vows.describe("email notifications");

var registerAndConfirm = function(smtp, cl, email, nickname, password, callback) {

    var user;

    Step(
        function() {
            oneEmail(smtp, email, this.parallel());
            registerEmail(cl, nickname, password, email, this.parallel());
        },
        function(err, message, results) {
            if (err) throw err;
            user = results;
            confirmEmail(message, this);
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, user);
            }
        }
    );
};

suite.addBatch({
    "When we set up the app": {
        topic: function() {
            var callback = this.callback,
                smtp = simplesmtp.createServer({disableDNSValidation: true});
            Step(
                function() {
                    smtp.listen(1623, this); 
                },
                function(err) {
                    if (err) throw err;
                    setupAppConfig({hostname: "localhost",
                                    port: 4815,
                                    requireEmail: true,
                                    smtpserver: "localhost",
                                    smtpport: 1623
                                   },
                                   this);
                },
                function(err, app) {
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
        },
        "and we get a new client": {
            topic: function(app, smtp) {
                newClient(this.callback);
            },
            "it works": function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
            },
            "and we register two users": {
                topic: function(cl, app, smtp) {
                    Step(
                        function() {
                            registerAndConfirm(smtp, cl, "tony@pump.test", "tony", "you*can*tell", this.parallel());
                            registerAndConfirm(smtp, cl, "stephanie@pump.test", "stephanie", "luv2dance", this.parallel());
                        },
                        this.callback
                    );
                },
                "it works": function(err, tony, stephanie) {
                    assert.ifError(err);
                    assert.isObject(tony);
                    assert.isObject(stephanie);
                },
                "and one user sends the other a message": {
                    topic: function(tony, stephanie, cl, app, smtp) {
                        var callback = this.callback,
                            url = "http://localhost:4815/api/user/tony/feed",
                            cred = userCred(cl, tony),
                            act = {
                                verb: "post",
                                to: [stephanie.profile],
                                object: {
                                    objectType: "note",
                                    content: "All you need is a salad bowl, and a potato masher."
                                }
                            };

                        Step(
                            function() {
                                oneEmail(smtp, "stephanie@pump.test", this.parallel());
                                httputil.postJSON(url, cred, act, this.parallel());
                            },
                            function(err, message, body, response) {
                                callback(err, message, body);
                            }
                        );
                    },
                    "it works": function(err, message, body) {
                        assert.ifError(err);
                        assert.isObject(message);
                        assert.isObject(body);
                    }
                }
            }
        }
    }
});

suite["export"](module);
