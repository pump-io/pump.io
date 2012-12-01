// routes/uploads.js
//
// For the /uploads/* endpoints
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

var path = require("path"),
    Step = require("step"),
    _ = require("underscore"),
    Activity = require("../lib/model/activity").Activity,
    HTTPError = require("../lib/httperror").HTTPError,
    mm = require("../lib/mimemap"),
    mw = require("../lib/middleware"),
    sa = require("../lib/sessionauth"),
    typeToClass = mm.typeToClass,
    typeToExt = mm.typeToExt,
    extToType = mm.extToType,
    hasOAuth = mw.hasOAuth,
    clientAuth = mw.clientAuth,
    principal = sa.principal;

var addRoutes = function(app) {
    if (app.session) {
        app.get("/uploads/*", everyAuth, uploadedFile);
    } else {
        app.get("/uploads/*", app.session, everyAuth, uploadedFile);
    }
};

// XXX: Add remoteUserAuth

var everyAuth = function(req, res, next) {
    if (hasOAuth(req)) {
        clientAuth(req, res, next);
    } else if (req.session) {
        principal(req, res, next);
    } else {
        next();
    }
};

// Check downloads of uploaded files

var uploadedFile = function(req, res, next) {
    var slug = req.params[0],
        ext = slug.match(/\.(.*)$/)[1],
        type = extToType(ext),
        Cls = typeToClass(type),
        profile = (req.remoteUser) ? req.remoteUser.profile : 
            ((req.principal) ? req.principal : null),
        obj;

    Step(
        function() {
            Cls.search({_slug: slug}, this);
        },
        function(err, objs) {
            if (err) throw err;
            if (!objs || objs.length !== 1) {
                throw new Error("Bad number of records for uploads");
            }
            obj = objs[0];
            Activity.postOf(obj, this);
        },
        function(err, post) {
            if (err) throw err;
            if (post) {
                post.checkRecipient(profile, this);
            } else {
                if (profile &&
                    obj.author &&
                    req.remoteUser.profile.id == obj.author.id) {
                    res.sendfile(path.join(req.app.config.uploaddir, slug));
                    return;
                }
            }
        },
        function(err, flag) {
            if (err) {
                next(err);
            } else if (!flag) {
                next(new HTTPError("Not allowed", 403));
            } else {
                res.sendfile(path.join(req.app.config.uploaddir, slug));
            }
        }
    );
};

exports.addRoutes = addRoutes;
