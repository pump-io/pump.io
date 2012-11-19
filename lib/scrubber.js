// scrubber.js
//
// Scrub HTML for dangerous XSS crap
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

var validator = require("validator"),
    _ = require("underscore"),
    check = validator.check,
    sanitize = validator.sanitize;

var Scrubber = {
    scrub: function(str) {
        return sanitize(str).xss();
    },
    scrubActivity: function(act) {

        var strings = ["content"],
            objects = ['actor',
                       'object',
                       'target',
                       'generator',
                       'provider',
                       'context',
                       'source'],
            arrays = ['to',
                      'cc',
                      'bto',
                      'bcc'];

        _.each(strings, function(sprop) {
            if (_.has(act, sprop)) {
                act[sprop] = Scrubber.scrub(act[sprop]);
            }
        });

        _.each(objects, function(prop) {
            if (_.has(act, prop)) {
                if (_.isObject(act[prop])) {
                    act[prop] = Scrubber.scrubObject(act[prop]);
                }
            }
        });

        _.each(arrays, function(array) {
            if (_.has(act, array)) {
                if (_.isArray(act[array])) {
                    _.each(act[array], function(item, index) {
                       Scrubber.scrubObject(item);
                    });
                }
            }
        });

        return act;
    },
    scrubObject: function(obj) {

        var strings = ['content', 'summary'],
            objects = ['author',
                       'location'],
            arrays = ['attachments',
                      'tags'];

        _.each(strings, function(sprop) {
            if (_.has(obj, sprop)) {
                obj[sprop] = Scrubber.scrub(obj[sprop]);
            }
        });

        _.each(objects, function(prop) {
            if (_.has(obj, prop)) {
                if (_.isObject(obj[prop])) {
                    obj[prop] = Scrubber.scrubObject(obj[prop]);
                }
            }
        });

        _.each(arrays, function(array) {
            if (_.has(obj, array)) {
                if (_.isArray(obj[array])) {
                    _.each(obj[array], function(item, index) {
                       Scrubber.scrubObject(item);
                    });
                }
            }
        });

        return obj;
    }
};

// So you can require("scrubber").Scrubber or just require("scrubber")

Scrubber.Scrubber = Scrubber;

module.exports = Scrubber;