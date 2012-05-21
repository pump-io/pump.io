// client-registration-test.js
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
    httputil = require('./lib/http');

var ignore = function(err) {};

var suite = vows.describe('client registration API');

var regFail = function(params) {
    return {
        topic: function() {
            httputil.post('localhost',
                          4815,
                          '/api/client/register',
                          params,
                          this.callback);
        },
        'it fails correctly': function(err, res, body) {
            assert.ifError(err);
            assert.equal(res.statusCode, 400);
        }
    };
};

var regSucceed = function(params) {
    return {
        topic: function() {
            httputil.post('localhost',
                          4815,
                          '/api/client/register',
                          params,
                          this.callback);
        },
        'it works': function(err, res, body) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
        },
        'it has the right results': function(err, res, body) {
            var parsed = JSON.parse(body);
            assert.ifError(err);
            assert.include(parsed, 'client_id');
            assert.include(parsed, 'client_secret');
            assert.include(parsed, 'expires_at');
        }
    };
};

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
        'and we check the client registration endpoint': {
            topic: function() {
                httputil.options('localhost', 4815, '/api/client/register', this.callback);
            },
            'it exists': function(err, allow, res, body) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
            },
            'it supports POST': function(err, allow, res, body) {
                assert.include(allow, 'POST');
            },
            'and we register with no type': regFail({application_name: "Typeless"}),
            'and we register with an unknown type': 
            regFail({application_name: "Frobnicator",
                     type: 'client_frobnicate'
                    }),
            'and we register to associate with a client ID already set': 
            regFail({application_name: "Jump The Gun",
                     type: 'client_associate',
                     client_id: "I MADE IT MYSELF"
                    }),
            'and we register to associate with a client secret set': 
            regFail({application_name: "Psst",
                     type: 'client_associate',
                     client_secret: "I hate corn."
                    }),
            'and we register to associate with an unknown application type': 
            regFail({application_name: "Scoodly",
                     type: 'client_associate',
                     application_type: "unknown"
                    }),
            'and we register to associate with an empty client description':
            regSucceed({type: 'client_associate'}),
            'and we register to associate with an application name':
            regSucceed({application_name: "Valiant",
                        type: 'client_associate'}),
            'and we register to associate with application type web':
            regSucceed({application_name: "Web app",
                        type: 'client_associate',
                        application_type: "web"
                       }),
            'and we register to associate with application type native':
            regSucceed({application_name: "Native app",
                        type: 'client_associate',
                        application_type: "native"
                       }),
            'and we register to associate with non-email contacts set':
            regFail({application_name: "Bad Contact",
                     type: 'client_associate',
                     contacts: "http://example.com/contact-form"}),
            'and we register to associate with bad separator in contacts':
            regFail({application_name: "Comma Contact",
                     type: 'client_associate',
                     contacts: "john@example.com,sue@example.net"}),
            'and we register to associate with a single valid contact':
            regSucceed({application_name: "One Contact",
                     type: 'client_associate',
                     contacts: "john@example.com"}),
            'and we register to associate with multiple valid contacts':
            regSucceed({application_name: "Several Contacts",
                        type: 'client_associate',
                        contacts: "john@example.com sue@example.net eric@example.com"})
        }
    }
});

suite.export(module);