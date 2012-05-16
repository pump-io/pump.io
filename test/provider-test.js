// provider-test.js
//
// Test the provider module
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
    databank = require('databank'),
    Step = require('step'),
    schema = require('../lib/schema'),
    URLMaker = require('../lib/urlmaker').URLMaker,
    randomString = require('../lib/randomstring').randomString,
    Client = require('../lib/model/client').Client,
    RequestToken = require('../lib/model/requesttoken').RequestToken,
    AccessToken = require('../lib/model/accesstoken').AccessToken,
    User = require('../lib/model/user').User,
    methodContext = require('./lib/methods').methodContext,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var testClient = null;
var ignore = function(err) {};

vows.describe('provider module interface').addBatch({

    'When we get the provider module': {

        topic: function() { 
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get('memory', params);

            db.connect({}, function(err) {
                var mod;

                DatabankObject.bank = db;

                Client.create({title: "Test App", description: "App for testing"}, function(err, client) {
                    if (err) {
                        cb(err, null);
                    } else {
                        testClient = client;
                        mod = require('../lib/provider');
                        cb(null, mod);
                    }
                });
            });
        },
        'there is one': function(err, mod) {
            assert.isObject(mod);
        },
        'and we get its Provider export': {
            topic: function(mod) {
                return mod.Provider;
            },
            'it exists': function(Provider) {
                assert.isFunction(Provider);
            },
            'and we create a new Provider': {
                topic: function(Provider) {
                    return new Provider();
                },
                'it exists': function(provider) {
                    assert.isObject(provider);
                },
                'and we check its methods': methodContext(['previousRequestToken',
                                                           'tokenByConsumer',
                                                           'applicationByConsumerKey',
                                                           'fetchAuthorizationInformation',
                                                           'validToken',
                                                           'tokenByTokenAndVerifier',
                                                           'validateNotReplay',
                                                           'userIdByToken',
                                                           'authenticateUser',
                                                           'associateTokenToUser',
                                                           'generateRequestToken',
                                                           'generateAccessToken',
                                                           'cleanRequestTokens']),
                'and we use previousRequestToken() on a previously unseen token': {
                    topic: function(provider) {
                        provider.previousRequestToken("ZZZZZZZZZZZZZZZZZZZZZ", this.callback);
                    },
                    'it returns correct value': function(err, token) {
                        assert.ifError(err);
                        assert.isString(token);
                        assert.equal(token, "ZZZZZZZZZZZZZZZZZZZZZ");
                    }
                },
                'and we use previousRequestToken() on an existing but unused token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/12345/'};

                        RequestToken.create(props, function(err, rt) {
                            if (err) {
                                cb(err, null);
                            } else {
                                provider.previousRequestToken(rt.token, function(err, token) {
                                    if (err) {
                                        cb(err, rt);
                                    } else {
                                        cb(null, rt);
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, rt) {
                        assert.ifError(err);
                        assert.isObject(rt);
                    },
                    teardown: function(requestToken) {
                        if (requestToken && requestToken.del) {
                            requestToken.del(ignore);
                        }
                    }
                },
                'and we use previousRequestToken() on a used token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user, rt, at;

                        Step(
                            function() {
                                User.create({nickname: "charlie", password: "hacker"}, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                user = results;
                                RequestToken.create(props, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                rt = results;
                                provider.associateTokenToUser(user.nickname, rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                provider.generateAccessToken(rt.token, this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                    return;
                                }
                                at = results;
                                provider.previousRequestToken(rt.token, function(err, newt) {
                                    if (err) {
                                        cb(null, {user: user, rt: rt, at: at});
                                    } else {
                                        cb(new Error("Unexpected success"), null);
                                    }
                                });
                            }
                        );
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.at && results.at.del) {
                            results.at.del(ignore);
                        }
                    }
                },
                'and we use tokenByConsumer() on an unknown consumer key': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.tokenByConsumer("BOGUSCONSUMERKEY", function(err, tokens) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Got unexpected tokens"));
                            }
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we use tokenByConsumer() on a consumer key with no request tokens': {
                    topic: function(provider) {
                        var cb = this.callback;

                        Client.create({title: "No requests client"}, function(err, client) {
                            if (err) {
                                cb(err, null);
                                return;
                            }
                            provider.tokenByConsumer(client.consumer_key, function(err, tokens) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    cb(null, {client: client,
                                              tokens: tokens});
                                }
                            });
                        });
                    },
                    'it works': function(err, results) {
                        assert.ifError(err);
                    },
                    'results are empty': function(err, results) {
                        assert.isArray(results.tokens);
                        assert.lengthOf(results.tokens, 0);
                    },
                    teardown: function(results) {
                        if (results && results.client && results.client.del) {
                            results.client.del(ignore);
                        }
                    }
                },
                'and we use tokenByConsumer() on a consumer key with a single request token': {
                    topic: function(provider) {
                        var cb = this.callback;

                        Client.create({title: "Single request client"}, function(err, client) {
                            if (err) {
                                cb(err, null);
                                return;
                            }
                            var props = {consumer_key: client.consumer_key, callback: 'http://example.com/madeup/endpoint'};

                            RequestToken.create(props, function(err, rt) {
                                if (err) {
                                    cb(err, null);
                                    return;
                                }
                                provider.tokenByConsumer(client.consumer_key, function(err, tokens) {
                                    if (err) {
                                        cb(err, null);
                                    } else {
                                        cb(null, {client: client,
                                                  requestToken: rt,
                                                  tokens: tokens});
                                    }
                                });
                            });
                        });
                    },
                    'it works': function(err, results) {
                        assert.ifError(err);
                    },
                    'results are correct': function(err, results) {
                        assert.isArray(results.tokens);
                        assert.lengthOf(results.tokens, 1);
                        assert.equal(results.tokens[0].token, results.requestToken.token);
                    },
                    teardown: function(results) {
                        if (results && results.client && results.client.del) {
                            results.client.del(ignore);
                        }
                        if (results && results.requestToken && results.requestToken.del) {
                            results.requestToken.del(ignore);
                        }
                    }
                },
                'and we use applicationByConsumerKey() on an invalid key': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.applicationByConsumerKey("BOGUSCONSUMERKEY", function(err, result) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Got unexpected results"));
                            }
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we use applicationByConsumerKey() on a valid key': {
                    topic: function(provider) {
                        provider.applicationByConsumerKey(testClient.consumer_key, this.callback);
                    },
                    'it works': function(err, client) {
                        assert.ifError(err);
                        assert.isObject(client);
                        assert.instanceOf(client, Client);
                    },
                    'it has the right fields': function(err, client) {
                        assert.isString(client.consumer_key);
                        assert.isString(client.secret);
                    }
                },
                'and we use fetchAuthorizationInformation() with a nonexistent username and existent token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            username = "nonexistent",
                            props = {consumer_key: testClient.consumer_key, callback: 'http://example.com/madeup/endpoint'};

                        RequestToken.create(props, function(err, rt) {
                            if (err) {
                                cb(err, null);
                            } else {
                                provider.fetchAuthorizationInformation(username, rt.token, function(err, app, user) {
                                    if (err) { // this is correct
                                        cb(null, rt);
                                    } else {
                                        cb(new Error("Unexpected authorization information"), null);
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, rt) {
                        assert.ifError(err);
                        assert.isObject(rt);
                        assert.instanceOf(rt, RequestToken);
                    },
                    teardown: function(rt) {
                        if (rt && rt.del) {
                            rt.del(ignore);
                        }
                    }
                },
                'and we use fetchAuthorizationInformation() with a existent username and unassociated token': {
                    topic: function(provider) {
                        var cb = this.callback;

                        User.create({nickname: "david", password: "letmein"}, function(err, user) {
                            if (err) {
                                cb(err, null);
                            } else {
                                var props = {consumer_key: testClient.consumer_key, callback: 'http://example.com/madeup/endpoint'};

                                RequestToken.create(props, function(err, rt) {
                                    if (err) {
                                        cb(err, null);
                                    } else {
                                        provider.fetchAuthorizationInformation("david", rt.token, function(err, app, found) {
                                            if (err) { // this is correct
                                                cb(null, {user: user, rt: rt});
                                            } else {
                                                cb(new Error("Unexpected authorization information"), null);
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                        assert.isObject(results);
                        assert.isObject(results.rt);
                        assert.isObject(results.user);
                        assert.instanceOf(results.rt, RequestToken);
                        assert.instanceOf(results.user, User);
                    },
                    teardown: function(results) {
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                    }
                },
                'and we use fetchAuthorizationInformation() with a existent username and non-existent token': {
                    topic: function(provider) {
                        var cb = this.callback;

                        User.create({nickname: "ernie", password: "letmein"}, function(err, user) {
                            if (err) {
                                cb(err, null);
                            } else {
                                provider.fetchAuthorizationInformation("ernie", "bogusrequesttoken", function(err, app, found) {
                                    if (err) { // this is correct
                                        cb(null, user);
                                    } else {
                                        cb(new Error("Unexpected authorization information"), null);
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, user) {
                        assert.ifError(err);
                        assert.isObject(user);
                        assert.instanceOf(user, User);
                    },
                    teardown: function(user) {
                        if (user && user.del) {
                            user.del(ignore);
                        }
                    }
                },
                'and we use fetchAuthorizationInformation() with a existent username and associated token': {
                    topic: function(provider) {
                        var cb = this.callback;

                        User.create({nickname: "francine", password: "monkey"}, function(err, user) {
                            if (err) {
                                cb(err, null);
                            } else {
                                var props = {consumer_key: testClient.consumer_key, callback: 'http://example.com/madeup/endpoint'};

                                RequestToken.create(props, function(err, rt) {
                                    if (err) {
                                        cb(err, null);
                                    } else {
                                        provider.associateTokenToUser("francine", rt.token, function(err, res) {
                                            if (err) {
                                                cb(err, null);
                                            } else {
                                                provider.fetchAuthorizationInformation("francine", rt.token, function(err, app, found) {
                                                    if (err) {
                                                        cb(err, null);
                                                    } else { // this is correct
                                                        cb(null, {user: user, rt: rt, app: app, found: found});
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    },
                    'it works': function(err, results) {
                        assert.ifError(err);
                        assert.isObject(results);
                        assert.isObject(results.rt);
                        assert.isObject(results.user);
                        assert.isObject(results.app);
                        assert.isObject(results.found);
                        assert.instanceOf(results.rt, RequestToken);
                        assert.instanceOf(results.user, User);
                        assert.instanceOf(results.app, Client);
                        assert.instanceOf(results.found, RequestToken);
                        assert.equal(results.rt.token, results.found.token);
                        assert.equal(results.rt.token_secret, results.found.token_secret);
                    },
                    'results have right properties': function(err, results) {
                        assert.isString(results.app.title);
                        assert.isString(results.app.description);
                        assert.isString(results.found.token);
                        assert.isString(results.found.username);
                    },
                    teardown: function(results) {
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                    }
                },
                'and we call validToken() with an invalid token': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.validToken("NOT A VALID TOKEN", function(err, token) {
                            if (err) { // correct
                                cb(null);
                            } else {
                                cb(new Error("Unexpected result"));
                            }
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we call validToken() with a request token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'};

                        RequestToken.create(props, function(err, rt) {
                            if (err) {
                                cb(err, null);
                            } else {
                                provider.validToken(rt.token, function(err, token) {
                                    if (err) {
                                        cb(null, rt);
                                    } else {
                                        cb(new Error("Unexpected result"), null);
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, rt) {
                        assert.ifError(err);
                    },
                    teardown: function(rt) {
                        if (rt && rt.del) {
                            rt.del(ignore);
                        }
                    }
                },
                'and we call validToken() with a valid access token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user, rt, at;

                        Step(
                            function() {
                                User.create({nickname: "gerald", password: "123456"}, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                user = results;
                                RequestToken.create(props, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                rt = results;
                                provider.associateTokenToUser(user.nickname, rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                provider.generateAccessToken(rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                at = results;
                                provider.validToken(at.access_token, this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    cb(null, {user: user,
                                              rt: rt,
                                              at: at});
                                }
                            }
                        );
                    },
                    'it works': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.at && results.at.del) {
                            results.at.del(ignore);
                        }
                    }
                },
                'and we call tokenByTokenAndVerifier() with bad token and bad verifier': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.tokenByTokenAndVerifier("NOT A TOKEN", "NOT A VERIFIER", function(err, token) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we call tokenByTokenAndVerifier() with bad token and good verifier': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'};

                        RequestToken.create(props, function(err, rt) {
                            if (err) {
                                cb(err);
                            } else {
                                provider.tokenByTokenAndVerifier("NOT A TOKEN", rt.verifier, function(err, newt) {
                                    if (err) {
                                        cb(null, rt);
                                    } else {
                                        cb(new Error("Unexpected success"), null);
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(rt) {
                        if (rt && rt.del) {
                            rt.del(ignore);
                        }
                    }
                },
                'and we call tokenByTokenAndVerifier() with good token and bad verifier': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'};

                        RequestToken.create(props, function(err, rt) {
                            if (err) {
                                cb(err);
                            } else {
                                provider.tokenByTokenAndVerifier(rt.token, "NOT A VERIFIER", function(err, newt) {
                                    if (err) {
                                        cb(null, rt);
                                    } else {
                                        cb(new Error("Unexpected success"), null);
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(rt) {
                        if (rt && rt.del) {
                            rt.del(ignore);
                        }
                    }
                },
                'and we call tokenByTokenAndVerifier() with good token and wrong verifier': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'};

                        RequestToken.create(props, function(err, rt1) {
                            if (err) {
                                cb(err);
                            } else {
                                RequestToken.create(props, function(err, rt2) {
                                    if (err) {
                                        cb(err);
                                    } else {
                                        provider.tokenByTokenAndVerifier(rt1.token, rt2.verifier, function(err, newt) {
                                            if (err) {
                                                cb(null, {rt1: rt1, rt2: rt2});
                                            } else {
                                                cb(new Error("Unexpected success"), null);
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.rt1 && results.rt1.del) {
                            results.rt1.del(ignore);
                        }
                        if (results && results.rt2 && results.rt2.del) {
                            results.rt2.del(ignore);
                        }
                    }
                },
                'and we call tokenByTokenAndVerifier() with good token and good verifier': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'};

                        RequestToken.create(props, function(err, rt) {
                            if (err) {
                                cb(err);
                            } else {
                                provider.tokenByTokenAndVerifier(rt.token, rt.verifier, function(err, newt) {
                                    if (err) {
                                        cb(err, null);
                                    } else {
                                        cb(null, {rt: rt, newt: newt});
                                    }
                                });
                            }
                        });
                    },
                    'it works': function(err, results) {
                        assert.ifError(err);
                        assert.isObject(results.newt);
                        assert.instanceOf(results.newt, RequestToken);
                        assert.equal(results.rt.token, results.newt.token);
                        assert.equal(results.rt.verifier, results.newt.verifier);
                    },
                    teardown: function(results) {
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                    }
                },
                'and we call validateNotReplay() with an invalid access token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            ts = Number(Date.now()/1000).toString(10);

                        randomString(8, function(err, nonce) {
                            provider.validateNotReplay("NOT AN ACCESS TOKEN", ts, nonce, function(err, isNotReplay) {
                                if (err) {
                                    cb(null);
                                } else {
                                    cb(new Error("Unexpected success"));
                                }
                            });
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we call validateNotReplay() with a valid access token and a long-expired timestamp': {
                    topic: function(provider) {
                        var cb = this.callback,
                            ts = Number((Date.now()/1000) - (24*60*60*365)).toString(10),
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user, rt, at;

                        Step(
                            function() {
                                User.create({nickname: "harvey", password: "123456"}, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                user = results;
                                RequestToken.create(props, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                rt = results;
                                provider.associateTokenToUser(user.nickname, rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                provider.generateAccessToken(rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                at = results;
                                randomString(8, this);
                            },
                            function(err, nonce) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    provider.validateNotReplay(at.access_token, ts, nonce, function(err, isNotReplay) {
                                        if (err) {
                                            cb(err, null);
                                        } else if (isNotReplay) {
                                            cb(new Error("Unexpected success"), null);
                                        } else {
                                            cb(null, {at: at, rt: rt, user: user});
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.at && results.at.del) {
                            results.at.del(ignore);
                        }
                    }
                },
                'and we call validateNotReplay() with a valid access token and a far-future timestamp': {
                    topic: function(provider) {
                        var cb = this.callback,
                            ts = Number((Date.now()/1000) + (24*60*60*365)).toString(10),
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user, rt, at;

                        Step(
                            function() {
                                User.create({nickname: "ignace", password: "123456"}, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                user = results;
                                RequestToken.create(props, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                rt = results;
                                provider.associateTokenToUser(user.nickname, rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                provider.generateAccessToken(rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                at = results;
                                randomString(8, this);
                            },
                            function(err, nonce) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    provider.validateNotReplay(at.access_token, ts, nonce, function(err, isNotReplay) {
                                        if (err) {
                                            cb(err, null);
                                        } else if (isNotReplay) {
                                            cb(new Error("Unexpected success"), null);
                                        } else {
                                            cb(null, {at: at, rt: rt, user: user});
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.at && results.at.del) {
                            results.at.del(ignore);
                        }
                    }
                },
                'and we call validateNotReplay() with a valid access token and a good timestamp and a used nonce': {
                    topic: function(provider) {
                        var cb = this.callback,
                            ts = Number((Date.now()/1000)).toString(10),
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user, rt, at, nonce;

                        Step(
                            function() {
                                User.create({nickname: "jerry", password: "123456"}, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                user = results;
                                RequestToken.create(props, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                rt = results;
                                provider.associateTokenToUser(user.nickname, rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                provider.generateAccessToken(rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                at = results;
                                randomString(8, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                nonce = results;
                                provider.validateNotReplay(at.access_token, ts, nonce, this);
                            },
                            function(err, isNotReplay) {
                                if (err) {
                                    cb(err, null);
                                } else if (!isNotReplay) {
                                    cb(new Error("Unexpected failure on first validation"), null);
                                } else {
                                    provider.validateNotReplay(at.access_token, ts, nonce, function(err, isNotReplay) {
                                        if (err) {
                                            cb(err, null);
                                        } else if (isNotReplay) {
                                            cb(new Error("Unexpected success"), null);
                                        } else {
                                            cb(null, {at: at, rt: rt, user: user});
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.at && results.at.del) {
                            results.at.del(ignore);
                        }
                    }
                },
                'and we call validateNotReplay() with a valid access token and a good timestamp and an unused nonce': {
                    topic: function(provider) {
                        var cb = this.callback,
                            ts = Number((Date.now()/1000)).toString(10),
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user, rt, at;

                        Step(
                            function() {
                                User.create({nickname: "karen", password: "123456"}, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                user = results;
                                RequestToken.create(props, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                rt = results;
                                provider.associateTokenToUser(user.nickname, rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                provider.generateAccessToken(rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                at = results;
                                randomString(8, this);
                            },
                            function(err, nonce) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    provider.validateNotReplay(at.access_token, ts, nonce, function(err, isNotReplay) {
                                        if (err) {
                                            cb(err, null);
                                        } else if (!isNotReplay) {
                                            cb(new Error("Unexpected failure"), null);
                                        } else {
                                            cb(null, {at: at, rt: rt, user: user});
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it works': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.at && results.at.del) {
                            results.at.del(ignore);
                        }
                    }
                },
                'and we call userIdByToken() with an invalid access token': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.userIdByToken("NOT AN ACCESS TOKEN", function(err, userId) {
                            if (err) { // correct
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we call userIdByToken() with a valid request token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user, rt;

                        Step(
                            function() {
                                User.create({nickname: "larry", password: "123456"}, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                user = results;
                                RequestToken.create(props, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                rt = results;
                                provider.associateTokenToUser(user.nickname, rt.token, this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err);
                                } else {
                                    provider.userIdByToken(rt.token, function(err, userId) {
                                        if (err) { // correct
                                            cb(null, {user: user, rt: rt});
                                        } else {
                                            cb(new Error("Unexpected success"));
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                    }
                },
                'and we call userIdByToken() with a valid access token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user, rt, at;

                        Step(
                            function() {
                                User.create({nickname: "mary", password: "123456"}, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                user = results;
                                RequestToken.create(props, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                rt = results;
                                provider.associateTokenToUser(user.nickname, rt.token, this);
                            },
                            function(err, results) {
                                if (err) throw err;
                                provider.generateAccessToken(rt.token, this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    at = results;
                                    provider.userIdByToken(at.access_token, function(err, userId) {
                                        if (err) { // correct
                                            cb(err, null);
                                        } else {
                                            cb(null, {user: user, rt: rt, at: at, id: userId});
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it works': function(err, results) {
                        assert.ifError(err);
                    },
                    'it has the right properties': function(err, results) {
                        assert.isString(results.id.id);
                        assert.equal(results.user.nickname, results.id.id);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.at && results.at.del) {
                            results.at.del(ignore);
                        }
                    }
                },
                'and we call authenticateUser with a non-existent username': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.authenticateUser("nonexistentuser", "badpassword", "badtoken", function(err, rt) {
                            if (err) { // correct
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we call authenticateUser with a good username and non-matching password': {
                    topic: function(provider) {
                        var cb = this.callback,
                            user;
                        
                        Step(
                            function() {
                                User.create({nickname: "nancy", password: "changeme"}, this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    user = results;
                                    provider.authenticateUser("nancy", "badpass", "badtoken", function(err, rt) {
                                        if (err) { // correct
                                            cb(null, user);
                                        } else {
                                            cb(new Error("Unexpected success"), null);
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it fails correctly': function(err, user) {
                        assert.ifError(err);
                    },
                    teardown: function(user) {
                        if (user && user.del) {
                            user.del(ignore);
                        }
                    }
                },
                'and we call authenticateUser with a good username and good password and non-existent token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            user;
                        
                        Step(
                            function() {
                                User.create({nickname: "oliver", password: "followThe$"}, this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    user = results;
                                    provider.authenticateUser("oliver", "followThe$", "badtoken", function(err, rt) {
                                        if (err) { // correct
                                            cb(null, user);
                                        } else {
                                            cb(new Error("Unexpected success"), null);
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it fails correctly': function(err, user) {
                        assert.ifError(err);
                    },
                    teardown: function(user) {
                        if (user && user.del) {
                            user.del(ignore);
                        }
                    }
                },
                'and we call authenticateUser with a good username and good password and already-assigned token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user1, user2, rt;
                        
                        Step(
                            function() {
                                User.create({nickname: "paul", password: "austrian"}, this.parallel());
                                User.create({nickname: "pauline", password: "freezy"}, this.parallel());
                                RequestToken.create(props, this.parallel());
                            },
                            function(err, res1, res2, res3) {
                                if (err) throw err;
                                user1 = res1;
                                user2 = res2;
                                rt = res3;
                                provider.associateTokenToUser(user2.nickname, rt.token, this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    provider.authenticateUser(user1.nickname, "austrian", rt.token, function(err, newt) {
                                        if (err) { // correct
                                            cb(null, {user1: user1, user2: user2, rt: rt});
                                        } else {
                                            cb(new Error("Unexpected success"), null);
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.user1 && results.user1.del) {
                            results.user1.del(ignore);
                        }
                        if (results && results.user2 && results.user2.del) {
                            results.user2.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                    }
                },
                'and we call authenticateUser with a good username and good password and an unused request token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user,rt;
                        
                        Step(
                            function() {
                                User.create({nickname: "quincy", password: "adams"}, this.parallel());
                                RequestToken.create(props, this.parallel());
                            },
                            function(err, res1, res2) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    user = res1;
                                    rt = res2;
                                    provider.authenticateUser(user.nickname, "adams", rt.token, function(err, newt) {
                                        if (err) {
                                            cb(err, null);
                                        } else { // should succeed here
                                            cb(null, {user: user, rt: rt, newt: newt});
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it works correctly': function(err, results) {
                        assert.ifError(err);
                        assert.equal(results.newt.token, results.rt.token);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                    }
                },
                'and we call associateTokenToUser with an invalid username and an invalid token': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.associateTokenToUser("nonexistentuser", "badtoken", function(err, rt) {
                            if (err) { // correct
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we call associateTokenToUser with a valid username and an invalid token': {
                    topic: function(provider) {
                        var cb = this.callback;
                        
                        User.create({nickname: "ronald", password: "mcdonald"}, function(err, user) {
                            if (err) {
                                cb(err, null);
                            } else { 
                                provider.associateTokenToUser(user.nickname, "badtoken", function(err, newt) {
                                    if (err) { // should fail
                                        cb(null, user);
                                    } else {
                                        cb(new Error("Unexpected success"));
                                    }
                                });
                            }
                        });
                    },
                    'it works correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(user) {
                        if (user && user.del) {
                            user.del(ignore);
                        }
                    }
                },
                'and we call associateTokenToUser with a invalid username and a valid token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'};
                        
                        RequestToken.create(props, function(err, rt) {
                            if (err) {
                                cb(err, null);
                            } else {
                                provider.associateTokenToUser("nonexistentuser", rt.token, function(err, newt) {
                                    if (err) {
                                        cb(null, rt);
                                    } else { // should succeed here
                                        cb(err, null);
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, rt) {
                        assert.ifError(err);
                    },
                    teardown: function(rt) {
                        if (rt && rt.del) {
                            rt.del(ignore);
                        }
                    }
                },
                'and we call associateTokenToUser with a valid username and a used token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user1, user2, rt;
                        
                        Step(
                            function() {
                                User.create({nickname: "samuel", password: "dinosaur"}, this.parallel());
                                User.create({nickname: "samantha", password: "wombat"}, this.parallel());
                                RequestToken.create(props, this.parallel());
                            },
                            function(err, res1, res2, res3) {
                                if (err) throw err;
                                user1 = res1;
                                user2 = res2;
                                rt = res3;
                                provider.associateTokenToUser(user2.nickname, rt.token, this);
                            },
                            function(err, results) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    provider.associateTokenToUser(user1.nickname, rt.token, function(err, newt) {
                                        if (err) { // correct
                                            cb(null, {user1: user1, user2: user2, rt: rt});
                                        } else {
                                            cb(new Error("Unexpected success"), null);
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.user1 && results.user1.del) {
                            results.user1.del(ignore);
                        }
                        if (results && results.user2 && results.user2.del) {
                            results.user2.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                    }
                },
                'and we call associateTokenToUser with a valid username and an unused token': {
                    topic: function(provider) {
                        var cb = this.callback,
                            props = {consumer_key: testClient.consumer_key,
                                     callback: 'http://example.com/callback/abc123/'},
                            user,rt;
                        
                        Step(
                            function() {
                                User.create({nickname: "thomas", password: "aquinas"}, this.parallel());
                                RequestToken.create(props, this.parallel());
                            },
                            function(err, res1, res2) {
                                if (err) {
                                    cb(err, null);
                                } else {
                                    user = res1;
                                    rt = res2;
                                    provider.associateTokenToUser(user.nickname, rt.token, function(err, newt) {
                                        if (err) {
                                            cb(err, null);
                                        } else { // should succeed here
                                            cb(null, {user: user, rt: rt, newt: newt});
                                        }
                                    });
                                }
                            }
                        );
                    },
                    'it works correctly': function(err, results) {
                        assert.ifError(err);
                        assert.equal(results.newt.token, results.rt.token);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                    }
                },
                'and we call generateRequestToken with an invalid consumer key': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.generateRequestToken("NOT A KEY", "http://example.com/callback", function(err, rt) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we call generateRequestToken with a valid consumer key and an invalid callback url': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.generateRequestToken(testClient.consumer_key, "NOT A VALID URL", function(err, rt) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we call generateRequestToken with a valid consumer key and a valid callback url': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.generateRequestToken(testClient.consumer_key, "http://example.com/callback", function(err, rt) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(null, rt);
                            }
                        });
                    },
                    'it works': function(err, rt) {
                        assert.ifError(err);
                        assert.isObject(rt);
                        assert.instanceOf(rt, RequestToken);
                    },
                    'it has the right attributes': function(err, rt) {
                        assert.isString(rt.token);
                        assert.isString(rt.token_secret);
                    },
                    teardown: function(rt) {
                        if (rt && rt.del) {
                            rt.del(ignore);
                        }
                    }
                },
                'and we call generateAccessToken() with an invalid request token': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.generateAccessToken("NOT A TOKEN", function(err, at) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        });
                    },
                    'it fails correctly': function(err) {
                        assert.ifError(err);
                    }
                },
                'and we call generateAccessToken() with an unassociated request token': {
                    topic: function(provider) {
                        var cb = this.callback;
                        provider.generateRequestToken(testClient.consumer_key, "http://example.com/callback", function(err, rt) {
                            if (err) {
                                cb(err, null);
                            } else {
                                provider.generateAccessToken(rt.token, function(err, at) {
                                    if (err) {
                                        cb(null, rt);
                                    } else {
                                        cb(new Error("Unexpected success"));
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, rt) {
                        assert.ifError(err);
                    },
                    teardown: function(rt) {
                        if (rt && rt.del) {
                            rt.del(ignore);
                        }
                    }
                },
                'and we call generateAccessToken() with an already-used request token': {
                    topic: function(provider) {
                        var cb = this.callback;

                        User.create({nickname: "ulysses", password: "sgrant"}, function(err, user) {
                            if (err) {
                                cb(err, null);
                            } else {
                                provider.generateRequestToken(testClient.consumer_key, "http://example.com/callback", function(err, rt) {
                                    if (err) {
                                        cb(err, null);
                                    } else {
                                        provider.associateTokenToUser("ulysses", rt.token, function(err, newt) {
                                            if (err) {
                                                cb(err, null);
                                            } else {
                                                provider.generateAccessToken(rt.token, function(err, at) {
                                                    if (err) {
                                                        cb(err, null);
                                                    } else {
                                                        // Double-dip!
                                                        provider.generateAccessToken(rt.token, function(err, at) {
                                                            if (err) {
                                                                cb(null, {rt: rt, user: user, at: at});
                                                            } else {
                                                                cb(new Error("Unexpected success"));
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    },
                    'it fails correctly': function(err, results) {
                        assert.ifError(err);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.at && results.at.del) {
                            results.at.del(ignore);
                        }
                    }
                },
                'and we call generateAccessToken() with an associated request token': {
                    topic: function(provider) {
                        var cb = this.callback;

                        User.create({nickname: "valentine", password: "sday"}, function(err, user) {
                            if (err) {
                                cb(err, null);
                            } else {
                                provider.generateRequestToken(testClient.consumer_key, "http://example.com/callback", function(err, rt) {
                                    if (err) {
                                        cb(err, null);
                                    } else {
                                        provider.associateTokenToUser("valentine", rt.token, function(err, newt) {
                                            if (err) {
                                                cb(err, null);
                                            } else {
                                                provider.generateAccessToken(rt.token, function(err, at) {
                                                    if (err) {
                                                        cb(err, null);
                                                    } else {
                                                        cb(null, {rt: rt, user: user, at: at});
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    },
                    'it works': function(err, results) {
                        assert.ifError(err);
                        assert.isObject(results.at);
                        assert.instanceOf(results.at, AccessToken);
                    },
                    'it has the right properties': function(err, results) {
                        assert.isString(results.at.access_token);
                        assert.isString(results.at.token_secret);
                    },
                    teardown: function(results) {
                        if (results && results.user && results.user.del) {
                            results.user.del(ignore);
                        }
                        if (results && results.rt && results.rt.del) {
                            results.rt.del(ignore);
                        }
                        if (results && results.at && results.at.del) {
                            results.at.del(ignore);
                        }
                    }
                }
            }
        }
    }
}).export(module);
