// pumpsocket.js
//
// Our own socket.io application interface
//
// Copyright 2011-2012, E14N https://e14n.com/
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

var sockjs = require("sockjs"),
    cluster = require("cluster"),
    uuid = require("node-uuid"),
    Step = require("step"),
    _ = require("underscore"),
    oauth = require("oauth-evanp"),
    randomString = require("./randomstring").randomString,
    URLMaker = require("./urlmaker").URLMaker,
    finishers = require("./finishers"),
    Activity = require("./model/activity").Activity,
    addFollowed = finishers.addFollowed,
    addLiked = finishers.addLiked,
    addLikers = finishers.addLikers,
    addShared = finishers.addShared,
    firstFewReplies = finishers.firstFewReplies,
    firstFewShares = finishers.firstFewShares;

var connect = function(app, log) {
    var slog = log.child({component: "sockjs"}),
        options = {
            sockjs_url: "/javascript/sockjs.min.js",
            prefix: "/main/realtime/sockjs",
            log: function(severity, message) {
                if (_.isFunction(slog[severity])) {
                    slog[severity](message);
                } else {
                    slog.info(message);
                }
            }
        },
        server,
        id2url = {},
        url2id = {},
        id2conn = {},
        follow = function(url, id) {
            if (!_.has(url2id, url)) {
                cluster.worker.send({cmd: "follow", url: url});
                url2id[url] = [id];
            }
            if (!_.contains(url2id[url], id)) {
                url2id[url].push(id);
            }
            if (!_.contains(id2url[id], url)) {
                id2url[id].push(url);
            }
        },
        unfollow = function(url, id) {
            if (_.has(url2id, url) && _.contains(url2id[url], id)) {
                url2id[url].splice(url2id[url].indexOf(id), 1);
                if (url2id[url].length === 0) {
                    cluster.worker.send({cmd: "unfollow", url: url});
                    delete url2id[url];
                }
            }
            if (_.contains(id2url[id], url)) {
                id2url[id].splice(id2url[id].indexOf(url), 1);
            }
        },
        challenge = function(conn) {
            Step(
                function() {
                    randomString(8, this);
                },
                function(err, str) {
                    var url;
                    if (err) {
                        // <sad trombone>
                        conn.log.error(err);
                        conn.close();
                    } else {
                        url = URLMaker.makeURL("/main/realtime/sockjs/"+str+"/challenge");
                        conn.challengeURL = url;
                        conn.write(JSON.stringify({cmd: "challenge",
                                                   url: url,
                                                   method: "GET"}));
                    }
                }
            );
        },
        rise = function(conn, message) {

            var client,
                params = _.object(message.parameters);

            conn.log.info(message);

            if (message.action != conn.challengeURL) {
                conn.log.error({challenge: conn.challengeURL,
                                response: message.action},
                               "Bad challenge URL");
                conn.close();
                return;
            }

            // Wipe the URL so we don't recheck

            conn.challengeURL = null;

            if (_.has(params, "oauth_token")) {
                validateUser(message, function(err, user, client) {
                    if (err) {
                        conn.log.error(err,
                                       "Failed user authentication");
                        conn.close();
                    } else {
                        conn.log.info({user: user,
                                       client: client},
                                      "User authentication succeeded.");
                        conn.user = user;
                        conn.client = client;
                        conn.write(JSON.stringify({cmd: "authenticated",
						   user: user.nickname}));
                    }
                });
            } else {
                validateClient(message, function(err, client) {
                    if (err) {
                        conn.log.error(err,
                                       "Failed client authentication");
                        conn.close();
                    } else {
                        conn.log.info({client: client},
                                      "Client authentication succeeded.");
                        if (_.has(conn, "user")) {
                            delete conn.user;
                        }
                        conn.client = client;
                        conn.write(JSON.stringify({cmd: "authenticated"}));
                    }
                });
            }
        },
        checkSignature = function(message, client, token, cb) {
            var params = _.object(message.parameters),
                oa = new oauth.OAuth(null,
                                     null,
                                     params.oauth_consumer_key,
                                     client.secret,
                                     null,
                                     null,
                                     params.oauth_signature_method),
                sent = params.oauth_signature,
                signature,
                copy = _.clone(params),
                normalized;

            // Remove the signature

            delete copy.oauth_signature;

            // Normalize into a string

            normalized = oa._normaliseRequestParams(copy);

            signature = oa._getSignature(message.method,
                                         message.action,
                                         normalized,
                                         token ? token.token_secret : null);

            if (signature == sent) {
                cb(null);
            } else {
                cb(new Error("Bad OAuth signature"));
            }
        },
        validateClient = function(message, cb) {
            var params = _.object(message.parameters),
                client;
            Step(
                function() {
                    server.provider.validateNotReplayClient(params.oauth_consumer_key,
                                                            null,
                                                            params.oauth_timestamp,
                                                            params.oauth_nonce,
                                                            this);
                },
                function(err, result) {
                    if (err) throw err;
                    if (!result) throw new Error("Seen this nonce before!");
                    server.provider.applicationByConsumerKey(params.oauth_consumer_key,
                                                             this);
                },
                function(err, application) {
                    if (err) throw err;
                    client = application;
                    checkSignature(message, application, null, this);
                },
                function(err) {
                    if (err) {
                        cb(err, null);
                    } else {
                        cb(null, client);
                    }
                }
            );
        },
        validateUser = function(message, cb) {
            var params = _.object(message.parameters),
                client,
                token,
                user;

            Step(
                function() {
                    server.provider.validToken(params.oauth_token, this);
                },
                function(err, result) {
                    if (err) throw err;
                    token = result;
                    server.provider.validateNotReplayClient(params.oauth_consumer_key,
                                                            params.oauth_token,
                                                            params.oauth_timestamp,
                                                            params.oauth_nonce,
                                                            this);
                },
                function(err, result) {
                    if (err) throw err;
                    if (!result) throw new Error("Seen this nonce before!");
                    server.provider.applicationByConsumerKey(params.oauth_consumer_key,
                                                           this);
                },
                function(err, application) {
                    if (err) throw err;
                    client = application;
                    checkSignature(message, client, token, this);
                },
                function(err) {
                    if (err) throw err;
                    server.provider.userIdByToken(params.oauth_token, this);
                },
                function(err, doc) {
                    if (err) {
                        cb(err, null, null);
                    } else {
                        cb(null, doc.user, doc.client);
                    }
                }
            );
        };

    cluster.worker.on("message", function(msg) {
        var ids;
        if (msg.cmd == "update") {
            ids = url2id[msg.url];
            slog.info({activity: msg.activity.id, connections: (ids) ? ids.length : 0}, "Delivering activity to connections");
            if (ids && ids.length) {
                _.each(ids, function(id) {
                    var act, profile, conn = id2conn[id];
                    if (!conn) {
                        return;
                    }
                    act = new Activity(msg.activity);
                    Step(
                        function() {
                            var profile = (conn.user) ? conn.user.profile : null;
                            act.checkRecipient(profile, this);
                        },
                        function(err, ok) {
                            if (err) throw err;
                            if (!ok) {
                                conn.log.info({activity: msg.activity.id}, "No access; not delivering activity");
                                return;
                            }
                            addLiked(profile, [act.object], this.parallel());
                            addLikers(profile, [act.object], this.parallel());
                            addShared(profile, [act.object], this.parallel());
                            firstFewReplies(profile, [act.object], this.parallel());
                            firstFewShares(profile, [act.object], this.parallel());
                            if (act.object.isFollowable()) {
                                addFollowed(profile, [act.object], this.parallel());
                            }
                        },
                        function(err) {
                            var tosend;
                            if (err) {
                                conn.log.error(err);
                            } else {
                                tosend = _.pick(msg, "cmd", "url");
                                tosend.activity = act;
                                conn.log.info({activity: msg.activity.id}, "Delivering activity");
                                conn.write(JSON.stringify(tosend));
                            }
                        }
                    );
                });
            }
        }
    });

    server = sockjs.createServer(options);

    // Note this is a utility for us; SockJS uses the log() function
    // we pass in through options

    server.log = slog;

    server.log.info("Setting up sockjs server.");

    // snatch the provider

    server.provider = app.provider;

    server.on("connection", function(conn) {
	    if (conn === null) {
	        server.log.info ("Connection event without a connection.");
	        return;
	    }

        var id = conn.id;
        conn.log = server.log.child({"connection_id": id, component: "sockjs"});
        conn.log.info("Connected");
        id2conn[id] = conn;
        id2url[id] = [];
        conn.on("close", function() {
            _.each(id2url[id], function(url) {
                unfollow(url, id);
            });
            delete id2url[id];
            delete id2conn[id];
            id = null;
            conn.log.info("Disconnected");
        });
        conn.on("data", function(message) {
            var data = JSON.parse(message);
            switch (data.cmd) {
            case "follow":
                conn.log.info({url: data.url}, "Follow");
                follow(data.url, id);
                break;
            case "unfollow":
                conn.log.info({url: data.url}, "Unfollow");
                unfollow(data.url, id);
                break;
            case "rise":
                conn.log.info({url: data.message.action}, "Rise");
                rise(conn, data.message);
                break;
            case "request":
                conn.log.info("Request");
                challenge(conn);
                break;
            }
            return;
        });

        // Send a challenge on connection

        challenge(conn);
    });

    server.installHandlers(app, options);
};

exports.connect = connect;
