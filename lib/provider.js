// OAuthDataProvider for activity spam server
//
// Copyright 2011-2013 E14N https://e14n.com/
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

require("set-immediate");

var NoSuchThingError = require("databank").NoSuchThingError,
    _ = require("underscore"),
    url = require("url"),
    Step = require("step"),
    User = require("./model/user").User,
    RequestToken = require("./model/requesttoken").RequestToken,
    AccessToken = require("./model/accesstoken").AccessToken,
    Nonce = require("./model/nonce").Nonce,
    Client = require("./model/client").Client;

var TIMELIMIT = 300; // +/- 5 min seems pretty generous
var REQUESTTOKENTIMEOUT = 600; // 10 min, also pretty generous

var Provider = function(logParent, rawClients) {

    var prov = this,
	log = (logParent) ? logParent.child({component: "oauth-provider"}) : null,
	clients = _.map(rawClients, function(client) {
	    var cl = _.clone(client);
	    _.extend(cl, {
		consumer_key: client.client_id,
		secret: client.client_secret,
		asActivityObject: function(callback) {
		    var cl = this,
			ActivityObject = require("./model/activityobject").ActivityObject,
			uuidv5 = require("./uuidv5"),
			props = {};

		    props._consumer_key = cl.consumer_key;

		    if (cl.title) {
			props.displayName = cl.title;
		    }

		    if (cl.description) {
			props.content = cl.description;
		    }

		    props.objectType = ActivityObject.APPLICATION;
		    props.id = "urn:uuid:"+uuidv5(client.client_id);

		    ActivityObject.ensureObject(props, callback);
		}
	    });
	    return cl;
	});

    prov.getClient = function(client_id, callback) {

	var client;

	// Is it in our configured array?
	if (clients) {
	    client = _.find(clients, function(cl) { return cl.client_id == client_id; });
	    if (client) {
                setImmediate(function() {
                    callback(null, client);
                });
		return;
	    }
	}

	// Is it in our database?
	Client.get(client_id, callback);
    };

    prov.previousRequestToken = function(token, callback) {
        if (log) log.info("getting previous request token for " + token);
        AccessToken.search({request_token: token}, function(err, ats) {
            if (err) {
                callback(err, null);
            } else if (ats.length > 0) {
                callback(new Error("Token has been used"), null);
            } else {
                callback(null, token);
            }
        });
    };

    prov.tokenByConsumer = function(consumerKey, callback) {
        if (log) log.info("getting token for consumer key " + consumerKey);
        prov.getClient(consumerKey, function(err, client) {
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
    };

    prov.tokenByTokenAndConsumer = function(token, consumerKey, callback) {
        if (log) log.info("getting token for consumer key " + consumerKey + " and token " + token);
        RequestToken.get(token, function(err, rt) {
            if (err) {
                callback(err, null);
            } else if (rt.consumer_key !== consumerKey) {
                callback(new Error("Consumer key mismatch"), null);
            } else {
                callback(null, rt);
            }
        });
    };

    prov.applicationByConsumerKey = function(consumerKey, callback) {
        if (log) log.info("getting application for consumer key " + consumerKey);
        prov.getClient(consumerKey, callback);
    };

    prov.fetchAuthorizationInformation = function(username, token, callback) {
        if (log) log.info("getting auth information for user "+username+" with token " + token);
        RequestToken.get(token, function(err, rt) {
            if (err) {
                callback(err, null, null);
            } else if (!_(rt).has("username") || rt.username !== username) {
                callback(new Error("Request token not associated with username '" + username + "'"), null, null);
            } else {
                prov.getClient(rt.consumer_key, function(err, client) {
                    if (err) {
                        callback(err, null, null);
                    } else {
                        if (!_(client).has("title")) {
                            client.title = "(Unknown)";
                        }
                        if (!_(client).has("description")) {
                            client.description = "(Unknown)";
                        }
                        callback(null, client, rt);
                    }
                });
            }
        });
    };

    prov.validToken = function(accessToken, callback) {
        if (log) log.info("checking for valid token " + accessToken);
        AccessToken.get(accessToken, callback);
    };

    prov.tokenByTokenAndVerifier = function(token, verifier, callback) {
        if (log) log.info("checking for valid request token " + token + " with verifier " + verifier);
        RequestToken.get(token, function(err, rt) {
            if (err) {
                callback(err, null);
            } else if (rt.verifier !== verifier) {
                callback(new Error("Wrong verifier"), null);
            } else {
                callback(null, rt);
            }
        });
    };

    prov.validateNotReplayClient = function(consumerKey, accessToken, timestamp, nonce, callback) {
        var now = Math.floor(Date.now()/1000),
            ts;

        if (log) log.info("checking for replay with consumer key " + consumerKey + ", token = " + accessToken);

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
                prov.getClient(consumerKey, this);
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
    };

    prov.userIdByToken = function(token, callback) {
        var user, client, at;

        if (log) log.info("checking for user with token = " + token);

        Step(
            function() {
                AccessToken.get(token, this);
            },
            function(err, res) {
                if (err) throw err;
                at = res;
                prov.getClient(at.consumer_key, this);
            },
            function(err, res) {
                if (err) throw err;
                client = res;
                User.get(at.username, this);
            },
            function(err, res) {
                if (err) {
                    callback(err, null);
                } else {
                    user = res;
                    callback(null, {id: at.username, user: user, client: client});
                }
            }
        );
    };

    prov.authenticateUser = function(username, password, oauthToken, callback) {

        if (log) log.info("authenticating user with username " + username + " and token " + oauthToken);

        User.checkCredentials(username, password, function(err, user) {
            if (err) {
                callback(err, null);
                return;
            }
            if (!user) {
                callback(new Error("Bad credentials"), null);
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
    };

    prov.associateTokenToUser = function(username, token, callback) {

        if (log) log.info("associating username " + username + " with token " + token);

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
    };

    prov.generateRequestToken = function(oauthConsumerKey, oauthCallback, callback) {

        if (log) log.info("getting a request token for " + oauthConsumerKey);

        if (oauthCallback !== "oob") {
            var parts = url.parse(oauthCallback);

            if (!parts.host || !parts.protocol || (parts.protocol !== "http:" && parts.protocol !== "https:")) {
                callback(new Error("Invalid callback URL"), null);
                return;
            }
        }

        prov.getClient(oauthConsumerKey, function(err, client) {
            if (err) {
                callback(err, null);
                return;
            }
            var props = {consumer_key: oauthConsumerKey,
                         callback: oauthCallback};
            RequestToken.create(props, callback);
        });
    };

    prov.generateAccessToken = function(oauthToken, callback) {

        var rt, at;

        if (log) log.info("getting an access token for " + oauthToken);

        Step(
            function() {
                RequestToken.get(oauthToken, this);
            },
            function(err, results) {
                if (err) throw err;
                rt = results;
                if (!rt.username) {
                    throw new Error("Request token not associated");
                }
                if (rt.access_token) {
                    // XXX: search AccessToken instead...?
                    throw new Error("Request token already used");
                }
                AccessToken.search({consumer_key: rt.consumer_key,
                                    username: rt.username},
                                   this);
            },
            function(err, ats) {
                var props;
                if (err) throw err;
                if (!ats || ats.length === 0) {
                    if (log) log.info("creating a new access token for " + oauthToken);
                    props = {consumer_key: rt.consumer_key,
                             request_token: rt.token,
                             username: rt.username};
                    AccessToken.create(props, this);
                } else {
                    if (log) log.info("reusing access token " + ats[0].access_token + " for " + oauthToken);
                    // XXX: keep an array of related request tokens, not just one
                    ats[0].update({request_token: rt.token}, this);
                }
            },
            function(err, results) {
                if (err) throw err;
                at = results;
                // XXX: delete...?
                if (log) log.info("saving access token for " + oauthToken);
                rt.update({access_token: at.access_token}, this);
            },
            function(err, rt) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, at);
                }
            }
        );
    };

    prov.cleanRequestTokens = function(consumerKey, callback) {

        if (log) log.info("cleaning up request tokens for " + consumerKey);

        Step(
            function() {
                prov.getClient(consumerKey, this);
            },
            function(err, client) {
                if (err) throw err;
                RequestToken.search({consumer_key: consumerKey}, this);
            },
            function(err, rts) {
                var id, now = Date.now(), touched, group = this.group();
                if (err) throw err;
                for (id in rts) {
                    touched = Date.parse(rts[id].updated);
                    if (now - touched > (REQUESTTOKENTIMEOUT * 1000)) { // ms -> sec
                        rts[id].del(group());
                    }
                }
            },
            function(err) {
                callback(err, null);
            }
        );
    };

    prov.newTokenPair = function(client, user, callback) {

        var rt, at;

        Step(
            function() {
                prov.generateRequestToken(client.consumer_key, "oob", this);
            },
            function(err, results) {
                if (err) throw err;
                rt = results;
                rt.update({username: user.nickname}, this);
            },
            function(err, rt) {
                var props;
                if (err) throw err;
                props = {consumer_key: rt.consumer_key,
                         request_token: rt.token,
                         username: rt.username};
                AccessToken.create(props, this);
            },
            function(err, results) {
                if (err) throw err;
                at = results;
                rt.update({access_token: at.access_token}, this);
            },
            function(err) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, at);
                }
            }
        );
    };
};

exports.Provider = Provider;
