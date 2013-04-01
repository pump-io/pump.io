// httperror-test.js
//
// Test the httperror module
//
// Copyright 2012, E14N https://e14n.com/
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

var assert = require("assert"),
    vows = require("vows");

vows.describe("httperror module interface").addBatch({
    "When we require the http error module": {
        topic: function() { 
            return require("../lib/httperror");
        },
        "we get an object": function(httperror) {
            assert.isObject(httperror);
        },
        "which includes HTTPError": function(httperror) {
            assert.includes(httperror, "HTTPError");
        },
        "and we get its HTTPError export": {
            topic: function(httperror) {
                return httperror.HTTPError;
            },
            "it exists": function(HTTPError) {
                assert.isFunction(HTTPError);
            },
            "and we create an HTTPError": {
                topic: function(HTTPError) {
                    return new HTTPError("Message", 404);
                },
                "it looks about right": function(err) {
                    assert.includes(err, "message");
                    assert.includes(err, "code");
                    assert.isString(err.message);
                    assert.isNumber(err.code);
                    assert.equal(err.message, "Message");
                    assert.equal(err.code, 404);
                }
            }
            
        }
    }
})["export"](module);

