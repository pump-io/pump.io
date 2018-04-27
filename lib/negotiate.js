// negotiate.js
//
// Run different middleware stacks based on the Accept: header
//
// Copyright 2018, E14N https://e14n.com/
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

"use strict";

var _ = require("lodash");
var assert = require("assert");
var HTTPError = require("./httperror").HTTPError;

module.exports = function negotiate(stacks) {
    assert(_.isObject(stacks));
    assert(_.every(_.values(stacks), _.isArray));
    assert(_.every(_.keys(stacks), _.isString));
    var choices = _.keys(stacks);
    return function(req, res, next) {
        var choice = req.accepts(choices);
        if (!choice) {
            return next(new HTTPError("Not acceptable", 406));
        }
        var stack = stacks[choice];
        assert(_.isArray(stack), "No stack for " + choice);
        return runStack(req, res, next, stack);
    };
};

function runStack(req, res, next, stack) {
    if (stack.length === 0) {
        return next();
    } else {
        var mw = stack[0];
        assert(_.isFunction(mw));
        return mw(req, res, function(err) {
            if (err) {
                return next(err);
            } else {
                return runStack(req, res, next, stack.slice(1));
            }
        });
    }
}
