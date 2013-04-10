// register-email-required-test.js
//
// Test behavior when email registration is required
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

var makeCred = function(cl, pair) {
    return {
        consumer_key: cl.client_id,
        consumer_secret: cl.client_secret,
        token: pair.token,
        token_secret: pair.token_secret
    };
};

var suite = vows.describe("registration with email");

// A batch to test some of the layout basics

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
            "and we try to register a user with no email address": {
                topic: function(cl, app, smtp) {
                    var callback = this.callback;
                    register(cl, "florida", "good*times", function(err, result, response) {
                        if (err && err.statusCode == 400) {
                            callback(null);
                        } else {
                            callback(new Error("Unexpected success"));
                        }
                    });
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and we register a user with an email address": {
                topic: function(cl, app, smtp) {
                    var callback = this.callback;
                    Step(
                        function() {
                            oneEmail(smtp, "jamesjr@pump.test", this.parallel());
                            registerEmail(cl, "jj", "dyn|o|mite!", "jamesjr@pump.test", this.parallel());
                        },
                        callback
                    );
                        
                },
                "it works correctly": function(err, message, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                    assert.isObject(message);
                },
                "the email is not included": function(err, message, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                    assert.isFalse(_.include(user, "email"));
                },
                "and we confirm the email address": {
                    topic: function(message, user, cl) {
                        confirmEmail(message, this.callback);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we fetch the user with client credentials": {
                        topic: function(message, user, cl) {
                            var cred = {
                                consumer_key: cl.client_id,
                                consumer_secret: cl.client_secret
                            };
                            httputil.getJSON("http://localhost:4815/api/user/jj", cred, this.callback);
                        },
                        "it works": function(err, user, response) {
                            assert.ifError(err);
                            assert.isObject(user);
                        },
                        "the email address is not included": function(err, user, response) {
                            assert.ifError(err);
                            assert.isObject(user);
                            assert.isFalse(_.has(user, "email"));
                        }
                    },
                    "and we fetch the user with user credentials for a different user": {
                        topic: function(message, jj, cl, app, smtp) {
                            var callback = this.callback,
                                james;

                            Step(
                                function() {
                                    oneEmail(smtp, "jamessr@pump.test", this.parallel());
                                    registerEmail(cl, "james", "work|hard", "jamessr@pump.test", this.parallel());
                                },
                                function(err, message, results) {
                                    if (err) throw err;
                                    james = results;
                                    confirmEmail(message, this);
                                },
                                function(err) {
                                    if (err) throw err;
                                    var cred = {
                                        consumer_key: cl.client_id,
                                        consumer_secret: cl.client_secret,
                                        token: james.token,
                                        token_secret: james.secret
                                    };
                                    httputil.getJSON("http://localhost:4815/api/user/jj", cred, this);
                                },
                                function(err, doc, response) {
                                    if (err) {
                                        callback(err, null);
                                    } else {
                                        callback(null, doc);
                                    }
                                }
                            );
                        },
                        "it works": function(err, doc) {
                            assert.ifError(err);
                            assert.isObject(doc);
                        },
                        "the email address is not included": function(err, doc) {
                            assert.ifError(err);
                            assert.isObject(doc);
                            assert.isFalse(_.has(doc, "email"));
                        }
                    },
                    "and we fetch the user with user credentials for the same user": {
                        topic: function(message, user, cl) {
                            var cred = {
                                consumer_key: cl.client_id,
                                consumer_secret: cl.client_secret,
                                token: user.token,
                                token_secret: user.secret
                            };

                            httputil.getJSON("http://localhost:4815/api/user/jj", cred, this.callback);
                        },
                        "it works": function(err, user) {
                            assert.ifError(err);
                            assert.isObject(user);
                        },
                        "the email address is included": function(err, user) {
                            assert.ifError(err);
                            assert.isObject(user);
                            assert.include(user, "email");
                        }
                    },
                    "and we fetch the user feed with client credentials": {
                        topic: function(message, user, cl) {
                            var cred = {
                                consumer_key: cl.client_id,
                                consumer_secret: cl.client_secret
                            };
                            httputil.getJSON("http://localhost:4815/api/users", cred, this.callback);
                        },
                        "it works": function(err, feed, response) {
                            assert.ifError(err);
                            assert.isObject(feed);
                        },
                        "the email address is not included": function(err, feed, response) {
                            var target;
                            assert.ifError(err);
                            assert.isObject(feed);
                            target = _.filter(feed.items, function(user) {
                                return (user.nickname == "jj");
                            });
                            assert.lengthOf(target, 1);
                            assert.isObject(target[0]);
                            assert.isFalse(_.has(target[0], "email"));
                        }
                    },
                    "and we fetch the user feed with user credentials for a different user": {
                        topic: function(message, jj, cl, app, smtp) {
                            var callback = this.callback,
                                thelma;

                            Step(
                                function() {
                                    oneEmail(smtp, "thelma@pump.test", this.parallel());
                                    registerEmail(cl, "thelma", "dance4fun", "thelma@pump.test", this.parallel());
                                },
                                function(err, message, results) {
                                    if (err) throw err;
                                    thelma = results;
                                    confirmEmail(message, this);
                                },
                                function(err) {
                                    if (err) throw err;
                                    var cred = {
                                        consumer_key: cl.client_id,
                                        consumer_secret: cl.client_secret,
                                        token: thelma.token,
                                        token_secret: thelma.secret
                                    };
                                    httputil.getJSON("http://localhost:4815/api/users", cred, this);
                                },
                                function(err, doc, response) {
                                    if (err) {
                                        callback(err, null);
                                    } else {
                                        callback(null, doc);
                                    }
                                }
                            );
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assert.isObject(feed);
                        },
                        "the email address is not included": function(err, feed) {
                            var target;
                            assert.ifError(err);
                            assert.isObject(feed);
                            target = _.filter(feed.items, function(user) {
                                return (user.nickname == "jj");
                            });
                            assert.lengthOf(target, 1);
                            assert.isObject(target[0]);
                            assert.isFalse(_.has(target[0], "email"));
                        }
                    },
                    "and we fetch the user feed with user credentials for the same user": {
                        topic: function(message, user, cl) {
                            var cred = {
                                consumer_key: cl.client_id,
                                consumer_secret: cl.client_secret,
                                token: user.token,
                                token_secret: user.secret
                            };

                            httputil.getJSON("http://localhost:4815/api/users", cred, this.callback);
                        },
                        "it works": function(err, feed) {
                            assert.ifError(err);
                            assert.isObject(feed);
                        },
                        "the email address is included": function(err, feed) {
                            var target;
                            assert.ifError(err);
                            assert.isObject(feed);
                            target = _.filter(feed.items, function(user) {
                                return (user.nickname == "jj");
                            });
                            assert.lengthOf(target, 1);
                            assert.isObject(target[0]);
                            assert.isTrue(_.has(target[0], "email"));
                        }
                    }
                }
            },
            "and we register another user with an email address": {
                topic: function(cl, app, smtp) {
                    var callback = this.callback;
                    Step(
                        function() {
                            oneEmail(smtp, "bookman@pump.test", this.parallel());
                            registerEmail(cl, "bookman", "i*am*super.", "bookman@pump.test", this.parallel());
                        },
                        callback
                    );
                        
                },
                "it works correctly": function(err, message, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                    assert.isObject(message);
                },
                "the email is not included": function(err, message, user) {
                    assert.ifError(err);
                    assert.isObject(user);
                    assert.isFalse(_.include(user, "email"));
                },
                "and we fetch the user with user credentials without confirmation": {
                    topic: function(message, user, cl) {
                        var callback = this.callback,
                            cred = {
                                consumer_key: cl.client_id,
                                consumer_secret: cl.client_secret,
                                token: user.token,
                                token_secret: user.secret
                            };

                        Step(
                            function() {
                                httputil.getJSON("http://localhost:4815/api/user/bookman", cred, this);
                            },
                            function(err, body, resp) {
                                if (err && err.statusCode && err.statusCode == 403) {
                                    callback(null);
                                } else if (err) {
                                    callback(err);
                                } else {
                                    callback(new Error("Unexpected success"));
                                }
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    }
                }
            }
        }
    }
});

suite["export"](module);
