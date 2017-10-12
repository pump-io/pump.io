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

"use strict";

var assert = require("assert"),
    vows = require("vows"),
    _ = require("lodash"),
    simplesmtp = require("simplesmtp"),
    oauthutil = require("./lib/oauth"),
    apputil = require("./lib/app"),
    httputil = require("./lib/http"),
    emailutil = require("./lib/email"),
    Browser = require("zombie"),
    Step = require("step"),
    http = require("http"),
    newClient = oauthutil.newClient,
    register = oauthutil.register,
    registerEmail = oauthutil.registerEmail,
    withAppSetup = apputil.withAppSetup,
    setupAppConfig = apputil.setupAppConfig,
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
                        if (err && err.statusCode === 400) {
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
                "the message include same register email": function(err, message, user) {
                    assert.include(message.to, user.email_pending);
                },
                "the email is not include but has pending email": function(err, message, user) {
                    assert.isFalse(_.has(user, "email"));
                    assert.isTrue(_.has(user, "email_pending"));
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
                            assert.isFalse(_.has(user, "email"));
                            assert.isFalse(_.has(user, "email_pending"));
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
                            assert.isFalse(_.has(doc, "email"));
                            assert.isFalse(_.has(doc, "email_pending"));
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
                            assert.include(user, "email");
                            assert.notInclude(user, "email_pending");
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
                                return (user.nickname === "jj");
                            });
                            assert.lengthOf(target, 1);
                            assert.isObject(target[0]);
                            assert.isFalse(_.has(target[0], "email"));
                            assert.isFalse(_.has(target[0], "email_pending"));
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
                                return (user.nickname === "jj");
                            });
                            assert.lengthOf(target, 1);
                            assert.isObject(target[0]);
                            assert.isFalse(_.has(target[0], "email"));
                            assert.isFalse(_.has(target[0], "email_pending"));
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
                                return (user.nickname === "jj");
                            });
                            assert.lengthOf(target, 1);
                            assert.isObject(target[0]);
                            assert.isTrue(_.has(target[0], "email"));
                            assert.isFalse(_.has(target[0], "email_pending"));
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
                "the message include same register email": function(err, message, user) {
                    assert.include(message.to, user.email_pending);
                },
                "the email is not included but has email pending": function(err, message, user) {
                    assert.isFalse(_.has(user, "email"));
                    assert.isTrue(_.has(user, "email_pending"));
                },
                "and we fetch the user with client credentials without confirmation": {
                    topic: function(message, user, cl) {
                        var cred = {
                            consumer_key: cl.client_id,
                            consumer_secret: cl.client_secret
                        };
                        httputil.getJSON("http://localhost:4815/api/user/bookman", cred, this.callback);
                    },
                    "it works": function(err, user, response) {
                        assert.ifError(err);
                        assert.isObject(user);
                    },
                    "the email address is not included but has email pending": function(err, user, response) {
                        assert.isFalse(_.has(user, "email"));
                        assert.isTrue(_.has(user, "email_pending"));
                    }
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
                                if (err && err.statusCode && err.statusCode === 403) {
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
                },
                "and we PUT the user email with user credentials without confirmation": {
                    topic: function(message, user, cl, app, smtp) {
                        var callback = this.callback,
                            cred = {
                                consumer_key: cl.client_id,
                                consumer_secret: cl.client_secret,
                                token: user.token,
                                token_secret: user.secret
                            };

                        Step(
                            function() {
                                oneEmail(smtp, "othergreatemail@pump.io", this.parallel());
                                httputil.putJSON("http://localhost:4815/api/user/bookman", cred, _.extend({}, user, {
                                    email: "othergreatemail@pump.io"
                                }), this.parallel());
                            },
                            callback
                        );
                    },
                    "it works": function(err, message, user) {
                        assert.ifError(err);
                        assert.isObject(message);
                        assert.isObject(user);
                    },
                    "the email is email pending": function(err, message, user) {
                        assert.isFalse(_.has(user, "email"));
                        assert.isTrue(_.has(user, "email_pending"));
                        assert.include(message.to, "othergreatemail@pump.io");
                    },
                    "and we confirm email and GET user data with user credentials for the same user": {
                        topic: function(newMessage, newUser, message, user, cl) {
                            var cb = this.callback,
                                cred = {
                                    consumer_key: cl.client_id,
                                    consumer_secret: cl.client_secret,
                                    token: user.token,
                                    token_secret: user.secret
                                };

                            Step(
                                function() {
                                    confirmEmail(newMessage, this);
                                },
                                function(err) {
                                    if (err) throw err;
                                    httputil.getJSON("http://localhost:4815/api/user/bookman",
                                                     cred, this);
                                }, cb
                            );
                        },
                        "it works": function(err, user) {
                            assert.ifError(err);
                            assert.isObject(user);
                            assert.include(user, "email");
                            assert.notInclude(user, "email_pending");
                            assert.equal(user.email, "othergreatemail@pump.io");
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
