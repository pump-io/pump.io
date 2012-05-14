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
    schema = require('../lib/schema'),
    URLMaker = require('../lib/urlmaker').URLMaker,
    Client = require('../lib/model/client').Client,
    RequestToken = require('../lib/model/requesttoken').RequestToken,
    methodContext = require('./lib/methods').methodContext,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var testClient = null;

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
                            requestToken.del(function(err) {});
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
                            results.client.del(function(err) {});
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
                            results.client.del(function(err) {});
                        }
                        if (results && results.requestToken && results.requestToken.del) {
                            results.requestToken.del(function(err) {});
                        }
                    }
                }
            }
        }
    }
}).export(module);

