// sessionauth.js
//
// Authenticate using sessions
//
// Copyright 2011-2012, StatusNet Inc.
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
    _ = require("underscore"),
    ActivityObject = require("./model/activityobject").ActivityObject,
    User = require("./model/user").User,
    HTTPError = require("./httperror").HTTPError;

var setPrincipal = function(session, obj, callback) {
    var ref = {
        id: obj.id,
        objectType: obj.objectType
    };
    session.principal = ref;
    callback(null);
};

var getPrincipal = function(session, callback) {

    if (!session || !_.has(session, "principal")) {
        callback(null, null);
        return;
    }

    var ref = session.principal;

    Step(
        function() {
            ActivityObject.getObject(ref.objectType, ref.id, this);
        },
        callback
    );
};

var clearPrincipal = function(session, callback) {

    if (!session || !_.has(session, "principal")) {
        callback(null);
        return;
    }

    delete session.principal;

    callback(null);
};

var principal = function(req, res, next) {
    
    Step(
        function() {
            getPrincipal(req.session, this);
        },
        function(err, principal) {
            if (err) throw err;
            req.principal = principal;
            User.fromPerson(principal, this);
        },
        function(err, user) {
            if (err) {
                next(err);
            } else {
                // XXX: can be null
                req.principalUser = user;
                next();
            }
        }
    );
};

exports.principal = principal;
exports.setPrincipal = setPrincipal;
exports.getPrincipal = getPrincipal;
exports.clearPrincipal = clearPrincipal;
