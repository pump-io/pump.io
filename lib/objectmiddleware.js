// lib/objectmiddleware.js
//
// Useful middleware for working with routes like :type/:uuid
//
// Copyright 2011-2012, E14N https://e14n.com/
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

var _ = require("underscore"),
    Step = require("step"),
    HTTPError = require("../lib/httperror").HTTPError,
    ActivityObject = require("../lib/model/activityobject").ActivityObject,
    Activity = require("../lib/model/activity").Activity;

var requestObject = function(req, res, next) {

    var type = req.params.type,
        uuid = req.params.uuid,
        Cls,
        obj = null;

    if (_.contains(ActivityObject.objectTypes, type) || type == "other") {
        req.type = type;
    } else {
        next(new HTTPError("Unknown type: " + type, 404));
        return;
    }

    Cls = ActivityObject.toClass(type);
    
    Cls.search({"_uuid": uuid}, function(err, results) {
        if (err) {
            next(err);
        } else if (results.length === 0) {
            next(new HTTPError("Can't find a " + type + " with ID = " + uuid, 404));
        } else if (results.length > 1) {
            next(new HTTPError("Too many " + type + " objects with ID = " + req.params.uuid, 500));
        } else {
            obj = results[0];
            if (obj.hasOwnProperty("deleted")) {
                next(new HTTPError("Deleted", 410));
            } else {
                obj.expand(function(err) {
                    if (err) {
                        next(err);
                    } else {
                        req[type] = obj;
                        next();
                    }
                });
            }
        }
    });
};

var authorOnly = function(req, res, next) {

    var type = req.type,
        obj = req[type];

    if (obj && obj.author && obj.author.id == req.principal.id) {
        next();
    } else {
        next(new HTTPError("Only the author can modify this object.", 403));
    }
};

var authorOrRecipient = function(req, res, next) {

    var type = req.type,
        obj = req[type],
        person = req.principal;

    if (obj && obj.author && person && obj.author.id == person.id) {
        next();
    } else {
        Step(
            function() {
                Activity.postOf(obj, this);
            },
            function(err, act) {
                if (err) throw err;
                if (!act) {
                    next(new HTTPError("No authorization for this object.", 403));
                } else {
                    act.checkRecipient(person, this);
                }
            },
            function(err, isRecipient) {
                if (err) {
                    next(err);
                } else if (isRecipient) {
                    next();
                } else {
                    next(new HTTPError("Only the author and recipients can view this object.", 403));
                }
            }
        );
    }
};

var principalActorOrRecipient = function(req, res, next) {

    var person = req.principal,
        activity = req.activity;

    if (activity && activity.actor && person && activity.actor.id == person.id) {
        next();
    } else {
        Step(
            function() {
                activity.checkRecipient(person, this);
            },
            function(err, isRecipient) {
                if (err) {
                    next(err);
                } else if (isRecipient) {
                    next();
                } else {
                    next(new HTTPError("Only the author and recipients can view this activity.", 403));
                }
            }
        );
    }
};

var principalAuthorOrRecipient = function(req, res, next) {

    var type = req.type,
        obj = req[type],
        person = req.principal;

    if (obj && obj.author && person && obj.author.id == person.id) {
        next();
    } else {
        Step(
            function() {
                Activity.postOf(obj, this);
            },
            function(err, act) {
                if (err) throw err;
                act.checkRecipient(person, this);
            },
            function(err, isRecipient) {
                if (err) {
                    next(err);
                } else if (isRecipient) {
                    next();
                } else {
                    next(new HTTPError("Only the author and recipients can view this object.", 403));
                }
            }
        );
    }
};

exports.requestObject     = requestObject;
exports.authorOnly        = authorOnly;
exports.authorOrRecipient = authorOrRecipient;
exports.principalActorOrRecipient = principalActorOrRecipient;
exports.principalAuthorOrRecipient = principalAuthorOrRecipient;
