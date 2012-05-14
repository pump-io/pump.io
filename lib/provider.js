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
    Step = require('step'),
    User = require('./model/user').User,
    RequestToken = require('./model/requesttoken').RequestToken,
    AccessToken = require('./model/accesstoken').AccessToken,
    Client = require('./model/client').Client;

var TIMELIMIT = 300; // +/- 5 min seems pretty generous

var Provider = function() {
};

_.extend(Provider.prototype, {
    previousRequestToken: function(token, callback) {
        RequestToken.get(token, function(err, rt) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    callback(null, token);
                } else {
                    callback(err, null);
                }
            } else {
                if (rt.used) {
                    callback(new Error("Token has been used"), null);
                } else {
                    // We know this token, but it hasn't been
                    // burnt yet.
                    callback(null, token);
                }
            }
        });
    },
    tokenByConsumer: function(consumerKey, callback) {
        Client.get(consumerKey, function(err, client) {
            if (err) {
                callback(err, null);
            } else {
                RequestToken.search({consumer_key: client.consumer_key}, function(err, rts) {
                    callback(null, rts);
                });
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
    validateNotReplay: function(accessToken, timestamp, nonce, callback) {
        var now = Date.now()/1000,
            ts;

        try {
            ts = parseInt(timestamp, 10);
        } catch (err) {
            callback(err, null);
            return;
        }

        if (Math.abs(ts - now) > TIMELIMIT) {
            callback(null, false);
        } else {
            // FIXME: check replay of nonce
            callback(null, true);
        }
    },
    userIdByToken: function(token, callback) {
        AccessToken.get(token, function(err, at) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, at.username);
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
            rt.username = username;
            rt.save(function(err, rt) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, rt);
                }
            });
        });
    },
    generateRequestToken: function(oauthConsumerKey, oauthCallback, callback) {
        var props = {consumer_key: oauthConsumerKey,
                     callback: oauthCallback};

        RequestToken.create(props, callback);
    },
    generateAccessToken: function(oauthToken, callback) {
        RequestToken.get(oauthToken, function(err, rt) {
            if (err) {
                callback(err, null);
            } else {
                AccessToken.create({request_token: rt.token}, function(err, at) {
                    if (err) {
                        callback(err, null);
                    } else {
                        rt.update({access_token: at.token}, function(err, rt) {
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
                        var i;
                        for (i = 0; i < rts.length; i++) {
                            rts[i].del(this.parallel());
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
