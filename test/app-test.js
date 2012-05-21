// app-test.js
//
// Test the app module
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

var ignore = function(err) {};

var suite = vows.describe('app module interface');

suite.addBatch({
    'When we get the app module': {
        topic: function() { 
            return require('../lib/app');
        },
        'there is one': function(mod) {
            assert.isObject(mod);
        },
        'it has the makeApp() export': function(mod) {
            assert.isFunction(mod.makeApp);
        }
    }
});

suite.addBatch({
    'When we makeApp()': {
        topic: function() {
            var config = {port: 4815,
                          hostname: 'localhost',
                          driver: 'memory',
                          params: {}
                         },
                makeApp = require('../lib/app').makeApp;

            makeApp(config, this.callback);
        },
        'it works': function(err, app) {
            assert.ifError(err);
            assert.isObject(app);
        },
        'app has the run() method': function(err, app) {
            assert.isFunction(app.run);
        },
        'and we app.run()': {
            topic: function(app) {
                var cb = this.callback;
                app.run(function(err) {
                    if (err) {
                        cb(err, null);
                    } else {
                        cb(null, app);
                    }
                });
            },
            'it works': function(err, app) {
                assert.ifError(err);
            },
            'app is listening on correct port': function(err, app) {
                var addr = app.address();
                assert.equal(addr.port, 4815);
            },
            teardown: function(app) {
                app.close();
            }
        }
    }
});

suite.export(module);