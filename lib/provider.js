// OAuthDataProvider for activity spam server
//
// Copyright 2011, 2012 StatusNet Inc.
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

var NoSuchThingError = require('databank').NoSuchThingError,
    _ = require('underscore'),
    url = require('url'),
    Step = require('step'),
    User = require('./model/user').User,
    RequestToken = require('./model/requesttoken').RequestToken,
    AccessToken = require('./model/accesstoken').AccessToken,
    Nonce = require('./model/nonce').Nonce,
    Client = require('./model/client').Client;

var TIMELIMIT = 300; // +/- 5 min seems pretty generous
var REQUESTTOKENTIMEOUT = 600; // 10 min, also pretty generous

var Provider = function() {
};

_.extend(Provider.prototype, {
    previousRequestToken: function(token, callback) {
        AccessToken.search({request_token: token}, function(err, ats) {
            if (err) {
                callback(err, null);
            } else if (ats.length > 0) {
                callback(new Error("Token has been used"), null);
            } else {
                callback(null, token);
            }
        });
    },
    tokenByConsumer: function(consumerKey, callback) {
        Client.get(consumerKey, function(err, client) {
            if (err) {
                callback(err, null);
            } else {
                RequestToken.search({consumer_key: client.consumer_key}, function(err, rts) {
                    if (rts.length > 0) {
                        callback(null, rts[0]);
                    } else {
                        callback(new Error("No RequestToken for that consumer_key"), null);
                    }
                });
            }
        });
    },
    tokenByTokenAndConsumer: function(token, consumerKey, callback) {
        RequestToken.get(token, function(err, rt) {
            if (err) {
                callback(err, null);
            } else if (rt.consumer_key !== consumerKey) {
                callback(new Error("Consumer key mismatch"), null);
            } else {
                callback(null, rt);
            }
        });
    },
    applicationByConsumerKey: function(consumerKey, callback) {
        Client.get(consumerKey, callback);
    },
    fetchAuthorizationInformation: function(username, token, callback) {
        RequestToken.get(token, function(err, rt) {
            if (err) {
                callback(err, null, null);
            } else if (!_(rt).has('username') || rt.username !== username) {
                callback(new Error("Request token not associated with username '" + username + "'"), null, null);
            } else {
                Client.get(rt.consumer_key, function(err, client) {
                    if (err) {
                        callback(err, null, null);
                    } else {
                        callback(null, client, rt);
                    }
                });
            }
        });
    },
    validToken: function(accessToken, callback) {
        AccessToken.get(accessToken, callback);
    },
    tokenByTokenAndVerifier: function(token, verifier, callback) {
        RequestToken.get(token, function(err, rt) {
            if (err) {
                callback(err, null);
            } else if (rt.verifier !== verifier) {
                callback(new Error("Wrong verifier"), null);
            } else {
                callback(null, rt);
            }
        });
    },
    validateNotReplayClient: function(consumerKey, accessToken, timestamp, nonce, callback) {
        var now = Math.floor(Date.now()/1000),
            ts;

        try {
            ts = parseInt(timestamp, 10);
        } catch (err) {
            callback(err, null);
            return;
        }

        if (Math.abs(ts - now) > TIMELIMIT) {
            callback(null, false);
            return;
        }

        Step(
            function() {
                Client.get(consumerKey, this);
            },
            function(err, client) {
                if (err) throw err;
                if (!accessToken) {
                    this(null, null);
                } else {
                    AccessToken.get(accessToken, this);
                }
            },
            function(err, at) {
                if (err) throw err;
                if (at && at.consumer_key !== consumerKey) {
                    throw new Error("consumerKey and accessToken don't match");
                }
                Nonce.seenBefore(consumerKey, accessToken, nonce, timestamp, this);
            },
            function(err, seen) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, !seen);
                }
            }
        );
    },
    userIdByToken: function(token, callback) {
        AccessToken.get(token, function(err, at) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, {id: at.username});
            }
        });
    },
    authenticateUser: function(username, password, oauthToken, callback) {
        User.checkCredentials(username, password, function(err, user) {
            if (err) {
                callback(err, null);
                return;
            }
            RequestToken.get(oauthToken, function(err, rt) {
                if (err) {
                    callback(err, null);
                    return;
                }
                if (rt.username && rt.username !== username) {
                    callback(new Error("Token already associated with a different user"), null);
                    return;
                }
                rt.authenticated = true;
                rt.save(function(err, rt) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, rt);
                    }
                });
            });
        });
    },
    associateTokenToUser: function(username, token, callback) {
        RequestToken.get(token, function(err, rt) {
            if (err) {
                callback(err, null);
                return;
            }
            if (rt.username && rt.username !== username) {
                callback(new Error("Token already associated"), null);
                return;
            }
            rt.update({username: username}, function(err, rt) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, rt);
                }
            });
        });
    },
    generateRequestToken: function(oauthConsumerKey, oauthCallback, callback) {

        var parts = url.parse(oauthCallback);

        if (!parts.host || !parts.protocol || (parts.protocol !== 'http:' && parts.protocol !== 'https:')) {
            callback(new Error("Invalid callback URL"), null);
            return;
        }

        Client.get(oauthConsumerKey, function(err, client) {
            if (err) {
                callback(err, null);
                return;
            }
            var props = {consumer_key: oauthConsumerKey,
                         callback: oauthCallback};
            RequestToken.create(props, callback);
        });
    },
    generateAccessToken: function(oauthToken, callback) {
        RequestToken.get(oauthToken, function(err, rt) {
            var props;
            if (err) {
                callback(err, null);
            } else if (!rt.username) {
                callback(new Error("Request token not associated"), null);
            } else if (rt.access_token) {
                // XXX: search AccessToken instead...?
                callback(new Error("Request token already used"), null);
            } else {
                props = {consumer_key: rt.consumer_key,
                         request_token: rt.token,
                         username: rt.username};
                AccessToken.create(props, function(err, at) {
                    if (err) {
                        callback(err, null);
                    } else {
                        // XXX: delete...?
                        rt.update({access_token: at.access_token}, function(err, rt) {
                            if (err) {
                                callback(err, null);
                            } else {
                                callback(null, at);
                            }
                        });
                    }
                });
            }
        });
    },
    cleanRequestTokens: function(consumerKey, callback) {
        RequestToken.search({consumer_key: consumerKey}, function(err, rts) {
            if (err) {
                callback(err, null);
            } else {
                Step(
                    function() {
                        var i, now = Date.now(), touched;
                        for (i = 0; i < rts.length; i++) {
                            touched = Date.parse(rts[i].updated);
                            if (now - touched > REQUESTTOKENTIMEOUT) {
                                rts[i].del(this.parallel());
                            }
                        }
                    },
                    function(err) {
                        callback(err, null);
                    }
                );
            }
        });
    }
});

exports.Provider = Provider;
