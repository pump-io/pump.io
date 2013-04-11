// lib/filters.js
//
// Some common filters we use on streams
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

var Step = require("step"),
    Activity = require("../lib/model/activity").Activity,
    ActivityObject = require("../lib/model/activityobject").ActivityObject;

var recipientsOnly = function(person) {
    return function(id, callback) {
        Step(
            function() {
                Activity.get(id, this);
            },
            function(err, act) {
                if (err) throw err;
                act.checkRecipient(person, this);
            },
            callback
        );
    };
};

// Just do this one once

var publicOnly = recipientsOnly(null);

var objectRecipientsOnly = function(person) {

    return function(item, callback) {

        var ref;

        try {
            ref = JSON.parse(item);
        } catch (err) {
            callback(err, null);
            return;
        }

        Step(
            function() {
                ActivityObject.getObject(ref.objectType, ref.id, this);
            },
            function(err, obj) {
                if (err) throw err;
                if (obj.objectType == ActivityObject.PERSON) {
                    // Is this correct?
                    callback(null, true);
                } else {
                    Activity.postOf(obj, this);
                }
            },
            function(err, act) {
                if (err) throw err;
                if (!act) {
                    // Is this correct?
                    callback(null, false);
                } else {
                    act.checkRecipient(person, this);
                }
            },
            callback
        );
    };
};

var objectPublicOnly = objectRecipientsOnly(null);

var idRecipientsOnly = function(person, type) {

    return function(id, callback) {

        Step(
            function() {
                ActivityObject.getObject(type, id, this);
            },
            function(err, obj) {
                if (err) throw err;
                Activity.postOf(obj, this);
            },
            function(err, act) {
                if (err) throw err;
                if (!act) {
                    callback(null, false);
                } else {
                    act.checkRecipient(person, this);
                }
            },
            callback
        );
    };
};

var idPublicOnly = function(type) {
    return idRecipientsOnly(null, type);
};

// In case you need one, here it is

var always = function(id, callback) {
    callback(null, true);
};

exports.recipientsOnly = recipientsOnly;
exports.publicOnly = publicOnly;
exports.objectRecipientsOnly = objectRecipientsOnly;
exports.objectPublicOnly = objectPublicOnly;
exports.idRecipientsOnly = idRecipientsOnly;
exports.idPublicOnly = idPublicOnly;
exports.always = always;
