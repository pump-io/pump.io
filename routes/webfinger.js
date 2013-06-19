// routes/webfinger.js
//
// Endpoints for discovery using RFC 6415 and Webfinger
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

var urlparse = require("url").parse,
    databank = require("databank"),
    _ = require("underscore"),
    Step = require("step"),
    validator = require("validator"),
    check = validator.check,
    sanitize = validator.sanitize,
    HTTPError = require("../lib/httperror").HTTPError,
    URLMaker = require("../lib/urlmaker").URLMaker,
    User = require("../lib/model/user").User,
    ActivityObject = require("../lib/model/activityobject").ActivityObject;

// Initialize the app controller

var addRoutes = function(app) {
    app.get("/.well-known/host-meta", hostMeta);
    app.get("/.well-known/host-meta.json", hostMetaJSON);
    app.get("/api/lrdd", lrddUser, lrdd);
    app.get("/.well-known/webfinger", lrddUser, webfinger);
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
            template: URLMaker.makeURL("/api/lrdd") + "?resource={uri}"
        },
        {
            rel: "lrdd",
            type: "application/json",
            template: URLMaker.makeURL("/.well-known/webfinger") + "?resource={uri}"
        },
        {
            rel: "registration_endpoint",
            href: URLMaker.makeURL("/api/client/register")
        },
        {
            rel: "http://apinamespace.org/oauth/request_token",
            href: URLMaker.makeURL("/oauth/request_token")
        },
        {
            rel: "http://apinamespace.org/oauth/authorize",
            href: URLMaker.makeURL("/oauth/authorize")
        },
        {
            rel: "http://apinamespace.org/oauth/access_token",
            href: URLMaker.makeURL("/oauth/access_token")
        },
        {
            rel: "dialback",
            href: URLMaker.makeURL("/api/dialback")
        },
        {
            rel: "http://apinamespace.org/activitypub/whoami",
            href: URLMaker.makeURL("/api/whoami")
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
    var resource, parts;

    if (!_(req).has("query") || !_(req.query).has("resource")) {
        next(new HTTPError("No resource parameter", 400));
        return;
    }

    resource = req.query.resource;

    // Prefix it with acct: if it looks like a bare webfinger

    if (resource.indexOf(":") === -1) {
        if (resource.indexOf("@") !== -1) {
            resource = "acct:" + resource;
        }
    }

    // This works for acct: URIs, http URIs, and https URIs

    parts = urlparse(resource);

    if (!parts) {
        next(new HTTPError("Unrecognized resource parameter", 404));
        return;
    }

    if (parts.hostname != URLMaker.hostname) {
        next(new HTTPError("Unrecognized host", 404));
        return;
    }

    switch (parts.protocol) {
    case "acct:":
        Step(
            function() {
                User.get(parts.auth, this);
            },
            function(err, user) {
                if (err) throw err;
                req.user = user;
                user.expand(this);
            },
            function(err) {
                if (err && err.name == "NoSuchThingError") {
                    next(new HTTPError(err.message, 404));
                } else if (err) {
                    next(err);
                } else {
                    next();
                }
            }
        );
        break;
    case "http:":
    case "https:":
        // XXX: this is kind of flaky; we should have a better way to turn
        // an ID into an activity object
        var match = parts.pathname.match("/api/([^/]*)/");
        if (!match) {
            next(new HTTPError("Unknown object type", 404));
            return;
        }
        var type = match[1];
        ActivityObject.getObject(type, resource, function(err, obj) {
            if (err && err.name == "NoSuchThingError") {
                next(new HTTPError(err.message, 404));
            } else if (err) {
                next(err);
            } else {
                req.obj = obj;
                next();
            }
        });
        break;
    }
};

var userLinks = function(user) {
    var links = [
        {
            rel: "http://webfinger.net/rel/profile-page",
            type: "text/html",
            href: URLMaker.makeURL("/" + user.nickname)
        },
        {
            rel: "dialback",
            href: URLMaker.makeURL("/api/dialback")
        }
    ];

    return links.concat(objectLinks(user.profile));
};

var objectLinks = function(obj) {

    var links = [],
        feeds = ["replies", "likes", "shares",
                 "members",
                 "followers", "following", "favorites", "lists"];

    if (obj.links) {
        _.each(obj.links, function(value, key) {
            var link = _.clone(value);
            link.rel = key;
            links.push(link);
        });
    }

    _.each(feeds, function(feed) {
        var link;
        if (obj[feed] && obj[feed].url) {
            link = {rel: feed, href: obj[feed].url};
            links.push(link);
        }
    });

    return links;
};

var lrdd = function(req, res, next) {

    var i, links;

    if (_(req.headers).has("accept") && req.accepts("application/json")) {
        webfinger(req, res, next);
        return;
    }

    if (req.user) {
        links = userLinks(req.user);
    } else {
        links = objectLinks(req.obj);
    }

    res.writeHead(200, {"Content-Type": "application/xrd+xml"});
    res.write("<?xml version='1.0' encoding='UTF-8'?>\n"+
              "<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0'>\n");

    for (i = 0; i < links.length; i++) {
        res.write(Link(links[i]) + "\n");
    }
    
    res.end("</XRD>\n");
};

var webfinger = function(req, res, next) {
    var links;
    if (req.user) {
        links = userLinks(req.user);
    } else {
        links = objectLinks(req.obj);
    }
    res.json({
        links: links
    });
};

exports.addRoutes = addRoutes;
