// user-api-test.js
//
// Test the client registration API
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
    httputil = require('./lib/http');

var suite = vows.describe('user API');

suite.addBatch({
    'When we set up the app': {
        topic: function() {
            var cb = this.callback,
                config = {port: 4815,
                          hostname: 'localhost',
                          driver: 'memory',
                          params: {},
                          nologger: true
                         },
                makeApp = require('../lib/app').makeApp;

            makeApp(config, function(err, app) {
                if (err) {
                    cb(err, null);
                } else {
                    app.run(function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, app);
                        }
                    });
                }
            });
        },
        teardown: function(app) {
            app.close();
        },
        'it works': function(err, app) {
            assert.ifError(err);
        },
        'and we check the user list endpoint': {
            topic: function() {
                httputil.options('localhost', 4815, '/api/users', this.callback);
            },
            'it exists': function(err, allow, res, body) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
            },
            'it supports GET': function(err, allow, res, body) {
                assert.include(allow, 'GET');
            },
            'it supports POST': function(err, allow, res, body) {
                assert.include(allow, 'GET');
            }
        },
        'and we try to register a user with no OAuth credentials': {
            topic: function() {
                var cb = this.callback;
                httputil.postJSON('http://localhost:4815/api/users', {}, {nickname: 'nocred', password: 'nobadge'}, function(err, res, body) {
                    if (err) {
                        cb(err);
                    } else if (res.statusCode === 401) {
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
        'and we create a client using the api': {
            topic: function() {
                var cb = this.callback;
                httputil.post('localhost', 4815, '/api/client/register', {type: 'client_associate'}, function(err, res, body) {
                    var cl;
                    if (err) {
                        cb(err, null);
                    } else {
                        try {
                            cl = JSON.parse(body);
                            cb(null, cl);
                        } catch (err) {
                            cb(err, null);
                        }
                    }
                });
            },
            'it works': function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
                assert.isString(cl.client_id);
                assert.isString(cl.client_secret);
            }
        }
    }
});

suite.export(module);