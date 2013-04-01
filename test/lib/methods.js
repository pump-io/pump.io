// methods.js
//
// Test utility to check methods on an object
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

var methodContext = function(methods) {
    var i, m, k,
        context = {
            topic: function(obj) {
                return obj;
            }
        };
    
    for (i in methods) {
        m = methods[i];
        if ("aeiouAEIOU".indexOf(m.charAt(0)) !== -1) {
            k = "it has an "+m+" method";
        } else {
            k = "it has a "+m+" method";
        }
        context[k] = function(obj) {
            assert.isFunction(obj[methods[i]]);
        };
    }

    return context;
};

exports.methodContext = methodContext;
