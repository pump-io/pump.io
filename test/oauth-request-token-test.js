// oauth-request-token-test.js
//
// Test the OAuth request token interface
//
// Copyright 2012, StatusNet Inc.
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

var assert = require('assert'),
    vows = require('vows'),
    Step = require('step'),
    _ = require('underscore'),
    querystring = require('querystring'),
    http = require('http'),
    OAuth = require('oauth').OAuth,
    httputil = require('./lib/http'),
    oauthutil = require('./lib/oauth'),
    requestToken = oauthutil.requestToken,
    setupApp = oauthutil.setupApp,
    newClient = oauthutil.newClient,
    newCredentials = oauthutil.newCredentials;

var suite = vows.describe('user API');

suite.addBatch({
    'When we set up the app': {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        'it works': function(err, app) {
            assert.ifError(err);
        },
        'and we request a token with no Authorization': {
            topic: function() {
                var cb = this.callback;
                httputil.post('localhost', 4815, '/oauth/request_token', {}, function(err, res, body) {
                    if (err) {
                        cb(err);
                    } else if (res.statusCode === 400) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success"));
                    }
                });
            },
            'it fails correctly': function(err, cred) {
                assert.ifError(err);
            }
        },
        'and we request a token with an invalid client_id': {
            topic: function() {
                var cb = this.callback,
                    badcl = {client_id: "NOTACLIENTID",
                             client_secret: "NOTTHERIGHTSECRET"};

                requestToken(badcl, function(err, rt) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success"));
                    }
                });
            },
            'it fails correctly': function(err, cred) {
                assert.ifError(err);
            }
        },
        'and we create a client using the api': {
            topic: function() {
                newClient(this.callback);
            },
            'it works': function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
                assert.isString(cl.client_id);
                assert.isString(cl.client_secret);
            },
            'and we request a token with a valid client_id and invalid client_secret': {
                topic: function(cl) {
                    var cb = this.callback,
                        badcl = {client_id: cl.client_id,
                                 client_secret: "NOTTHERIGHTSECRET"};

                    requestToken(badcl, function(err, rt) {
                        if (err) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    });
                },
                'it fails correctly': function(err, cred) {
                    assert.ifError(err);
                }
            },
            'and we request a request token with valid client_id and client_secret': {
                topic: function(cl) {
                    requestToken(cl, this.callback);
                },
                'it works': function(err, cred) {
                    assert.ifError(err);
                    assert.isObject(cred);
                },
                'it has the right results': function(err, cred) {
                    assert.include(cred, 'token');
                    assert.isString(cred.token);
                    assert.include(cred, 'token_secret');
                    assert.isString(cred.token_secret);
                }
            }
        }
    }
});

// A batch to test parallel requests

suite.addBatch({
    'When we set up the app': {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        'it works': function(err, app) {
            assert.ifError(err);
        },
        'and we create a client using the api': {
            topic: function() {
                newClient(this.callback);
            },
            'it works': function(err, cl) {
                assert.ifError(err);
            },
            'and we get two request tokens in series': {
                topic: function(cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            requestToken(cl, this);
                        },
                        function(err, rt1) {
                            if (err) throw err;
                            requestToken(cl, this);
                        },
                        function(err, rt2) {
                            cb(err);
                        }
                    );
                },
                'it works': function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

// A batch to test parallel requests

suite.addBatch({
    'When we set up the app': {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        'it works': function(err, app) {
            assert.ifError(err);
        },
        'and we create a client using the api': {
            topic: function() {
                newClient(this.callback);
            },
            'it works': function(err, cl) {
                assert.ifError(err);
            },
            'and we get many request tokens in parallel': {
                topic: function(cl) {
                    var cb = this.callback;
                    Step(
                        function() {
                            var i, group = this.group();
                            for (i = 0; i < 20; i++) {
                                requestToken(cl, group());
                            }
                        },
                        function(err, rts) {
                            cb(err);
                        }
                    );
                },
                'it works': function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

// A batch to test request token after access token

suite.addBatch({
    'When we set up the app': {
        topic: function() {
            setupApp(this.callback);
        },
        teardown: function(app) {
            if (app && app.close) {
                app.close();
            }
        },
        'it works': function(err, app) {
            assert.ifError(err);
        },
        'and we get a request token after getting credentials': {
            topic: function() {
                var cb = this.callback;
                Step(
                    function() {
                        // Goes through the whole rigamarole
                        newCredentials("mary", "lamb", this);
                    },
                    function(err, cred) {
                        if (err) throw err;
                        requestToken({client_id: cred.consumer_key, client_secret: cred.consumer_secret}, this);
                    },
                    function(err, rt) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, rt);
                        }
                    }
                );
            },
            'it works': function(err, cred) {
                assert.ifError(err);
            }
        }
    }
});

suite['export'](module);