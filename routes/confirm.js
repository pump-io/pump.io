// routes/confirm.js
//
// Endpoint for confirming an email address
//
// Copyright 2013, E14N https://e14n.com/
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
    authc = require("../lib/authc"),
    HTTPError = require("../lib/httperror").HTTPError,
    URLMaker = require("../lib/urlmaker").URLMaker,
    Confirmation = require("../lib/model/confirmation").Confirmation,
    User = require("../lib/model/user").User,
    setPrincipal = authc.setPrincipal,
    principal = authc.principal;

var addRoutes = function(app) {

    app.get("/main/confirm/:code", app.session, principal, confirm);

};

var confirm = function(req, res, next) {

    var code = req.params.code,
        principal = req.principal,
        user,
        confirm;

    Step(
        function() {
            Confirmation.search({code: code}, this);
        },
        function(err, confirms) {
            if (err) throw err;
            if (!_.isArray(confirms) ||
                confirms.length != 1) {
                throw new HTTPError("Invalid state for confirmation.", 500);
            }
            confirm = confirms[0];
            if (confirm.confirmed) {
                // XXX: Maybe just log and redirect to / ?
                throw new HTTPError("Already confirmed.", 400);
            }
            User.get(confirm.nickname, this);
        },
        function(err, results) {
            if (err) throw err;
            user = results;
            if (principal && principal.id != user.profile.id) {
                throw new HTTPError("This is someone else's confirmation.", 400);
            }
            user.email = confirm.email;
            user.save(this.parallel());
            confirm.confirmed = true;
            confirm.save(this.parallel());
        },
        function(err, res1, res2) {
            if (err) throw err;
            setPrincipal(req.session, user.profile, this);
        },
        function(err) {
            if (err) {
                next(err);
            } else {
                res.render("confirmed", {page: {title: "Email address confirmed",
                                                url: req.originalUrl},
                                         principalUser: user,
                                         principal: user.profile});
            }
        }
    );
};

exports.addRoutes = addRoutes;
