// routes/webfinger.js
//
// Endpoints for discovery using RFC 6415 and Webfinger
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

var databank = require("databank"),
    _ = require("underscore"),
    Step = require("step"),
    validator = require("validator"),
    check = validator.check,
    sanitize = validator.sanitize,
    HTTPError = require("../lib/httperror").HTTPError,
    URLMaker = require("../lib/urlmaker").URLMaker,
    User = require("../lib/model/user").User;

// Initialize the app controller

var addRoutes = function(app) {
    app.get("/.well-known/host-meta", hostMeta);
    app.get("/.well-known/host-meta.json", hostMetaJSON);
    app.get("/api/lrdd", lrddUser, lrdd);
    app.get("/api/lrdd.json", lrddUser, lrddJSON);
};

var xmlEscape = function(text) {
    return text.replace(/&/g, "&amp;").
        replace(/</g, "&lt;").
        replace(/"/g, "&quot;").
        replace(/'/g, "&amp;");
};

var Link = function(attrs) {

    return "<Link " + _(attrs).map(function(value, key) {
        return key + "=\"" + xmlEscape(value) + "\"";
    }).join(" ") + " />";
};

var hostMetaLinks = function() {
    return [
        {
            rel: "lrdd",
            type: "application/xrd+xml",
            template: URLMaker.makeURL("/api/lrdd") + "?uri={uri}"
        },
        {
            rel: "lrdd",
            type: "application/json",
            template: URLMaker.makeURL("/api/lrdd.json") + "?uri={uri}"
        }
    ];
};

var hostMeta = function(req, res, next) {

    var i, links;

    // Return JSON if accepted

    if (_(req.headers).has("accept") && req.accepts("application/json")) {
        hostMetaJSON(req, res, next);
        return;
    }

    // otherwise, xrd

    links = hostMetaLinks();

    res.writeHead(200, {"Content-Type": "application/xrd+xml"});
    res.write("<?xml version='1.0' encoding='UTF-8'?>\n"+
              "<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0'>\n");

    for (i = 0; i < links.length; i++) {
        res.write(Link(links[i]) + "\n");
    }
    
    res.end("</XRD>\n");
};

var hostMetaJSON = function(req, res, next) {
    res.json({
        links: hostMetaLinks()
    });
};

var lrddUser = function(req, res, next) {
    var uri;

    if (!_(req).has("query") || !_(req.query).has("uri")) {
        next(new HTTPError("No uri parameter", 400));
        return;
    }

    uri = req.query.uri;

    var parts = uri.match(/^(.*)@(.*)$/);
    
    if (!parts) {
        next(new HTTPError("Unrecognized uri parameter", 404));
        return;
    }

    if (parts[2] != URLMaker.hostname) {
        next(new HTTPError("Unrecognized host", 404));
        return;
    }
    
    User.get(parts[1], function(err, user) {
        if (err && err instanceof databank.NoSuchThingError) {
            next(new HTTPError(err.message, 404));
        } else if (err) {
            next(err);
        } else {
            req.user = user;
            next();
        }
    });
};

var lrddLinks = function(user) {
    return [
        {
            rel: "http://webfinger.net/rel/profile-page",
            type: "text/html",
            href: URLMaker.makeURL("/" + user.nickname)
        }
    ];
};

var lrdd = function(req, res, next) {

    var i, links;

    if (_(req.headers).has("accept") && req.accepts("application/json")) {
        lrddJSON(req, res, next);
        return;
    }

    links = lrddLinks(req.user);

    res.writeHead(200, {"Content-Type": "application/xrd+xml"});
    res.write("<?xml version='1.0' encoding='UTF-8'?>\n"+
              "<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0'>\n");

    for (i = 0; i < links.length; i++) {
        res.write(Link(links[i]) + "\n");
    }
    
    res.end("</XRD>\n");
};

var lrddJSON = function(req, res, next) {
    res.json({
        links: lrddLinks(req.user)
    });
};

exports.addRoutes = addRoutes;
