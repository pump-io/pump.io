// PubSubHubbub hub
//
// Copyright 2012 StatusNet Inc.
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

var _ = require('underscore'),
    url = require('url'),
    qs = require('querystring'),
    http = require('http'),
    databank = require('databank'),
    crypto = require('crypto'),
    URLMaker = require('./urlmaker').URLMaker,
    User = require('./model/user').User,
    NoSuchThingError = databank.NoSuchThingError;

var DAY           = 60 * 60 * 24;
var MAX_LEASE     = DAY * 365;
var MIN_LEASE     = DAY * 1;
var DEFAULT_LEASE = DAY * 7;

var Hub = function(db) {
    this.db = db;
};

Hub.schema = {
    subscription: {
        pkey: 'callback',
        fields: ['callback', 'created', 'topic', 'lease_seconds'],
        indices: ['topic']
    }
};

Hub.prototype.validateTopic = function(topic, callback) {

    var parts, re, matches;

    // Is it on our server?

    if (!URLMaker.ourURL(topic)) {
        callback(new Error("bad topic"), null);
        return;
    }

    // Does it look like a user feed?

    parts = url.parse(topic);
    re = /^\/api\/user\/(^\/)+\/feed$/;

    matches = parts.pathname.match(re);

    if (!matches) {
        callback(new Error("bad topic"), null);
        return;
    }

    // Does the user exist?

    User.get(matches[1], function(err, user) {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });
};

Hub.prototype.subscribe = function(params, cb) {

    var hub = this;
    
    this.validate(params, function(err) {
        var sub, callback, lease_seconds;
        if (err) {
            cb(err);
        } else {
            callback = params.hub.callback;
            if (_(params.hub).has("lease_seconds")) {
                lease_seconds = parseInt(params.hub.lease_seconds, 10);
            } else {
                lease_seconds = DEFAULT_LEASE;
            }
            sub = {
                callback: callback,
		topic: params.hub.topic,
                created: Date.now(),
                lease_seconds: Math.min(MAX_LEASE, Math.max(MIN_LEASE, lease_seconds))
            };

            if (_(params.hub).has('secret')) {
                sub.secret = params.hub.secret;
            }

            hub.db.save('subscription', callback, sub, function(err, value) {
                if (err) {
                    cb(new Error("Error saving subscription."));
                } else {
                    cb(null, value);
                }
            });
        }
    });
};

Hub.prototype.unsubscribe = function(params, cb) {

    var hub = this;
    
    this.validate(params, function(err) {
        var sub, callback;
        if (err) {
            cb(err);
        } else {
            callback = params.hub.callback;

            hub.db.del('subscription', callback, function(err) {
                if (err && !(err instanceof NoSuchThingError)) {
                    cb(new Error("Error deleting subscription."));
                } else {
                    cb(null);
                }
            });
        }
    });
};

Hub.prototype.validate = function(params, cb) {

    var callback, topic, hub = this;

    callback = params.hub.callback;

    if (!callback) {
        cb(new Error("No callback provided."));
        return;
    }

    topic = params.hub.topic;

    if (!topic) {
        cb(new Error("No topic provided."));
        return;
    }

    if (!this.ourTopic(topic)) {
        cb(new Error("We don't support that topic."));
        return;
    }

    if (params.hub.verify !== 'sync') {
        cb(new Error("We only support sync verification."));
        return;
    }

    hub.validateTopic(topic, function(err) {
        if (err) {
            cb(err);
        } else {
            hub.verify(params, function(err) {
                if (err) {
                    cb(err);
                } else {
                    cb(null);
                }
            });
        }
    });
};

Hub.prototype.makeChallenge = function() {

    var urlsafe = function(buf) {
        var str = buf.toString('base64');
        str = str.replace(/\+/g, '-');
        str = str.replace(/\//g, '_');
        str = str.replace(/\=/g, '');
        return str;
    };

    return urlsafe(crypto.randomBytes(16));
};

Hub.prototype.verify = function(params, cb) {

    var callback = params.hub.callback,
        challenge = this.makeChallenge(),
        args = {
            "hub.mode": params.hub.mode,
            "hub.topic": params.hub.topic,
            "hub.challenge": challenge
        };

    if (_(params.hub).has("lease_seconds")) {
        args["hub.lease_seconds"] = params.hub.lease_seconds;
    }

    if (_(params.hub).has("verify_token")) {
        args["hub.verify_token"] = params.hub.verify_token;
    }

    this.postRequest(callback, args, function(err, res, body) {
        if (err) {
            cb(new Error("Could not verify."));
        } else if (res.statusCode < 200 || res.statusCode >= 300) {
            cb(new Error("Could not verify."));
        } else if (body.trim() !== challenge) {
            cb(new Error("Could not verify."));
        } else {
            cb(null);
        }
    });
};

Hub.prototype.postRequest = function(targetUrl, params, callback) {

    var parts = url.parse(targetUrl);

    var options = {
        host: parts.hostname,
        port: parts.port,
        path: (parts.search) ? parts.pathname+'?'+parts.search : parts.pathname,
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded',
                  'user-agent': 'ofirehose/0.1.0dev'}
    };

    var creq = http.request(options, function(res) {

        var body = '';

        res.on('data', function (chunk) {
            body = body + chunk;
        });

        res.on('end', function () {
            callback(null, res, body);
        });
    });

    creq.on('error', function(err) {
        callback(err, null, null);
    });

    creq.write(qs.stringify(params));
    creq.end();
};

// XXX: queue and do later

Hub.prototype.distribute = function(activity, topic, callback) {

    var hub = this, 
        message = this.makeMessage(activity, topic),
        onSub = function(sub) {
            hub.distributeTo(message, sub);
        };

    hub.db.search('subscription', {'topic': topic}, onSub, function(err) {
        callback(err);
    });
};

Hub.prototype.makeMessage = function(activity, topic) {

    var message = {
        items: [
            {
                topic: topic,
                payload: activity
            }
        ]
    };

    return JSON.stringify(message);
};

Hub.prototype.distributeTo = function(message, topic, sub) {

    var signature = null;

    if (sub.secret) {
        signature = this.sign(message, sub.secret);
    }

    this.postMessage(sub.callback, message, signature, function(err, res, body) {
        // XXX: log
    });
};

Hub.prototype.sign = function(message, secret) {
    var hmac = crypto.createHmac('sha1', secret);
    hmac.update(message);
    return hmac.digest("hex");
};

Hub.prototype.postMessage = function(targetUrl, message, signature, callback) {

    var parts = url.parse(targetUrl);

    var options = {
        host: parts.hostname,
        port: parts.port,
        path: (parts.search) ? parts.pathname+'?'+parts.search : parts.pathname,
        method: 'POST',
        headers: {'content-type': 'application/json',
                  'user-agent': 'ofirehose/0.1.0dev'}
    };

    if (signature) {
        options.headers['X-Hub-Signature'] = "sha1=" + signature;
    }

    var creq = http.request(options, function(res) {

        var body = '';

        res.on('data', function (chunk) {
            body = body + chunk;
        });

        res.on('end', function () {
            callback(null, res, body);
        });
    });

    creq.on('error', function(err) {
        callback(err, null, null);
    });

    creq.write(message);
    creq.end();
};

exports.Hub = Hub;
