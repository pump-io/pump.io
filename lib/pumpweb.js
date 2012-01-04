// pumpweb.js
//
// Spurtin' out pumpy goodness all over your browser window
//
// Copyright 2011, StatusNet Inc.
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

var Activity = require('./model/activity').Activity,
    PumpApp = require('./pumpapp').PumpApp,
    connect = require('connect'),
    User = require('./model/user').User,
    databank = require('databank'),
    Step = require('step'),
    _ = require('../public/javascript/underscore.js'),
    fs = require('fs'),
    NoSuchThingError = databank.NoSuchThingError;

var nyi = function(req, res, next) {
        PumpWeb.showError(res, new Error("Not yet implemented"));
};

// Application controller

var PumpWeb = _.extend(_.clone(PumpApp), {

    initApp: function(app) {

        app.get('/', this.maybeAuth, this.showMain);
        app.post('/login', this.noUser, this.handleLogin);
        app.post('/logout', this.maybeAuth, this.handleLogout);

        app.get('/:nickname', this.maybeAuth, this.reqUser, this.showStream);
        app.get('/:nickname/inbox', this.maybeAuth, this.reqUser, this.showInbox);
        app.get('/:nickname/activity/:uuid', this.maybeAuth, this.reqUser, this.showActivity);

    },

    showMain: function(req, res) {

        var pump = this;

        Step(
            function() {
                if (req.user) {
                    pump.runTemplate("nav-loggedin", req.user, this.parallel());
                } else {
                    pump.runTemplate("nav-anonymous", {}, this.parallel());
                }
                pump.runTemplate("header", {title: "Welcome", subtitle: ""}, this.parallel());
                pump.runTemplate("main-content", {}, this.parallel());
                pump.runTemplate("main-sidebar", {}, this.parallel());
            },
            function(err, nav, header, content, sidebar) {
                if (err) throw err;
                pump.runTemplate("main", {nav: nav, header: header, content: content, sidebar: sidebar}, this);
            },
            function(err, page) {
                if (err) {
                    pump.showError(res, err);
                } else {
                    res.writeHead(200, {'Content-Type': 'text/html'});
                    res.end(page);
                }
            }
        );
    },

    handleLogin: function(req, res, next) {
        var pump = this;

        Step( 
            function () { 
                pump.checkCredentials(req.body.nickname, req.body.password, this);
            },
            function(err, user) {
                if (err) {
                    pump.showError(res, err);
                } else {
                    req.session.nickname = user.nickname;
                    user.sanitize();
                    pump.showData(res, user);
                }
            }
        );
    },

    handleLogout: function(req, res, next) {
        var pump = this;
        delete req.session.nickname;
        pump.showData(res, "OK");
    },

    showInbox: nyi,
    showStream: nyi,
    checkVerb: nyi,
    checkObject: nyi,
    showActivity: nyi,

    maybeAuth: function(req, res, next) {
        var pump = this;

        if (!req.session.nickname) {
            req.user = null;
            next();
        } else {
            Step(
                function() {
                    User.get(req.session.nickname, this);
                },
                function(err, user) {
                    if (err) {
                        pump.showError(req, err);
                    } else {
                        user.sanitize();
                        req.user = user;
                        next();
                    }
                }
            );
        }
    },

    noUser: function(req, res, next) {
        if (req.session.nickname) {
            this.showError(res, new Error("Already logged in."));
        } else {
            next();
        }
    },


    templates: {},
 
    runTemplate: function(name, context, callback) {
        var tmpl = this.templates[name],
            pump = this;

        if (tmpl) {
            callback(null, tmpl(context));
        } else {
            fs.readFile(__dirname + '/../public/template/'+name+".template", function(err, data) {
                if (err) {
                    callback(err, null);
                } else {
                    tmpl = _.template(data.toString());
                    pump.templates[name] = tmpl;
                    callback(null, tmpl(context));
                } 
            });
        }
    }

});

// Make this more useful

_.bindAll(PumpWeb);

exports.PumpWeb = PumpWeb;
