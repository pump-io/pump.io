// routes/web.js
//
// Spurtin' out pumpy goodness all over your browser window
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

var connect = require("connect"),
    send = connect.middleware.static.send,
    cutils = connect.utils,
    fs = require("fs"),
    path = require("path"),
    Step = require("step"),
    HTTPError = require("../lib/httperror").HTTPError;

// Default expires is one year

var EXPIRES = 365 * 24 * 60 * 60 * 1000;

var addRoutes = function(app) {

    // expose this one file over the web

    app.get("/shared/showdown.js", sharedFile("showdown/src/showdown.js"));
    app.get("/shared/underscore.js", sharedFile("underscore/underscore.js"));
    app.get("/shared/underscore-min.js", sharedFile("underscore/underscore-min.js"));
};

var sharedFile = function(fname) {

    var root = path.join(__dirname, "..", "node_modules");

    return function(req, res, next) {
        send(req, res, next, {path: fname, root: root});
    };
};

exports.addRoutes = addRoutes;

