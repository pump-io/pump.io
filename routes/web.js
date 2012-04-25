// routes/web.js
//
// Spurtin' out pumpy goodness all over your browser window
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

var Activity = require('../model/activity').Activity,
    connect = require('connect'),
    User = require('../model/user').User,
    databank = require('databank'),
    Step = require('step'),
    _ = require('underscore'),
    fs = require('fs'),
    mw = require('../lib/middleware'),
    maybeAuth = mw.maybeAuth,
    reqUser = mw.reqUser,
    mustAuth = mw.mustAuth,
    sameUser = mw.sameUser,
    noUser = mw.noUser,
    NoSuchThingError = databank.NoSuchThingError;

var initApp = function(app) {

    app.get('/', maybeAuth, showMain);

    app.post('/main/login', noUser, handleLogin);
    app.post('/main/logout', mustAuth, handleLogout);

    app.get('/main/settings', mustAuth, showSettings);

    app.get('/:nickname', maybeAuth, reqUser, showStream);
    app.get('/:nickname/inbox', mustAuth, reqUser, sameUser, showInbox);
    app.get('/:nickname/activity/:uuid', maybeAuth, reqUser, showActivity);
};

var showSettings = function(req, res, next) {

    var pump = this;

    Step(
        function() {
            pump.runNav(req, this.parallel());
            pump.runTemplate("header", {title: "Settings", subtitle: ""}, this.parallel());
	    // FIXME: XSS protection with a session code in form
            pump.runTemplate("settings-content", req.remoteUser, this.parallel());
        },
        function(err, nav, header, content) {
            if (err) throw err;
            pump.runTemplate("main", {nav: nav, header: header, content: content}, this);
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
};

var showMain = function(req, res, next) {

    var pump = this;

    Step(
        function() {
            pump.runNav(req, this.parallel());
            pump.runTemplate("header", {title: "Welcome", subtitle: ""}, this.parallel());
            pump.runTemplate("main-content", {}, this.parallel());
        },
        function(err, nav, header, content) {
            if (err) throw err;
            pump.runTemplate("main", {nav: nav, header: header, content: content}, this);
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
};

var handleLogin = function(req, res, next) {
    var pump = this;

    Step( 
        function () { 
            pump.checkCredentials(req.body.nickname, req.body.password, this);
        },
        function(err, user) {
	    if (err) throw err;
	    if (!user) {
		// done here
                pump.showError(res, new Error("Not authorized"), 403);
	    } else {
		user.expand(this);
	    }
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
};

var handleLogout = function(req, res, next) {
    var pump = this;
    delete req.session.nickname;
    pump.showData(res, "OK");
};

var showActivity = function(req, res, next) {
    var pump = this,
        uuid = req.params.uuid,
        user = req.user;

    Step(
        function() {
            Activity.search({'uuid': req.params.uuid}, this);
        },
        function(err, activities) {
            if (err) throw err;
            if (activities.length === 0) {
                throw new NoSuchThingError('activity', uuid);
            }
            if (activities.length > 1) {
                throw new Error("Too many activities with ID = " + req.params.uuid);
            }
            activities[0].expand(this);
        },
        function(err, activity) {
            if (err) throw err;

            pump.runNav(req, this.parallel());
            pump.runTemplate("activity-header", activity, this.parallel());
            pump.runTemplate("activity-content", activity, this.parallel());
        },
        function(err, nav, header, content) {
            if (err) throw err;
            pump.runTemplate("main", {nav: nav, header: header, content: content}, this);
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
};

var showInbox = function(req, res, next) {
    var pump = this;

    Step(
        function() {
            req.user.getInbox(0, 20, this);
        },
        function(err, activities) {
            if (err) throw err;
            pump.runNav(req, this.parallel());
            pump.runTemplate("inbox-header", req.user, this.parallel());
            pump.runTemplate("inbox-content", {stream: activities, user: req.user}, this.parallel());
        },
        function(err, nav, header, content) {
            if (err) throw err;
            pump.runTemplate("main", 
                             {nav: nav, 
                              header: header, 
                              content: content},
                             this);
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
};

var showStream = function(req, res, next) {
    var pump = this;

    Step(
        function() {
            req.user.getStream(0, 20, this);
        },
        function(err, activities) {
            if (err) throw err;
            pump.runNav(req, this.parallel());
            pump.runTemplate("user-page-header", req.user, this.parallel());
            pump.runTemplate("user-page-content", {actor: req.user.profile, stream: activities}, this.parallel());
        },
        function(err, nav, header, content) {
            if (err) throw err;
            pump.runTemplate("main", 
                             {nav: nav, 
                              header: header, 
                              content: content},
                             this);
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
};

var runNav = function(req, next) {
    var pump = this;

    if (req.remoteUser) {
        pump.runTemplate("nav-loggedin", req.remoteUser, next);
    } else {
        pump.runTemplate("nav-anonymous", {}, next);
    }
};

var templates = {};

var runTemplate = function(name, context, callback) {
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
};

